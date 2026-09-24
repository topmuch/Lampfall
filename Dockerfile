# ETS LAMP FALL — Dockerfile de production (Coolify / Docker)
# Méthode standard : le contexte de build EST le dépôt (cloné par la plateforme).
# Plus de `git clone` interne = plus d'échec lié aux limitations GitHub.
FROM node:20-alpine

# Paquets requis (git conservé uniquement comme filet de sécurité)
RUN apk add --no-cache git libc6-compat sqlite
RUN npm install -g bun

WORKDIR /app

# Copie du dépôt depuis le contexte de build fourni par la plateforme
COPY . /app/

# Filet de sécurité : si le contexte est vide (configuration inhabituelle),
# on retombe sur un clonage GitHub explicite — erreur claire si bloqué.
RUN if [ ! -f package.json ]; then \
      echo "⚠ Contexte de build vide → clonage GitHub de secours…" && \
      git clone --depth 1 https://github.com/topmuch/Lampfall.git . ; \
    fi

# Installation des dépendances (bun.lock copié pour un cache de couches efficace)
RUN bun install

# Génération du client Prisma
RUN npx prisma generate

# Construction de l'application
ENV NEXT_TELEMETRY_DISABLED=1
ENV DATABASE_URL=file:/app/data/lampfall.db
RUN bun run build

# Dossier de données (base SQLite persistante, à monter en volume)
RUN mkdir -p /app/data

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
ENV DATABASE_URL=file:/app/data/lampfall.db

# Démarrage : restauration 1er boot (backup/*.db) + sauvegarde pré-migration
# + schéma Prisma + admin + catalogue prix + serveur Next.js
CMD ["sh", "docker/start.sh"]
