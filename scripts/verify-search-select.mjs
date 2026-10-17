/**
 * Vérification Playwright — barres de recherche client/fournisseur
 * sur les onglets Facture, Proforma, Commandes, Commerçant, Immo, Achats
 * (+ recherche du répertoire sur Fournisseurs) + onglet « Situation client »
 * (recherche client, tableau des factures VENTE, génération PDF).
 *
 * Prérequis : serveur standalone démarré sur PORT, base seedée
 * (admin/admin123 + clients/fournisseurs de démonstration
 * + scripts/seed-situation-demo.mjs pour les factures d'Alioune Sow).
 */
import { chromium } from "playwright";

const BASE = process.env.BASE_URL || "http://localhost:3100";
const OUT = "/home/z/my-project/scripts/shots";
let ok = 0, fail = 0;

function check(name, cond) {
  if (cond) { ok++; console.log(`  ✅ ${name}`); }
  else { fail++; console.log(`  ❌ ${name}`); }
}

/**
 * La barre de recherche est un VRAI champ de saisie toujours visible :
 * on vérifie sa présence, on tape dedans, la liste déroulante filtre en
 * direct, la sélection affiche une puce et pré-remplit le champ Nom.
 */
async function openCreateAndSearch(page, { navTitle, createLabel, triggerAria, searchPlaceholder, searchTerm, expectedName, nameInputId, shot }) {
  // Navigation via la sidebar (bouton avec title = label complet)
  await page.locator(`nav[aria-label="Navigation principale"] button[title="${navTitle}"]`).click();
  await page.waitForTimeout(400);

  // Ouvrir l'écran de création
  const createBtn = page.getByRole("button", { name: createLabel }).first();
  await createBtn.click();
  await page.waitForTimeout(400);

  // La barre de recherche est un champ toujours visible (pas un bouton)
  const searchInput = page.locator(`input[role="combobox"][aria-label="${triggerAria}"]`).first();
  check(`[${navTitle}] barre de recherche toujours visible`, await searchInput.isVisible());
  const ph = await searchInput.getAttribute("placeholder");
  check(`[${navTitle}] placeholder de recherche affiché`, ph === searchPlaceholder);

  // Taper un terme : la liste se filtre en direct (l'item attendu apparaît)
  await searchInput.click();
  await searchInput.fill(searchTerm);
  await page.waitForTimeout(350);
  const options = page.locator('[role="listbox"] button[role="option"]:visible');
  const target = options.filter({ hasText: expectedName });
  const nTarget = await target.count();
  check(`[${navTitle}] filtrage actif (« ${searchTerm} » → « ${expectedName} » trouvé)`, nTarget === 1);
  await page.screenshot({ path: `${OUT}/${shot}`, fullPage: false });

  // Sélectionner le résultat attendu → puce de sélection affichée
  await target.first().click();
  await page.waitForTimeout(350);
  const chip = page.locator('button[aria-label="Désélectionner"]').first();
  check(`[${navTitle}] puce de sélection affichée`, await chip.isVisible());

  // Dans l'éditeur de facture/commande, le champ Nom du client est pré-rempli
  if (nameInputId) {
    const nameVal = await page.locator(`#${nameInputId}`).inputValue();
    check(`[${navTitle}] champ Nom du client pré-rempli`, nameVal === expectedName);
  }

  // Fermer l'écran de création (bouton retour = premier bouton icon du header)
  await page.locator('button[aria-label="Retour à la liste"], button:has-text("Annuler")').first().click();
  await page.waitForTimeout(300);
}

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  // ── Login ──────────────────────────────────────────────────────────────
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.locator("#username").fill("admin");
  await page.locator("#password").fill("admin123");
  await page.getByRole("button", { name: /Se connecter/ }).click();
  await page.waitForTimeout(1200);
  check("Connexion admin réussie", await page.locator('nav[aria-label="Navigation principale"]').isVisible());

  // ── Factures (VENTE) ───────────────────────────────────────────────────
  console.log("── Onglet Factures ──");
  await openCreateAndSearch(page, {
    navTitle: "Factures", createLabel: "Nouvelle facture",
    triggerAria: "Rechercher un client existant", searchPlaceholder: "Nom ou téléphone du client…",
    searchTerm: "ali", expectedName: "Alioune Sow", nameInputId: "inv-name", shot: "search-factures.png",
  });

  // ── Proforma ───────────────────────────────────────────────────────────
  console.log("── Onglet Proforma ──");
  await openCreateAndSearch(page, {
    navTitle: "Factures proforma", createLabel: "Nouveau proforma",
    triggerAria: "Rechercher un client existant", searchPlaceholder: "Nom ou téléphone du client…",
    searchTerm: "fatou", expectedName: "Fatou Ndiaye", nameInputId: "inv-name", shot: "search-proforma.png",
  });

  // ── Commandes ──────────────────────────────────────────────────────────
  console.log("── Onglet Commandes ──");
  await openCreateAndSearch(page, {
    navTitle: "Commandes prévisionnelles", createLabel: "Nouvelle commande",
    triggerAria: "Rechercher un client", searchPlaceholder: "Nom ou téléphone du client…",
    searchTerm: "keur", expectedName: "Promoteur Keur Dansa", nameInputId: "o-name", shot: "search-commandes.png",
  });

  // ── Commerçant (création à crédit, destination imposée) ────────────────
  console.log("── Onglet Commerçant ──");
  await openCreateAndSearch(page, {
    navTitle: "Commerçant — Achats à crédit", createLabel: "Nouvelle facture",
    triggerAria: "Rechercher un client existant", searchPlaceholder: "Nom ou téléphone du client…",
    searchTerm: "sène", expectedName: "Entreprise Sène & Fils", nameInputId: "inv-name", shot: "search-commercant.png",
  });

  // ── Immo ───────────────────────────────────────────────────────────────
  console.log("── Onglet Immo ──");
  await openCreateAndSearch(page, {
    navTitle: "Immo — Achats à crédit", createLabel: "Nouvelle facture",
    triggerAria: "Rechercher un client existant", searchPlaceholder: "Nom ou téléphone du client…",
    searchTerm: "78 400", expectedName: "Aïcha Bâ", nameInputId: null, shot: "search-immo.png",
  });

  // ── Achats (fournisseurs) ──────────────────────────────────────────────
  console.log("── Onglet Achats ──");
  await openCreateAndSearch(page, {
    navTitle: "Factures d'achat", createLabel: "Nouvel achat",
    triggerAria: "Rechercher un fournisseur du répertoire", searchPlaceholder: "Nom ou téléphone du fournisseur…",
    searchTerm: "ndiaye", expectedName: "Quincaillerie Ndiaye", nameInputId: null, shot: "search-achats.png",
  });

  // ── Fournisseurs : la liste du répertoire a déjà sa barre de recherche ──
  console.log("── Onglet Fournisseurs ──");
  await page.locator('nav[aria-label="Navigation principale"] button[title="Fournisseurs"]').click();
  await page.waitForTimeout(400);
  const supSearch = page.locator('input[placeholder="Rechercher un fournisseur…"]');
  check("[Fournisseurs] barre de recherche du répertoire présente", await supSearch.isVisible());
  await supSearch.fill("SENELEC");
  await page.waitForTimeout(1100); // debounce 350 ms + fetch serveur
  const cellVisible = await page.getByText("SENELEC", { exact: false }).first().isVisible().catch(() => false);
  check("[Fournisseurs] filtrage du répertoire actif", cellVisible);
  await page.screenshot({ path: `${OUT}/search-fournisseurs.png` });

  // ── Situation client ───────────────────────────────────────────────────
  console.log("── Onglet Situation client ──");
  await page.locator('nav[aria-label="Navigation principale"] button[title="Situation client"]').click();
  await page.waitForTimeout(500);

  const sitSearch = page.locator('input[role="combobox"][aria-label="Rechercher un client"]');
  check("[Situation] barre de recherche client visible", await sitSearch.isVisible());

  // État vide avant sélection
  check("[Situation] état vide « Aucun client sélectionné »",
    await page.getByText("Aucun client sélectionné").isVisible());

  // Recherche « senhotel-like » : taper « ali » → Alioune Sow
  await sitSearch.fill("ali");
  await page.waitForTimeout(350);
  const sitTarget = page.locator('[role="listbox"] button[role="option"]:visible').filter({ hasText: "Alioune Sow" });
  check("[Situation] recherche « ali » → Alioune Sow trouvé", await sitTarget.count() === 1);
  await sitTarget.first().click();
  await page.waitForTimeout(700); // chargement /api/invoices?clientId=

  // Synthèse des montants
  check("[Situation] carte « Total facturé » visible", await page.getByText("Total facturé").first().isVisible());
  check("[Situation] carte « Reste à payer » visible", await page.getByText("Reste à payer").first().isVisible());

  // Tableau : 5 factures VENTE attendues (la PROFORMA PF-…-9006 doit être exclue)
  const rows = page.locator('table tbody tr');
  const nRows = await rows.count();
  check(`[Situation] 5 factures VENTE listées (obtenu : ${nRows})`, nRows === 5);
  const bodyText = await page.locator('table').textContent();
  check("[Situation] proforma PF-2026-9006 exclue (Option A)", !bodyText.includes("PF-2026-9006"));
  check("[Situation] colonnes attendues présentes",
    bodyText.includes("N° facture") && bodyText.includes("Entreprise") && bodyText.includes("Montant TTC") && bodyText.includes("Livraison"));

  await page.screenshot({ path: `${OUT}/situation-client.png`, fullPage: true });

  // Génération du PDF « Situation client »
  const [download] = await Promise.all([
    page.waitForEvent("download", { timeout: 15000 }),
    page.getByRole("button", { name: /Générer le PDF/ }).click(),
  ]);
  const pdfName = download.suggestedFilename();
  check(`[Situation] PDF généré : ${pdfName}`, pdfName.startsWith("Situation-") && pdfName.endsWith(".pdf"));
  await download.saveAs(`${OUT}/${pdfName}`);
  check("[Situation] PDF téléchargeable sur le disque", await download.path() !== undefined);

  await browser.close();
  console.log(`\n════════ RÉSULTAT : ${ok} OK / ${fail} KO ════════`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
