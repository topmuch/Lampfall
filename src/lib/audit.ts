import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";

/**
 * Enregistre une entrée dans le journal d'audit.
 * Ne lève jamais d'exception : l'audit ne doit pas bloquer les opérations métier.
 */
export async function logAudit(
  request: Request,
  action: "CREATE" | "UPDATE" | "DELETE",
  entity: string,
  entityId?: string | null,
  details?: string | null
): Promise<void> {
  try {
    const user = await getAuthUser(request);
    await db.auditLog.create({
      data: {
        userId: user?.id ?? null,
        userName: user?.name ?? "Système",
        action,
        entity,
        entityId: entityId ?? null,
        details: details ?? null,
      },
    });
  } catch {
    /* silencieux */
  }
}
