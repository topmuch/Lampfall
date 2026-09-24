// Sauvegarde de la base SQLite : db/custom.db → db/backups/custom-<horodatage>.db
// Conserve les 20 sauvegardes les plus récentes. Ne nécessite aucun arrêt du serveur
// (copie physique du fichier ; SQLite en journalisation par défaut reste lisible).
import { mkdirSync, readdirSync, statSync, copyFileSync, unlinkSync, existsSync } from "fs";
import { join } from "path";

const DB_PATH = join(process.cwd(), "db", "custom.db");
const BACKUP_DIR = join(process.cwd(), "db", "backups");
const KEEP = 20;

function timestamp(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

function main(): void {
  if (!existsSync(DB_PATH)) {
    console.error("✘ Base introuvable :", DB_PATH);
    process.exit(1);
  }
  mkdirSync(BACKUP_DIR, { recursive: true });
  const dest = join(BACKUP_DIR, `custom-${timestamp()}.db`);
  copyFileSync(DB_PATH, dest);

  // Purge : garder les KEEP plus récentes
  const files = readdirSync(BACKUP_DIR)
    .filter((f) => f.startsWith("custom-") && f.endsWith(".db"))
    .map((f) => ({ f, t: statSync(join(BACKUP_DIR, f)).mtimeMs }))
    .sort((a, b) => b.t - a.t);
  for (const old of files.slice(KEEP)) {
    try {
      unlinkSync(join(BACKUP_DIR, old.f));
    } catch {
      /* ignoré */
    }
  }
  console.log(`✔ Sauvegarde créée : ${dest} (${files.length}/${KEEP} conservées)`);
}

main();
