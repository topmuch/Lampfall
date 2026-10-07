/**
 * Vérification Playwright — barre de recherche client/fournisseur
 * sur les onglets Facture, Proforma, Commandes, Commerçant, Immo, Achats
 * (+ présence de la recherche sur Fournisseurs).
 *
 * Prérequis : serveur standalone démarré sur PORT, base seedée
 * (admin/admin123 + clients/fournisseurs de démonstration).
 */
import { chromium } from "playwright";

const BASE = process.env.BASE_URL || "http://localhost:3100";
const OUT = "/home/z/my-project/scripts/shots";
let ok = 0, fail = 0;

function check(name, cond) {
  if (cond) { ok++; console.log(`  ✅ ${name}`); }
  else { fail++; console.log(`  ❌ ${name}`); }
}

async function openCreateAndSearch(page, { navTitle, createLabel, triggerAria, searchPlaceholder, searchTerm, expectedName, nameInputId, shot }) {
  // Navigation via la sidebar (bouton avec title = label complet)
  await page.locator(`nav[aria-label="Navigation principale"] button[title="${navTitle}"]`).click();
  await page.waitForTimeout(400);

  // Ouvrir l'écran de création
  const createBtn = page.getByRole("button", { name: createLabel }).first();
  await createBtn.click();
  await page.waitForTimeout(400);

  // La barre de recherche (combobox) est visible avec son placeholder
  const trigger = page.locator(`button[aria-label="${triggerAria}"]`).first();
  check(`[${navTitle}] combobox visible`, await trigger.isVisible());
  const btnText = await trigger.textContent();
  check(`[${navTitle}] placeholder « libre » affiché`, btnText.includes("libre"));

  // Ouvrir → champ de recherche filtrant
  await trigger.click();
  const searchInput = page.locator(`input[placeholder="${searchPlaceholder}"]`);
  check(`[${navTitle}] champ de recherche ouvert`, await searchInput.isVisible());

  // Taper un terme : la liste se filtre (l'item attendu apparaît)
  await searchInput.fill(searchTerm);
  await page.waitForTimeout(350);
  const options = page.locator('[cmdk-item]:visible');
  const target = options.filter({ hasText: expectedName });
  const nTarget = await target.count();
  check(`[${navTitle}] filtrage actif (« ${searchTerm} » → « ${expectedName} » trouvé)`, nTarget === 1);
  await page.screenshot({ path: `${OUT}/${shot}`, fullPage: false });

  // Sélectionner le résultat attendu
  await target.first().click();
  await page.waitForTimeout(350);
  const afterText = await page.locator(`button[aria-label="${triggerAria}"]`).first().textContent();
  check(`[${navTitle}] nom sélectionné affiché dans le bouton`, afterText.includes(expectedName));

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

  await browser.close();
  console.log(`\n════════ RÉSULTAT : ${ok} OK / ${fail} KO ════════`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
