/**
 * Utilitaire de génération de rapports PDF pour les dépôts et retraits clients.
 * Utilise jsPDF + autoTable (déjà installés dans le projet).
 * Inclut le logo et les infos de la société dans l'en-tête.
 *
 * Harmonisation : la police et la disposition des montants sont identiques
 * à celles des factures (pdf.ts) — Times italique, gras italique, échelle ×1,25.
 */

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { formatDate, PAYMENT_METHOD_LABELS, COMPANY } from "@/lib/constants";
import type { ClientDeposit, ClientWithdrawal } from "@/lib/types";

/* ─── Police identique aux factures (pdf.ts) ──────────────────────────────── */

type FontStyle = "normal" | "italic" | "bold" | "bolditalic";
type PdfFont = { name: string; normal: FontStyle; bold: FontStyle; scale?: number };

/** Même police que les factures : Times, italique / gras italique, ×1,25. */
const FONT: PdfFont = { name: "times", normal: "italic", bold: "bolditalic", scale: 1.25 };
const K = FONT.scale ?? 1;

/* ─── Couleurs (charte ETS LAMP FALL, identiques à pdf.ts) ─────────────────── */

const GREEN = [30, 107, 58] as const;
const GREEN_LIGHT = [113, 172, 131] as const;
const GREEN_BG = [240, 248, 243] as const;
const RED = [192, 43, 43] as const;
const AMBER = [180, 83, 9] as const;
const GRAY = [105, 112, 108] as const;
const DARK = [35, 45, 40] as const;

/* ─── Formatage monétaire identique aux factures (pdf.ts) ─────────────────── */
/* Intl.NumberFormat(« fr-FR ») insère des espaces insécables (\u00A0) que    */
/* jsPDF ne sait pas rendre → elles s'affichent comme « / ». On utilise       */
/* donc un formatage manuel avec des espaces normales, comme pdf.ts.           */

function fmtNum(n: number): string {
  const rounded = Math.round(n * 100) / 100;
  const [int, dec] = rounded.toString().split(".");
  const withSpaces = int.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return dec ? `${withSpaces},${dec}` : withSpaces;
}

function fmtMoney(n: number): string {
  return `${fmtNum(n)} FCFA`;
}

/* ─── Sanitisation du texte pour jsPDF ────────────────────────────────────── */

/**
 * Remplace les caractères accentués français par leurs équivalents ASCII.
 * jsPDF avec la police Times ne supporte pas tous les caractères Unicode —
 * cette fonction assure un rendu correct.
 */
function t(str: string): string {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Supprime les diacritiques combinés
    .replace(/\u0152/g, "OE")         // Œ → OE
    .replace(/\u0153/g, "oe")         // œ → oe
    .replace(/\u00C6/g, "AE")         // Æ → AE
    .replace(/\u00E6/g, "ae")         // æ → ae
    .replace(/\u00DF/g, "ss")         // ß → ss
    .replace(/'/g, "'")              // Apostrophe courbe → droite
    .replace(/\u00A0/g, " ");          // Espace insécable → espace normale
}

/* ─── Infos société pour le PDF ──────────────────────────────────────────── */

export interface CompanyInfo {
  name: string;
  tagline: string;
  address: string;
  phone: string;
  email: string;
  rc?: string;
  ninea?: string;
}

/** Récupère les infos société par défaut depuis les constantes. */
export function getDefaultCompanyInfo(): CompanyInfo {
  return {
    name: COMPANY.name,
    tagline: COMPANY.tagline,
    address: COMPANY.address,
    phone: COMPANY.phone,
    email: COMPANY.email,
    ninea: COMPANY.ninea,
  };
}

/* ─── Filtres de période ─────────────────────────────────────────────────── */

export type Period = "jour" | "semaine" | "mois" | "annee";

export const PERIOD_LABELS: Record<Period, string> = {
  jour: "Journalier",
  semaine: "Hebdomadaire",
  mois: "Mensuel",
  annee: "Annuel",
};

/** Retourne la date de début de la période contenant `refDate`. */
export function periodStart(refDate: Date, period: Period): Date {
  const d = new Date(refDate);
  switch (period) {
    case "jour":
      return new Date(d.getFullYear(), d.getMonth(), d.getDate());
    case "semaine": {
      const day = d.getDay();
      const diff = day === 0 ? 6 : day - 1; // lundi = début de semaine
      const start = new Date(d.getFullYear(), d.getMonth(), d.getDate() - diff);
      return start;
    }
    case "mois":
      return new Date(d.getFullYear(), d.getMonth(), 1);
    case "annee":
      return new Date(d.getFullYear(), 0, 1);
  }
}

/** Retourne la date de fin (exclusive) de la période. */
export function periodEnd(start: Date, period: Period): Date {
  const s = new Date(start);
  switch (period) {
    case "jour":
      return new Date(s.getFullYear(), s.getMonth(), s.getDate() + 1);
    case "semaine":
      return new Date(s.getFullYear(), s.getMonth(), s.getDate() + 7);
    case "mois":
      return new Date(s.getFullYear(), s.getMonth() + 1, 1);
    case "annee":
      return new Date(s.getFullYear() + 1, 0, 1);
  }
}

/** Filtre un tableau d'éléments par date (propriété `dateField`) dans la période. */
function filterByPeriod<T extends Record<string, unknown>>(
  items: T[],
  dateField: keyof T,
  period: Period,
  refDate?: Date
): T[] {
  const ref = refDate ?? new Date();
  const start = periodStart(ref, period);
  const end = periodEnd(start, period);
  return items.filter((item) => {
    const d = new Date(item[dateField] as string);
    return d >= start && d < end;
  });
}

/* ─── Dessiner l'en-tête société (logo + infos) — même style que factures ─── */

function drawCompanyHeader(
  doc: jsPDF,
  logoDataUrl?: string,
  companyInfo?: CompanyInfo
): number {
  const info = companyInfo ?? getDefaultCompanyInfo();
  const pageWidth = doc.internal.pageSize.getWidth();

  // Bandeau vert fin en haut (identique aux factures)
  doc.setFillColor(...GREEN);
  doc.rect(0, 0, pageWidth, 3, "F");

  let currentY = 8;

  // Logo — on essaie de l'ajouter si data URL fournie
  let logoWidth = 0;
  if (logoDataUrl) {
    try {
      const logoW = 30;
      const logoH = 25.6;
      const format = logoDataUrl.includes("image/jpeg") || logoDataUrl.includes("image/jpg") ? "JPEG" : "PNG";
      doc.addImage(logoDataUrl, format, 14, currentY, logoW, logoH);
      logoWidth = logoW;
    } catch {
      // Si l'image ne peut pas être ajoutée, on continue sans logo
    }
  }

  // Infos société à droite du logo (identique aux factures)
  const textX = logoWidth > 0 ? 14 + logoWidth + 4 : 14;

  doc.setFont(FONT.name, FONT.bold);
  doc.setFontSize(14 * K);
  doc.setTextColor(...DARK);
  doc.text(t(info.name), textX, currentY + 7);

  doc.setFont(FONT.name, FONT.normal);
  doc.setFontSize(8.5 * K);
  doc.setTextColor(...GREEN);
  let hy = currentY + 12;
  if (info.tagline) {
    doc.text(t(info.tagline), textX, hy);
    hy += 4;
  }
  doc.setTextColor(...GRAY);
  if (info.address) {
    doc.text(t(info.address), textX, hy);
    hy += 4;
  }
  if (info.phone) {
    doc.text(t(`Tel : ${info.phone}`), textX, hy);
    hy += 4;
  }
  if (info.email) {
    doc.text(t(info.email), textX, hy);
    hy += 4;
  }
  const idParts: string[] = [];
  if (info.rc) idParts.push(`RC : ${info.rc}`);
  if (info.ninea) idParts.push(`NINEA : ${info.ninea}`);
  if (idParts.length > 0) {
    doc.setFontSize(7.5 * K);
    doc.text(t(idParts.join("  -  ")), textX, hy);
  }

  // Ligne de séparation (identique aux factures)
  const headerBottom = 40;
  doc.setDrawColor(...GREEN);
  doc.setLineWidth(0.6);
  doc.line(14, headerBottom, pageWidth - 14, headerBottom);
  doc.setDrawColor(...GREEN_LIGHT);
  doc.setLineWidth(0.25);
  doc.line(14, headerBottom + 1.2, pageWidth - 14, headerBottom + 1.2);

  return headerBottom + 4; // Y position après l'en-tête
}

/* ─── Dessiner le pied de page (identique aux factures) ────────────────────── */

function drawFooter(doc: jsPDF, info: CompanyInfo) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const pageCount = doc.getNumberOfPages();

  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    const y = 288;
    doc.setDrawColor(...GREEN);
    doc.setLineWidth(0.4);
    doc.line(14, y - 4, pageWidth - 14, y - 4);
    doc.setFont(FONT.name, FONT.normal);
    doc.setFontSize(7);
    doc.setTextColor(...GRAY);
    const legal = [info.rc ? `RC : ${info.rc}` : "", info.ninea ? `NINEA : ${info.ninea}` : ""]
      .filter(Boolean)
      .join(" - ");
    const line1 = [info.name, info.tagline, info.phone ? `Tel : ${info.phone}` : "", info.email, legal]
      .filter(Boolean)
      .join(" - ");
    doc.text(t(line1), pageWidth / 2, y, { align: "center" });
    doc.text(t("Merci de votre confiance !"), pageWidth / 2, y + 3.5, { align: "center" });
    doc.text(`Page ${i}/${pageCount}`, pageWidth - 14, y, { align: "right" });
  }
}

/* ─── Rapport PDF Depots ─────────────────────────────────────────────────── */

export function generateDepositsPdf(
  deposits: ClientDeposit[],
  period: Period,
  refDate?: Date,
  logoDataUrl?: string,
  companyInfo?: CompanyInfo
) {
  const ref = refDate ?? new Date();
  const start = periodStart(ref, period);
  const end = periodEnd(start, period);
  const filtered = filterByPeriod<ClientDeposit>(deposits, "date", period, ref);

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const info = companyInfo ?? getDefaultCompanyInfo();

  // En-tête société (logo + infos)
  let y = drawCompanyHeader(doc, logoDataUrl, companyInfo);

  // Titre du rapport
  doc.setFont(FONT.name, FONT.bold);
  doc.setFontSize(14 * K);
  doc.setTextColor(...GREEN);
  doc.text(t("RAPPORT DEPOTS CLIENTS"), 14, y);
  y += 6;

  doc.setFont(FONT.name, FONT.normal);
  doc.setFontSize(10 * K);
  doc.setTextColor(...GRAY);
  doc.text(
    t(`Periode : ${PERIOD_LABELS[period]} - du ${formatDate(start.toISOString())} au ${formatDate(new Date(end.getTime() - 1).toISOString())}`),
    14,
    y
  );
  y += 5;
  doc.text(t(`Genere le ${formatDate(new Date().toISOString())}`), 14, y);
  y += 8;

  // Stats
  const totalDeposed = filtered.reduce((s, d) => s + d.amount, 0);
  const totalWithdrawn = filtered.reduce(
    (s, d) => s + (d.withdrawals?.reduce((s2, w) => s2 + w.amount, 0) ?? 0),
    0
  );
  const balance = totalDeposed - totalWithdrawn;

  doc.setFont(FONT.name, FONT.bold);
  doc.setFontSize(10 * K);
  doc.setTextColor(...GREEN);
  doc.text(t(`Total depose : ${fmtMoney(totalDeposed)}`), 14, y);
  doc.setTextColor(...AMBER);
  doc.text(t(`Total retire : ${fmtMoney(totalWithdrawn)}`), 100, y);
  doc.setTextColor(5, 150, 105);
  doc.text(t(`Solde a rendre : ${fmtMoney(balance)}`), 200, y);
  y += 6;

  // Tableau
  const rows = filtered.map((d) => {
    const tw = d.withdrawals?.reduce((s, w) => s + w.amount, 0) ?? 0;
    const rem = d.amount - tw;
    const status =
      rem <= 0.009 ? "Solde" : tw > 0 ? "Retrait partiel" : "Non retire";
    return [
      t(`${d.firstName} ${d.lastName}`),
      d.phone || "-",
      formatDate(d.date),
      fmtMoney(d.amount),
      t(PAYMENT_METHOD_LABELS[d.method] ?? d.method),
      fmtMoney(tw),
      fmtMoney(rem),
      t(status),
    ];
  });

  autoTable(doc, {
    startY: y,
    head: [[t("Client"), t("Tel."), t("Date depot"), t("Montant"), t("Mode"), t("Retire"), t("Restant"), t("Statut")]],
    body: rows,
    styles: {
      font: FONT.name,
      fontStyle: FONT.normal,
      fontSize: 8 * K,
      textColor: DARK as unknown as number[],
      cellPadding: 2,
    },
    headStyles: { fillColor: GREEN as unknown as number[], textColor: [255, 255, 255], fontStyle: FONT.bold },
    alternateRowStyles: { fillColor: GREEN_BG as unknown as number[] },
    columnStyles: {
      3: { halign: "right", fontStyle: FONT.bold },
      5: { halign: "right" },
      6: { halign: "right", fontStyle: FONT.bold },
    },
  });

  drawFooter(doc, info);
  doc.save(`rapport-depots-${period}-${start.toISOString().slice(0, 10)}.pdf`);
}

/* ─── Rapport PDF Retraits ───────────────────────────────────────────────── */

type WithdrawalRow = ClientWithdrawal & {
  depositFirstName: string;
  depositLastName: string;
  depositPhone: string | null;
  depositMethod: string;
  depositAmount: number;
  depositDate: string;
};

export function generateWithdrawalsPdf(
  withdrawals: WithdrawalRow[],
  period: Period,
  refDate?: Date,
  logoDataUrl?: string,
  companyInfo?: CompanyInfo
) {
  const ref = refDate ?? new Date();
  const start = periodStart(ref, period);
  const end = periodEnd(start, period);
  const filtered = filterByPeriod<WithdrawalRow>(withdrawals, "date", period, ref);

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const info = companyInfo ?? getDefaultCompanyInfo();

  // En-tête société (logo + infos)
  let y = drawCompanyHeader(doc, logoDataUrl, companyInfo);

  // Titre du rapport
  doc.setFont(FONT.name, FONT.bold);
  doc.setFontSize(14 * K);
  doc.setTextColor(...AMBER);
  doc.text(t("RAPPORT RETRAITS CLIENTS"), 14, y);
  y += 6;

  doc.setFont(FONT.name, FONT.normal);
  doc.setFontSize(10 * K);
  doc.setTextColor(...GRAY);
  doc.text(
    t(`Periode : ${PERIOD_LABELS[period]} - du ${formatDate(start.toISOString())} au ${formatDate(new Date(end.getTime() - 1).toISOString())}`),
    14,
    y
  );
  y += 5;
  doc.text(t(`Genere le ${formatDate(new Date().toISOString())}`), 14, y);
  y += 8;

  // Stats
  const totalWithdrawn = filtered.reduce((s, w) => s + w.amount, 0);

  doc.setFont(FONT.name, FONT.bold);
  doc.setFontSize(10 * K);
  doc.setTextColor(...AMBER);
  doc.text(t(`Total retire : ${fmtMoney(totalWithdrawn)}`), 14, y);
  doc.text(t(`${filtered.length} retrait(s)`), 100, y);
  y += 6;

  // Tableau
  const rows = filtered.map((w) => [
    t(`${w.depositFirstName} ${w.depositLastName}`),
    w.depositPhone || "-",
    formatDate(w.date),
    fmtMoney(w.amount),
    t(w.note || "-"),
    fmtMoney(w.depositAmount),
    t(PAYMENT_METHOD_LABELS[w.depositMethod] ?? w.depositMethod),
    formatDate(w.depositDate),
  ]);

  autoTable(doc, {
    startY: y,
    head: [[t("Client"), t("Tel."), t("Date retrait"), t("Montant retire"), t("Note"), t("Depot origine"), t("Mode depot"), t("Date depot")]],
    body: rows,
    styles: {
      font: FONT.name,
      fontStyle: FONT.normal,
      fontSize: 8 * K,
      textColor: DARK as unknown as number[],
      cellPadding: 2,
    },
    headStyles: { fillColor: AMBER as unknown as number[], textColor: [255, 255, 255], fontStyle: FONT.bold },
    alternateRowStyles: { fillColor: [255, 251, 240] },
    columnStyles: {
      3: { halign: "right", fontStyle: FONT.bold },
      5: { halign: "right" },
    },
  });

  drawFooter(doc, info);
  doc.save(`rapport-retraits-${period}-${start.toISOString().slice(0, 10)}.pdf`);
}

/* ─── Reçu PDF — Dépôt unique ───────────────────────────────────────────── */

export function generateDepositReceiptPdf(
  deposit: ClientDeposit,
  logoDataUrl?: string,
  companyInfo?: CompanyInfo
) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const info = companyInfo ?? getDefaultCompanyInfo();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;

  // ── En-tête société (logo + infos) — identique aux factures
  let y = drawCompanyHeader(doc, logoDataUrl, companyInfo);

  // ── Titre du reçu
  y += 2;
  doc.setFont(FONT.name, FONT.bold);
  doc.setFontSize(20 * Math.min(K, 1.2));
  doc.setTextColor(...GREEN);
  doc.text(t("RECU DE DEPOT"), pageWidth - margin, y, { align: "right" });
  y += 5;

  // ── N° reçu + date
  const receiptNum = `DPT-${deposit.id.slice(-6).toUpperCase()}`;
  doc.setFont(FONT.name, FONT.normal);
  doc.setFontSize(8.5 * K);
  doc.setTextColor(...GRAY);
  doc.text(t(`N. Recu : ${receiptNum}`), margin, y);
  doc.text(t(`Date : ${formatDate(new Date().toISOString())}`), pageWidth - margin, y, { align: "right" });
  y += 8;

  // ── Infos client (style identique aux factures : "FACTURER À")
  doc.setFont(FONT.name, FONT.bold);
  doc.setFontSize(8 * K);
  doc.setTextColor(...GRAY);
  doc.text(t("CLIENT"), margin, y);
  doc.setFontSize(11 * K);
  doc.setTextColor(...DARK);
  const clientName = `${deposit.firstName} ${deposit.lastName}`;
  doc.text(t(clientName), margin, y + 6);
  doc.setFont(FONT.name, FONT.normal);
  doc.setFontSize(8.5 * K);
  doc.setTextColor(...GRAY);
  let cy = y + 12;
  if (deposit.phone) {
    doc.text(t(`Tel : ${deposit.phone}`), margin, cy);
    cy += 5;
  }

  y = cy + 4;

  // ── Détails de la transaction (disposition label/valeur comme facture)
  doc.setFont(FONT.name, FONT.bold);
  doc.setFontSize(8 * K);
  doc.setTextColor(...GRAY);
  doc.text(t("DETAILS DU DEPOT"), margin, y);
  y += 6;

  // Date du dépôt
  doc.setFont(FONT.name, FONT.bold);
  doc.setFontSize(9 * K);
  doc.setTextColor(...DARK);
  doc.text(t("Date du depot :"), margin, y);
  doc.setFont(FONT.name, FONT.normal);
  doc.text(formatDate(deposit.date), margin + 50, y);
  y += 7;

  // Mode de paiement
  doc.setFont(FONT.name, FONT.bold);
  doc.text(t("Mode de paiement :"), margin, y);
  doc.setFont(FONT.name, FONT.normal);
  doc.text(t(PAYMENT_METHOD_LABELS[deposit.method] ?? deposit.method), margin + 50, y);
  y += 7;

  if (deposit.notes) {
    doc.setFont(FONT.name, FONT.bold);
    doc.text(t("Notes :"), margin, y);
    doc.setFont(FONT.name, FONT.normal);
    const notesLines = doc.splitTextToSize(t(deposit.notes), contentWidth - 50);
    doc.text(notesLines, margin + 50, y);
    y += notesLines.length * 5 + 2;
  }

  // ── Montant — disposition identique aux factures (label gauche, valeur droite, fond vert)
  y += 4;
  const totalsX = 122;
  const rowH = 7;

  const totalRow = (label: string, value: string, opts?: { bold?: boolean; color?: number[]; fill?: number[] }) => {
    if (opts?.fill) {
      doc.setFillColor(...(opts.fill as [number, number, number]));
      doc.rect(totalsX, y - 5.2, pageWidth - margin - totalsX, rowH, "F");
    }
    doc.setFont(FONT.name, opts?.bold ? FONT.bold : FONT.normal);
    doc.setFontSize(9 * K);
    doc.setTextColor(...(opts?.color ?? (DARK as unknown as number[])));
    doc.text(t(label), totalsX + 2, y);
    doc.text(value, pageWidth - margin - 2, y, { align: "right" });
    y += rowH;
  };

  totalRow(t("Montant depose"), fmtMoney(deposit.amount), {
    bold: true,
    color: GREEN as unknown as number[],
    fill: GREEN_BG as unknown as number[],
  });

  // ── Historique retraits (si applicable) — même style de totaux que facture
  const totalWithdrawn = deposit.withdrawals?.reduce((s, w) => s + w.amount, 0) ?? 0;
  const remaining = Math.max(0, deposit.amount - totalWithdrawn);

  if (totalWithdrawn > 0) {
    // Ligne séparatrice verte (comme entre Total HT et Total TTC sur la facture)
    doc.setDrawColor(...GREEN);
    doc.setLineWidth(0.4);
    doc.line(totalsX, y - 5.3, pageWidth - margin, y - 5.3);

    totalRow(t("Total retire"), fmtMoney(totalWithdrawn), {
      color: AMBER as unknown as number[],
    });

    totalRow(t("Solde restant"), fmtMoney(remaining), {
      bold: true,
      color: GREEN as unknown as number[],
    });

    // Tableau des retraits
    y += 4;
    if (deposit.withdrawals && deposit.withdrawals.length > 0) {
      autoTable(doc, {
        startY: y,
        margin: { left: margin, right: margin },
        head: [[t("Date"), t("Montant retire"), t("Note")]],
        body: deposit.withdrawals.map((w) => [
          formatDate(w.date),
          fmtMoney(w.amount),
          t(w.note || "-"),
        ]),
        styles: {
          font: FONT.name,
          fontStyle: FONT.normal,
          fontSize: 8 * K,
          textColor: DARK as unknown as number[],
          cellPadding: 2,
        },
        headStyles: { fillColor: AMBER as unknown as number[], textColor: [255, 255, 255], fontStyle: FONT.bold },
        columnStyles: { 1: { halign: "right", fontStyle: FONT.bold } },
      });
      const finalY = (doc as unknown as Record<string, { finalY: number }>).lastAutoTable?.finalY;
      if (finalY && Number.isFinite(finalY)) {
        y = finalY;
      } else {
        y += 30;
      }
      y += 4;
    }
  }

  // ── Bloc « arrêté à la somme de » / signature (identique aux factures)
  let by = y + 6;
  const words = amountInWordsFCFA(deposit.amount);
  doc.setFont(FONT.name, "italic");
  doc.setFontSize(8.5 * K);
  doc.setTextColor(...DARK);
  const sentence = `Arrete le present recu a la somme de : ${words}`;
  const wrapped = doc.splitTextToSize(sentence, 100);
  doc.text(wrapped, margin, by);
  by += wrapped.length * 5.5 + 4;

  // ── Ligne de signature
  y = Math.max(by + 4, pageHeight - 50);
  doc.setDrawColor(...GRAY);
  doc.setLineWidth(0.25);
  doc.roundedRect(margin, y, 60, 22, 1, 1, "S");
  doc.setFont(FONT.name, FONT.normal);
  doc.setFontSize(8 * K);
  doc.setTextColor(...GRAY);
  doc.text(t("Signature & Cachet"), margin, y - 3);

  // ── Pied de page (identique aux factures)
  drawFooter(doc, info);

  doc.save(`recu-depot-${deposit.firstName}-${deposit.lastName}-${deposit.id.slice(-6)}.pdf`);
}

/* ─── Reçu PDF — Retrait unique ──────────────────────────────────────────── */

export type WithdrawalReceiptData = ClientWithdrawal & {
  depositFirstName: string;
  depositLastName: string;
  depositPhone: string | null;
  depositMethod: string;
  depositAmount: number;
  depositDate: string;
};

export function generateWithdrawalReceiptPdf(
  withdrawal: WithdrawalReceiptData,
  logoDataUrl?: string,
  companyInfo?: CompanyInfo
) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const info = companyInfo ?? getDefaultCompanyInfo();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;

  // ── En-tête société (logo + infos) — identique aux factures
  let y = drawCompanyHeader(doc, logoDataUrl, companyInfo);

  // ── Titre du reçu
  y += 2;
  doc.setFont(FONT.name, FONT.bold);
  doc.setFontSize(20 * Math.min(K, 1.2));
  doc.setTextColor(...AMBER);
  doc.text(t("RECU DE RETRAIT"), pageWidth - margin, y, { align: "right" });
  y += 5;

  // ── N° reçu + date
  const receiptNum = `RET-${withdrawal.id.slice(-6).toUpperCase()}`;
  doc.setFont(FONT.name, FONT.normal);
  doc.setFontSize(8.5 * K);
  doc.setTextColor(...GRAY);
  doc.text(t(`N. Recu : ${receiptNum}`), margin, y);
  doc.text(t(`Date : ${formatDate(new Date().toISOString())}`), pageWidth - margin, y, { align: "right" });
  y += 8;

  // ── Infos client (style identique aux factures : "FACTURER À")
  doc.setFont(FONT.name, FONT.bold);
  doc.setFontSize(8 * K);
  doc.setTextColor(...GRAY);
  doc.text(t("CLIENT"), margin, y);
  doc.setFontSize(11 * K);
  doc.setTextColor(...DARK);
  const clientName = `${withdrawal.depositFirstName} ${withdrawal.depositLastName}`;
  doc.text(t(clientName), margin, y + 6);
  doc.setFont(FONT.name, FONT.normal);
  doc.setFontSize(8.5 * K);
  doc.setTextColor(...GRAY);
  let cy = y + 12;
  if (withdrawal.depositPhone) {
    doc.text(t(`Tel : ${withdrawal.depositPhone}`), margin, cy);
    cy += 5;
  }

  y = cy + 4;

  // ── Référence dépôt d'origine
  doc.setFont(FONT.name, FONT.bold);
  doc.setFontSize(8 * K);
  doc.setTextColor(...GRAY);
  doc.text(t("DEPOT D'ORIGINE"), margin, y);
  y += 6;

  doc.setFontSize(9 * K);
  doc.setTextColor(...DARK);
  doc.setFont(FONT.name, FONT.bold);
  doc.text(t("Date du depot :"), margin, y);
  doc.setFont(FONT.name, FONT.normal);
  doc.text(formatDate(withdrawal.depositDate), margin + 50, y);
  y += 7;

  doc.setFont(FONT.name, FONT.bold);
  doc.text(t("Montant depose :"), margin, y);
  doc.setFont(FONT.name, FONT.normal);
  doc.text(fmtMoney(withdrawal.depositAmount), margin + 50, y);
  y += 7;

  doc.setFont(FONT.name, FONT.bold);
  doc.text(t("Mode de paiement :"), margin, y);
  doc.setFont(FONT.name, FONT.normal);
  doc.text(t(PAYMENT_METHOD_LABELS[withdrawal.depositMethod] ?? withdrawal.depositMethod), margin + 50, y);
  y += 10;

  // ── Détails du retrait
  doc.setFont(FONT.name, FONT.bold);
  doc.setFontSize(8 * K);
  doc.setTextColor(...GRAY);
  doc.text(t("DETAILS DU RETRAIT"), margin, y);
  y += 6;

  doc.setFontSize(9 * K);
  doc.setTextColor(...DARK);
  doc.setFont(FONT.name, FONT.bold);
  doc.text(t("Date du retrait :"), margin, y);
  doc.setFont(FONT.name, FONT.normal);
  doc.text(formatDate(withdrawal.date), margin + 50, y);
  y += 7;

  if (withdrawal.note) {
    doc.setFont(FONT.name, FONT.bold);
    doc.text(t("Motif :"), margin, y);
    doc.setFont(FONT.name, FONT.normal);
    const noteLines = doc.splitTextToSize(t(withdrawal.note), contentWidth - 50);
    doc.text(noteLines, margin + 50, y);
    y += noteLines.length * 5 + 2;
  }

  // ── Montant — disposition identique aux factures (label gauche, valeur droite, fond vert)
  y += 4;
  const totalsX = 122;
  const rowH = 7;

  const totalRow = (label: string, value: string, opts?: { bold?: boolean; color?: number[]; fill?: number[] }) => {
    if (opts?.fill) {
      doc.setFillColor(...(opts.fill as [number, number, number]));
      doc.rect(totalsX, y - 5.2, pageWidth - margin - totalsX, rowH, "F");
    }
    doc.setFont(FONT.name, opts?.bold ? FONT.bold : FONT.normal);
    doc.setFontSize(9 * K);
    doc.setTextColor(...(opts?.color ?? (DARK as unknown as number[])));
    doc.text(t(label), totalsX + 2, y);
    doc.text(value, pageWidth - margin - 2, y, { align: "right" });
    y += rowH;
  };

  // Montant retiré — même style que TOTAL TTC sur facture (fond vert, texte vert, gras)
  totalRow(t("Montant retire"), fmtMoney(withdrawal.amount), {
    bold: true,
    color: GREEN as unknown as number[],
    fill: GREEN_BG as unknown as number[],
  });

  // Solde restant après retrait
  const remainingAfter = Math.max(0, withdrawal.depositAmount - withdrawal.amount);
  doc.setDrawColor(...GREEN);
  doc.setLineWidth(0.4);
  doc.line(totalsX, y - 5.3, pageWidth - margin, y - 5.3);

  totalRow(t("Solde restant"), fmtMoney(remainingAfter), {
    bold: true,
    color: remainingAfter > 0 ? (AMBER as unknown as number[]) : (GREEN as unknown as number[]),
  });

  // ── Bloc « arrêté à la somme de » / signature (identique aux factures)
  let by = y + 6;
  const words = amountInWordsFCFA(withdrawal.amount);
  doc.setFont(FONT.name, "italic");
  doc.setFontSize(8.5 * K);
  doc.setTextColor(...DARK);
  const sentence = `Arrete le present recu a la somme de : ${words}`;
  const wrapped = doc.splitTextToSize(sentence, 100);
  doc.text(wrapped, margin, by);
  by += wrapped.length * 5.5 + 4;

  // ── Ligne de signature
  y = Math.max(by + 4, pageHeight - 50);
  doc.setDrawColor(...GRAY);
  doc.setLineWidth(0.25);
  doc.roundedRect(margin, y, 60, 22, 1, 1, "S");
  doc.setFont(FONT.name, FONT.normal);
  doc.setFontSize(8 * K);
  doc.setTextColor(...GRAY);
  doc.text(t("Signature & Cachet"), margin, y - 3);

  // ── Pied de page (identique aux factures)
  drawFooter(doc, info);

  doc.save(`recu-retrait-${withdrawal.depositFirstName}-${withdrawal.depositLastName}-${withdrawal.id.slice(-6)}.pdf`);
}

/* ─── Montant en lettres (français) — identique à pdf.ts ──────────────────── */

const UNITS = [
  "zero", "un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf",
  "dix", "onze", "douze", "treize", "quatorze", "quinze", "seize", "dix-sept",
  "dix-huit", "dix-neuf",
];
const TENS: Record<number, string> = {
  2: "vingt", 3: "trente", 4: "quarante", 5: "cinquante", 6: "soixante",
  8: "quatre-vingt",
};

function below100(n: number): string {
  if (n < 20) return UNITS[n];
  const tn = Math.floor(n / 10);
  const u = n % 10;
  if (tn === 7 || tn === 9) {
    const base = tn === 7 ? "soixante" : "quatre-vingt";
    const rest = n - (tn === 7 ? 60 : 80);
    if (rest === 0) return tn === 7 ? "soixante-dix" : "quatre-vingt-dix";
    if (rest === 11) return `${base}-onze`;
    if (rest === 1 && tn === 7) return "soixante et onze";
    return `${base}-${UNITS[rest]}`;
  }
  if (u === 0) return tn === 8 ? "quatre-vingts" : TENS[tn];
  if (u === 1 && tn !== 8) return `${TENS[tn]} et un`;
  return `${TENS[tn]}-${UNITS[u]}`;
}

function below1000(n: number): string {
  if (n < 100) return below100(n);
  const c = Math.floor(n / 100);
  const r = n % 100;
  if (c === 1) return r === 0 ? "cent" : `cent ${below100(r)}`;
  return r === 0 ? `${UNITS[c]} cents` : `${UNITS[c]} cent ${below100(r)}`;
}

function amountInWordsFCFA(amount: number): string {
  const n = Math.round(amount);
  if (n === 0) return "Zero franc CFA";
  const parts: string[] = [];
  const millions = Math.floor(n / 1_000_000);
  const thousands = Math.floor((n % 1_000_000) / 1000);
  const rest = n % 1000;
  if (millions > 0)
    parts.push(millions === 1 ? "un million" : `${below1000(millions)} millions`);
  if (thousands > 0)
    parts.push(thousands === 1 ? "mille" : `${below1000(thousands)} mille`);
  if (rest > 0) parts.push(below1000(rest));
  return `${parts.join(" ")} francs CFA`;
}

/* ─── Utilitaire : charger le logo en base64 ─────────────────────────────── */

let cachedLogoDataUrl: string | null = null;
let cachedLogoKey: string | null = null;

/**
 * Charge le logo de l'entreprise en base64 data URL.
 * Utilise le logo des settings si disponible, sinon le logo par défaut `/logo-green.png`.
 * Le résultat est mis en cache pour éviter les rechargements.
 */
export async function loadLogoAsDataUrl(logoUrl?: string | null): Promise<string | undefined> {
  const key = logoUrl || "/logo-green.png";

  // Retourne le cache si même URL déjà chargée
  if (cachedLogoDataUrl && cachedLogoKey === key) return cachedLogoDataUrl;

  try {
    const response = await fetch(key);
    if (!response.ok) {
      return undefined;
    }
    const blob = await response.blob();
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    cachedLogoDataUrl = dataUrl;
    cachedLogoKey = key;
    return dataUrl;
  } catch {
    return undefined;
  }
}
