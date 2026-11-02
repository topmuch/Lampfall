/**
 * Génération des PDF « État du stock » et « Inventaire périodique ».
 * Utilise jsPDF + autoTable (déjà installés dans le projet).
 * Identité visuelle identique aux factures et rapports (pdf.ts / pdf-reports.ts) :
 * police Times italique ×1,25, bandeau vert, en-tête société et pied de page.
 *
 * Le PDF respecte les filtres actifs de la vue : période (semaine, mensuel,
 * trimestriel, semestriel, annuel), catégorie et recherche produit.
 */

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { formatDate } from "@/lib/constants";
import { drawCompanyHeader, drawFooter, getDefaultCompanyInfo, type CompanyInfo } from "@/lib/pdf-reports";
import type { InventoryCategoryRow, InventoryProductRow } from "@/lib/types";

/* ─── Police identique aux factures (pdf.ts / pdf-reports.ts) ─────────────── */

type FontStyle = "normal" | "italic" | "bold" | "bolditalic";
type PdfFont = { name: string; normal: FontStyle; bold: FontStyle; scale?: number };

const FONT: PdfFont = { name: "times", normal: "italic", bold: "bolditalic", scale: 1.25 };
const K = FONT.scale ?? 1;

/* ─── Couleurs (charte ETS LAMP FALL, identiques à pdf.ts) ─────────────────── */

const GREEN = [30, 107, 58] as const;
const GREEN_BG = [240, 248, 243] as const; // zébrage lignes produits
const GREEN_HEAD = [222, 238, 228] as const; // lignes de sous-totaux catégorie
const GRAY = [105, 112, 108] as const;
const DARK = [35, 45, 40] as const;
const EMERALD = [5, 150, 105] as const;

/* ─── Formatage monétaire identique aux factures ───────────────────────────── */
/* Espaces normales uniquement : jsPDF ne rend pas les espaces insécables.     */

function fmtNum(n: number): string {
  const rounded = Math.round(n * 100) / 100;
  const [int, dec] = rounded.toString().split(".");
  const withSpaces = int.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return dec ? `${withSpaces},${dec}` : withSpaces;
}

function fmtMoney(n: number): string {
  return `${fmtNum(n)} FCFA`;
}

function signed(n: number): string {
  if (n > 0) return `+${fmtNum(n)}`;
  return fmtNum(n); // inclut le signe -
}

/* ─── Sanitisation du texte pour jsPDF (cf. pdf-reports.ts) ───────────────── */

function t(str: string): string {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // diacritiques combinés
    .replace(/\u0152/g, "OE") // Œ → OE
    .replace(/\u0153/g, "oe") // œ → oe
    .replace(/'/g, "'") // apostrophe courbe → droite
    .replace(/\u00A0/g, " "); // espace insécable → espace normale
}

/* ─── Types publics ────────────────────────────────────────────────────────── */

export interface InventoryPdfPeriod {
  type: string;
  label: string;
  startLabel: string;
  endLabel: string;
}

export interface InventoryPdfTotals {
  stockInitial: number;
  achats: number;
  ventes: number;
  retoursAjustements: number;
  stockFinal: number;
  valeurStockAchat: number;
  valeurStockVente: number;
  ventesValeur: number;
  marge: number;
}

export interface InventoryPdfOptions {
  /** « inventaire » (avec groupement par catégorie) ou « stock » (liste à plat) */
  variant: "inventaire" | "stock";
  period: InventoryPdfPeriod;
  /** Lignes produits (déjà filtrées par la vue) */
  rows: InventoryProductRow[];
  /** Agrégats par catégorie (uniquement en mode groupé « inventaire ») */
  categories?: InventoryCategoryRow[];
  groupBy?: "categorie" | "produit";
  totals: InventoryPdfTotals;
  productCount: number;
  /** Filtres appliqués, ex : « Catégorie : Plomberie · Recherche : coude » */
  filterLabel?: string | null;
  logoDataUrl?: string;
  companyInfo?: CompanyInfo;
}

/* ─── Cellules du tableau ──────────────────────────────────────────────────── */

const DASH = "-";

function productCells(
  r: InventoryProductRow,
  includeCategory: boolean,
  indent: boolean
): string[] {
  const name = r.reference ? `${r.name}\n${r.reference}` : r.name;
  const label = indent ? `   ${name}` : name;
  const cells = [
    t(label),
    r.stockInitial !== 0 ? fmtNum(r.stockInitial) : DASH,
    r.achats > 0 ? `+${fmtNum(r.achats)}` : DASH,
    r.ventes > 0 ? `-${fmtNum(r.ventes)}` : DASH,
    r.retoursAjustements !== 0 ? signed(r.retoursAjustements) : DASH,
    fmtNum(r.stockFinal),
    fmtMoney(r.purchasePrice),
    fmtMoney(r.salePrice),
    fmtMoney(r.valeurStockAchat),
  ];
  return includeCategory
    ? [cells[0], t(r.categoryLabel), ...cells.slice(1)]
    : cells;
}

function categoryCells(c: InventoryCategoryRow): string[] {
  return [
    t(`${c.label} (${c.productCount} produit${c.productCount > 1 ? "s" : ""})`),
    fmtNum(c.stockInitial),
    c.achats > 0 ? `+${fmtNum(c.achats)}` : DASH,
    c.ventes > 0 ? `-${fmtNum(c.ventes)}` : DASH,
    c.retoursAjustements !== 0 ? signed(c.retoursAjustements) : DASH,
    fmtNum(c.stockFinal),
    `${c.productCount} ref.`,
    DASH,
    fmtMoney(c.valeurStockAchat),
  ];
}

/* ─── Générateur ───────────────────────────────────────────────────────────── */

export function generateInventoryPdf(options: InventoryPdfOptions) {
  const {
    variant,
    period,
    rows,
    categories,
    groupBy = "produit",
    totals,
    productCount,
    filterLabel,
    logoDataUrl,
    companyInfo,
  } = options;

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

  // En-tête société (logo + infos)
  let y = drawCompanyHeader(doc, logoDataUrl, companyInfo);

  // Titre du rapport
  doc.setFont(FONT.name, FONT.bold);
  doc.setFontSize(14 * K);
  doc.setTextColor(...GREEN);
  doc.text(t(variant === "inventaire" ? "INVENTAIRE DE STOCK" : "ETAT DU STOCK"), 14, y);
  y += 6;

  doc.setFont(FONT.name, FONT.normal);
  doc.setFontSize(10 * K);
  doc.setTextColor(...GRAY);
  // Le libellé « Semaine du … au … » contient déjà les dates : pas de redondance.
  const periodLine =
    period.type === "semaine"
      ? `Periode : ${period.label}`
      : `Periode : ${period.label} (du ${period.startLabel} au ${period.endLabel})`;
  doc.text(t(periodLine), 14, y);
  y += 5;
  if (filterLabel) {
    doc.text(t(`Filtres : ${filterLabel}`), 14, y);
    y += 5;
  }
  doc.text(t(`Genere le ${formatDate(new Date())}`), 14, y);
  y += 8;

  // Synthèse valorisée (2 lignes × 2 colonnes)
  doc.setFont(FONT.name, FONT.bold);
  doc.setFontSize(8.5 * K);
  doc.setTextColor(...DARK);
  doc.text(t(`Valeur stock final (achat) : ${fmtMoney(totals.valeurStockAchat)}`), 14, y);
  doc.setTextColor(...GREEN);
  doc.text(t(`Valeur stock final (vente) : ${fmtMoney(totals.valeurStockVente)}`), 150, y);
  y += 5;
  doc.setTextColor(...GRAY);
  doc.text(t(`CA des ventes (periode) : ${fmtMoney(totals.ventesValeur)}`), 14, y);
  doc.setTextColor(...EMERALD);
  doc.text(t(`Marge estimee : ${fmtMoney(totals.marge)}`), 150, y);
  y += 7;

  // Tableau — groupé par catégorie (inventaire) ou à plat (stock / par produit)
  const grouped =
    variant === "inventaire" &&
    groupBy === "categorie" &&
    Array.isArray(categories) &&
    categories.length > 0;

  const body: string[][] = [];
  const catRowIdx = new Set<number>();

  if (grouped) {
    for (const c of categories!) {
      catRowIdx.add(body.length);
      body.push(categoryCells(c));
      for (const r of c.products) body.push(productCells(r, false, true));
    }
  } else {
    for (const r of rows) body.push(productCells(r, true, false));
  }

  const totalLabel = t(
    `Total general (${productCount} produit${productCount > 1 ? "s" : ""})`
  );
  const totalQtyCells = [
    fmtNum(totals.stockInitial),
    totals.achats > 0 ? `+${fmtNum(totals.achats)}` : DASH,
    totals.ventes > 0 ? `-${fmtNum(totals.ventes)}` : DASH,
    totals.retoursAjustements !== 0 ? signed(totals.retoursAjustements) : DASH,
    fmtNum(totals.stockFinal),
  ];
  const foot = grouped
    ? [totalLabel, ...totalQtyCells, DASH, DASH, fmtMoney(totals.valeurStockAchat)]
    : [{ content: totalLabel, colSpan: 2 }, ...totalQtyCells, DASH, DASH, fmtMoney(totals.valeurStockAchat)];

  autoTable(doc, {
    startY: y,
    margin: { left: 14, right: 14, top: 12, bottom: 12 },
    head: [
      grouped
        ? [
            t("Produit"),
            t("Stock initial"),
            t("Achats"),
            t("Ventes"),
            t("Retours / Ajust."),
            t("Stock final"),
            t("Prix achat"),
            t("Prix vente"),
            t("Valeur stock"),
          ]
        : [
            t("Produit"),
            t("Categorie"),
            t("Stock initial"),
            t("Achats"),
            t("Ventes"),
            t("Retours / Ajust."),
            t("Stock final"),
            t("Prix achat"),
            t("Prix vente"),
            t("Valeur stock"),
          ],
    ],
    body,
    foot: [foot],
    styles: {
      font: FONT.name,
      fontStyle: FONT.normal,
      fontSize: 7.5 * K,
      textColor: DARK as unknown as number[],
      cellPadding: 1.6,
      valign: "middle",
    },
    headStyles: {
      fillColor: GREEN as unknown as number[],
      textColor: [255, 255, 255],
      fontStyle: FONT.bold,
      fontSize: 7.5 * K,
      halign: "center",
    },
    footStyles: {
      fillColor: GREEN as unknown as number[],
      textColor: [255, 255, 255],
      fontStyle: FONT.bold,
      fontSize: 7.5 * K,
    },
    alternateRowStyles: { fillColor: GREEN_BG as unknown as number[] },
    columnStyles: grouped
      ? {
          0: { cellWidth: 72 },
          1: { halign: "right", cellWidth: 24 },
          2: { halign: "right", cellWidth: 22 },
          3: { halign: "right", cellWidth: 22 },
          4: { halign: "right", cellWidth: 26 },
          5: { halign: "right", cellWidth: 24 },
          6: { halign: "right", cellWidth: 26 },
          7: { halign: "right", cellWidth: 26 },
          8: { halign: "right", cellWidth: 27 },
        }
      : {
          0: { cellWidth: 52 },
          1: { cellWidth: 28 },
          2: { halign: "right", cellWidth: 22 },
          3: { halign: "right", cellWidth: 20 },
          4: { halign: "right", cellWidth: 20 },
          5: { halign: "right", cellWidth: 24 },
          6: { halign: "right", cellWidth: 22 },
          7: { halign: "right", cellWidth: 25 },
          8: { halign: "right", cellWidth: 25 },
          9: { halign: "right", cellWidth: 31 },
        },
    didParseCell: (data) => {
      if (data.section === "body" && catRowIdx.has(data.row.index)) {
        data.cell.styles.fillColor = GREEN_HEAD as unknown as number[];
        data.cell.styles.fontStyle = FONT.bold;
        data.cell.styles.textColor = DARK as unknown as number[];
      }
    },
  });

  // Note de calcul sous le tableau
  type LastAutoTableDoc = jsPDF & { lastAutoTable?: { finalY: number } };
  const finalY = (doc as LastAutoTableDoc).lastAutoTable?.finalY ?? y;
  const pageHeight = doc.internal.pageSize.getHeight();
  const noteY = Math.min(finalY + 5, pageHeight - 10);
  doc.setFont(FONT.name, FONT.normal);
  doc.setFontSize(7 * K);
  doc.setTextColor(...GRAY);
  doc.text(
    t(
      "Stock final = Stock initial + Achats - Ventes + Retours & ajustements. " +
        "Prix d'achat / prix de vente par unite - montants en FCFA. " +
        "Valeur stock valorisee au prix d'achat."
    ),
    14,
    noteY
  );

  // Pied de page (toutes les pages)
  drawFooter(doc, companyInfo ?? getDefaultCompanyInfo());

  // Téléchargement
  const stamp = `${period.startLabel.replace(/\//g, "-")}_${period.endLabel.replace(/\//g, "-")}`;
  doc.save(
    variant === "inventaire"
      ? `inventaire-${period.type}-${stamp}.pdf`
      : `etat-stock-${period.type}-${stamp}.pdf`
  );
}
