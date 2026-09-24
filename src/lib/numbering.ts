// Numérotation SÉCURISÉE des documents (factures, commandes…)
//
// Ancien comportement : `count() + 1` → dès qu'un document était supprimé, le
// compteur retombait sur un numéro déjà attribué → erreur P2002
// « Unique constraint failed on the fields: (number) ».
//
// Nouveau comportement : on part du MAXIMUM existant pour le préfixe/année,
// puis la route réessaie automatiquement en cas de collision concurrente.
import { db } from "@/lib/db";

type NumberedTable = "invoice" | "order";

async function maxSequenceFor(table: NumberedTable, like: string): Promise<number> {
  let max = 0;
  if (table === "invoice") {
    const rows = await db.invoice.findMany({
      where: { number: { startsWith: like } },
      select: { number: true },
    });
    for (const r of rows) {
      const n = parseInt(r.number.slice(like.length), 10);
      if (Number.isFinite(n) && n > max) max = n;
    }
  } else {
    const rows = await db.order.findMany({
      where: { number: { startsWith: like } },
      select: { number: true },
    });
    for (const r of rows) {
      const n = parseInt(r.number.slice(like.length), 10);
      if (Number.isFinite(n) && n > max) max = n;
    }
  }
  return max;
}

/**
 * Génère le prochain numéro disponible pour un type de document.
 * Exemple : max existant FV-2026-0011 → "FV-2026-0012".
 * Les suppressions antérieures ne provoquent plus de collision.
 */
export async function generateDocumentNumber(
  table: NumberedTable,
  prefix: string,
  year: number = new Date().getFullYear()
): Promise<string> {
  const like = `${prefix}-${year}-`;
  const max = await maxSequenceFor(table, like);
  return `${prefix}-${year}-${String(max + 1).padStart(4, "0")}`;
}

/**
 * Exécute `action` en régénérant le numéro si une contrainte d'unicité sur
 * `number` est violée (créations concurrentes). `action` reçoit le numéro
 * courant à chaque tentative.
 */
export async function withNumberRetry<T>(
  getNumber: () => Promise<string>,
  action: (number: string) => Promise<T>,
  attempts = 5
): Promise<{ result: T; number: string }> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i++) {
    const number = await getNumber();
    try {
      const result = await action(number);
      return { result, number };
    } catch (e) {
      const code = (e as { code?: string })?.code;
      if (code === "P2002") {
        lastError = e;
        continue; // collision → régénère et retente
      }
      throw e;
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error("Numérotation : trop de collisions successives");
}
