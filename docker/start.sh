#!/bin/sh
# ── ETS LAMP FALL — démarrage Docker (Coolify) ─────────────────────────────
# Séquence d'initialisation à CHAQUE démarrage du conteneur :
#   1. Sauvegarde de la base existante (rotative, 10 dernières)
#   2. Synchronisation du schéma Prisma (additif — aucune donnée perdue)
#   3. Compte administrateur + paramètres société (si absents)
#   4. Catalogue produits avec prix + clients de démo (idempotent :
#      ne crée que ce qui manque, ne corrige les prix QUE s'ils sont à 0,
#      ne supprime jamais rien)
#   5. Démarrage du serveur Next.js
set -u

DBFILE="${DATABASE_URL#file:}"
echo "════════════════════════════════════════════════"
echo "  ETS LAMP FALL — initialisation du conteneur"
echo "  Base de données : ${DATABASE_URL:-<non définie>}"
echo "════════════════════════════════════════════════"

mkdir -p /app/data

# ── 1/4 Sauvegarde pré-migration ───────────────────────────────────────────
if [ -n "${DBFILE:-}" ] && [ -f "$DBFILE" ]; then
  mkdir -p "$(dirname "$DBFILE")/backups"
  BK="$(dirname "$DBFILE")/backups/$(basename "$DBFILE" .db)-$(date +%Y%m%d-%H%M%S).db"
  cp "$DBFILE" "$BK" && echo "✔ Sauvegarde pré-migration : $BK"
  # Rotation : garder les 10 plus récentes
  ls -1t "$(dirname "$DBFILE")"/backups/*.db 2>/dev/null | tail -n +11 | xargs -r rm -f
fi

# ── 2/4 Schéma Prisma ──────────────────────────────────────────────────────
echo "── 2/4 Synchronisation du schéma (prisma db push)…"
if npx prisma db push --skip-generate; then
  echo "✔ Schéma à jour (colonnes manquantes ajoutées automatiquement)"
else
  echo "⚠ db push a échoué — le serveur démarre quand même, vérifiez les logs" >&2
fi

# ── 3/4 Admin + paramètres ─────────────────────────────────────────────────
echo "── 3/4 Compte administrateur + paramètres société…"
if bun prisma/seed-v3.ts; then
  echo "✔ Administrateur prêt (admin / admin123 par défaut)"
else
  echo "⚠ seed a échoué" >&2
fi

# ── 4/4 Catalogue produits & prix ──────────────────────────────────────────
echo "── 4/4 Catalogue produits (prix, stocks) + clients…"
if bun prisma/restore-demo.ts; then
  echo "✔ Catalogue vérifié/complété"
else
  echo "⚠ restauration catalogue a échoué" >&2
fi

echo "══ Démarrage du serveur Next.js ══"
exec node .next/standalone/server.js
