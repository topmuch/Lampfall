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

---
Task ID: 2
Agent: Z.ai Code (principal)
Task: Lot d'améliorations demandé : (1) retirer le texte « Document prévisionnel — non valable comme facture définitive » du PDF proforma ; (2) retirer la colonne « Catégorie » des PDF facture/proforma ; (3) historique des achats client en pleine page (plus de modale) avec factures/proformas téléchargeables en PDF depuis l'historique ; (4) création/suppression de catégories dans Produits ; (5) image produit ; (6) nouvel onglet « Immo » (dossiers locataires : immeuble, loyer mensuel, mois, payé/non payé).

Work Log:
- Schéma Prisma : ajout des modèles `Category` (code/label dynamiques), `Tenant` + `Rent` (immobilier, unique tenantId+month) et du champ `Product.image` (data-URL). `bun run db:push` OK.
- Seed `prisma/seed-v2.ts` : upsert des 11 catégories d'origine en base + 3 dossiers immobiliers de démo (dont l'exemple exact de la demande : Moussa Diop / Immeuble F / 200 000 CFA / juillet non payé) + loyers sur plusieurs mois.
- API : `/api/categories` (GET avec productCount, POST avec code auto sans accents), `/api/categories/[code]` (DELETE bloqué si des produits l'utilisent), `/api/products` + `/api/products/[id]` (champ image via `sanitizeImage`, validation catégorie contre la base via `src/lib/product-validation.ts`), `/api/tenants` (GET incluant les loyers, POST), `/api/tenants/[id]` (PUT/DELETE), `/api/rents` (POST, mois AAAA-MM, doublon bloqué), `/api/rents/[id]` (PUT statut/montant, DELETE).
- PDF (`src/lib/pdf.ts`) : tableau des articles allégé (Désignation/Qté/PU/Total — plus de colonne Catégorie, pour facture, proforma, bon de commande et bon d'achat) ; texte proforma « non valable… » supprimé ; nouveaux documents `buildClientHistoryPDF` (historique des achats client), `buildRentReceiptPDF` (quittance payée / avis d'échéance non payée avec filigrane, montant en lettres, encadré statut) et `buildTenantRentsPDF` (échéancier des loyers).
- Front : nouveau `CategoriesProvider` (contexte React + repli statique si base vide) consommé par `CategoryBadge` (labels dynamiques), `products-view` et la gestion des catégories.
- `products-view.tsx` : bouton « Catégories » → dialog de gestion (créer, supprimer avec confirmation et erreur claire si produits rattachés) ; photo produit (choix fichier → redimensionnement canvas 640px JPEG → data-URL, aperçu, retrait) ; vignette image dans la liste.
- `client-detail-view.tsx` (nouveau) : fiche client pleine page — coordonnées, stats (achats, proformas, total facturé, reste à payer, dernier achat), historique complet avec badges paiement/livraison et boutons PDF (télécharger + afficher) par document, export « Historique PDF ». `clients-view.tsx` : navigation liste ↔ fiche (plus de modale d'historique), dialog d'édition factorisé.
- `immo-view.tsx` (nouveau) : stats (locataires, loyers attendus, encaissé du mois, impayés), recherche, cartes dossiers locataires (badge statut du mois courant + nb mois impayés), échéancier du locataire sélectionné (mois/montant/statut/réglé le, bascule payé↔non payé, quittance PDF, suppression), ajout d'échéance (mois + montant prérempli + statut), CRUD locataire, échéancier PDF exportable. Onglet « Immo » ajouté à la sidebar (icon Building2).
- Correctifs au passage : débordement horizontal en mobile (cards dashboard + panneau échéancier `overflow-hidden/min-w-0/overflow-auto` → scrollWidth 390/390 sur toutes les vues) ; erreur d'hydratation Radix (aria-controls useId) au premier chargement résolue via rendu du Sheet mobile après montage (`useSyncExternalStore`).
- Vérifié via agent-browser : PDF proforma sans disclaimer ni colonne catégorie (screenshot + extraction texte PyMuPDF), PDF facture idem, fiche client pleine page + téléchargement PDF individuel + export historique, catégories (création « Carrelage », suppression vide OK, suppression bloquée avec message), produit avec image (upload, aperçu, vignette liste), Immo complet (stats, échéancier Moussa Diop avec juillet non payé, bascule payé/non payé avec toast, quittance/avis PDF, ajout loyer octobre puis suppression, création locataire Fatou Sow), retour fiche→liste, mobile 390px toutes vues sans scroll horizontal, footer poussé naturellement.
- Lint final : 0 erreur, 0 warning. dev.log : aucune erreur runtime. Quittances/historique/échéancier validés par extraction texte (montant en lettres, statuts, dates de règlement).

Stage Summary:
- Les 6 demandes du lot sont livrées et vérifiées dans le navigateur : PDF proforma épuré (plus de mention « non valable », plus de catégorie), factures épurées, historique client en pleine page avec PDF téléchargeables par document et export d'historique, catégories produits dynamiques (création/suppression protégée), photo produit, et un module Immobilier complet avec quittances PDF.
- Nouveaux artefacts : `src/components/categories-provider.tsx`, `client-detail-view.tsx`, `immo-view.tsx`, `src/app/api/categories/*`, `src/app/api/tenants/*`, `src/app/api/rents/*`, `src/lib/product-validation.ts`, `prisma/seed-v2.ts`.
