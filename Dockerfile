# ETS LAMP FALL - Dockerfile pour Coolify
FROM node:20-alpine

# Installation des paquets requis
RUN apk add --no-cache git libc6-compat sqlite
RUN npm install -g bun

WORKDIR /app

# Clonage du dépôt
RUN git clone https://github.com/topmuch/Lampfall.git .

# Installation des dépendances
RUN bun install

# Génération du client Prisma
RUN npx prisma generate

# Construction de l'application
ENV NEXT_TELEMETRY_DISABLED=1
ENV DATABASE_URL=file:/app/data/lampfall.db
RUN bun run build

# Creation du dossier de donnees (base SQLite persistante)
RUN mkdir -p /app/data

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
ENV DATABASE_URL=file:/app/data/lampfall.db

# Commande de demarrage - script d'initialisation complet :
#   sauvegarde pre-migration + schema Prisma (additif) + compte admin
#   + catalogue produits avec prix (idempotent, ne supprime rien) + serveur
CMD ["sh", "docker/start.sh"]
