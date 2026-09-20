# Worklog — ETS LAMP FALL : Système de Facturation

---
Task ID: 1
Agent: Z.ai Code (principal)
Task: Créer un système de facturation complet pour ETS LAMP FALL (factures vente/proforma, statuts livré/non livré & payé/non payé, PDF, factures d'achat avec pièce jointe, clients avec dates d'achat, recherche multi-critères, commandes prévisionnelles exportables en PDF, catalogue produits 11 catégories, logo extrait du PDF fourni).

Work Log:
- Extrait le logo ETS LAMP FALL du PDF `upload/ets lamp fall.pdf` via PyMuPDF → `public/logo.png` (PNG haute résolution 1739x1485).
- Installé `jspdf` + `jspdf-autotable` (génération PDF côté client).
- Défini le thème vert (charte du logo) dans `src/app/globals.css` (variables oklch, sidebar vert foncé, scrollbars personnalisées).
- Mis à jour `src/app/layout.tsx` (lang fr, métadonnées, favicon logo).
- Écrit `prisma/schema.prisma` : modèles Client, Product, Invoice (+InvoiceItem), Purchase (+PurchaseItem), Order (+OrderItem). Push DB SQLite.
- Créé `prisma/seed.ts` (23 produits toutes catégories, 6 clients, 10 factures/proformas, 3 achats, 3 commandes) et exécuté.
- Créé `src/lib/constants.ts` (catégories, statuts, formateurs FCFA/dates, numérotation FV/PF/FA/CMD-année-0001).
- Créé `src/lib/types.ts` (types partagés frontend/API) et `src/hooks/use-fetch.ts` (fetch + debounce).
- Créé `src/lib/pdf.ts` : facture/proforma PDF (en-tête logo, badges statuts, tableau articles, TVA, totaux, montant en lettres français, filigrane PAYÉ/PROFORMA, pied de page), bon de commande, liste des commandes, bon d'achat, listes de factures.
- API routes : `/api/clients` (CRUD), `/api/products` (CRUD + filtres), `/api/invoices` (CRUD + filtres q/statuts/dates/montants/clientId + numérotation auto + décrément stock en transaction), `/api/invoices/[id]/convert` (proforma→vente), `/api/purchases` (multipart avec upload fichier vers `db/uploads/` + incrément stock), `/api/purchases/[id]/file` (service pièce jointe), `/api/orders` (CRUD + filtres), `/api/orders/[id]/convert` (commande→facture), `/api/dashboard` (stats, CA 6 mois, top catégories, alertes stock).
- UI (shadcn/ui) : `app-shell.tsx` (sidebar verte desktop + drawer mobile + footer sticky mt-auto), `dashboard-view.tsx`, `invoices-view.tsx` (résumés, recherche q, filtres paiement/livraison/dates/montants, export PDF liste, menus d'actions), `invoice-dialog.tsx`, `items-editor.tsx` (éditeur d'articles avec sélecteur catalogue + articles libres), `clients-view.tsx` (CRUD + historique des achats par client), `products-view.tsx`, `purchases-view.tsx` (upload scan PDF/image ≤5 Mo), `orders-view.tsx` (+ conversion en facture), `status-badges.tsx`.
- Corrigé : filigrane jsPDF qui ne réinitialisait pas l'opacité GState (contenu délavé) ; seed dont les items n'avaient pas productId (stock non décrémenté à la conversion) ; graphique mensuel (hauteurs fixes) ; montants tronqués des cartes.
- Vérifié via agent-browser : dashboard (stats, graphique, alertes stock, dernières factures + PDF), création de facture FV-2026-0008 (TVA 18 % calculée, stock Cabine 4→3), PDF facture parfait (badges, totaux, montant en lettres), conversion proforma→facture, export liste commandes (aucune erreur console), bon de commande PDF, achat avec upload + ouverture de la pièce jointe, suppression achat, recherche "Diop" (2 factures), filtre montant min (1 facture), vue produits 11 catégories, historique client avec dates d'achat, responsive mobile 390px (menu drawer, cartes 2 colonnes, footer naturellement poussé).
- Lint final : 0 erreur, 0 warning. dev.log : aucune erreur runtime.

Stage Summary:
- Application complète sur la seule route `/` (navigation par vues), stack Next.js 16 + TypeScript + Prisma/SQLite + shadcn/ui + Tailwind 4 + jsPDF.
- Tous les besoins exprimés sont couverts : statuts livré/non livré et payé/partiel/non payé, proforma convertissable, factures PDF téléchargeables/visualisables, factures d'achat archivées avec pièce jointe, clients avec historique et dates d'achat, recherche par numéro/nom/montant/date, commandes prévisionnelles avec liste exportable en PDF et conversion en facture, catalogue des 11 catégories demandées, logo ETS LAMP FALL intégré (app + PDF).
- Données de démonstration réalistes (FCFA, clients et produits sénégalais) rechargées après correction du seed.
