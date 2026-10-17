/**
 * Utilitaire de génération de rapports PDF pour les dépôts et retraits clients.
 * Utilise jsPDF + autoTable (déjà installés dans le projet).
 * Inclut le logo et les infos de la société dans l'en-tête.
 */

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { formatDate, formatMoney, PAYMENT_METHOD_LABELS, COMPANY } from "@/lib/constants";
import type { ClientDeposit, ClientWithdrawal } from "@/lib/types";

/* ─── Sanitisation du texte pour jsPDF ────────────────────────────────────── */

/**
 * Remplace les caractères accentués français par leurs équivalents ASCII.
 * jsPDF avec la police Helvetica par défaut ne supporte pas tous les
 * caractères Unicode — cette fonction assure un rendu correct.
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
    .replace(/'/g, "'");              // Apostrophe courbe → droite
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

/* ─── Dessiner l'en-tête société (logo + infos) ─────────────────────────── */

function drawCompanyHeader(
  doc: jsPDF,
  logoDataUrl?: string,
  companyInfo?: CompanyInfo
): number {
  const info = companyInfo ?? getDefaultCompanyInfo();
  let currentY = 14;

  // Logo — on essaie de l'ajouter si data URL fournie
  let logoWidth = 0;
  if (logoDataUrl) {
    try {
      const logoW = 28;
      const logoH = 28;
      // Détecter le format d'image depuis le data URL
      const format = logoDataUrl.includes("image/jpeg") || logoDataUrl.includes("image/jpg") ? "JPEG" : "PNG";
      doc.addImage(logoDataUrl, format, 14, currentY, logoW, logoH);
      logoWidth = logoW;
    } catch {
      // Si l'image ne peut pas être ajoutée, on continue sans logo
    }
  }

  // Infos société à droite du logo (ou en haut si pas de logo)
  const textX = logoWidth > 0 ? 14 + logoWidth + 4 : 14;
  const maxTextWidth = logoWidth > 0 ? doc.internalPageSize.getWidth() - textX - 14 : doc.internalPageSize.getWidth() - 28;

  doc.setFontSize(14);
  doc.setTextColor(22, 101, 52); // green-700
  doc.text(t(info.name), textX, currentY + 5, { maxWidth: maxTextWidth });

  doc.setFontSize(9);
  doc.setTextColor(80);
  doc.text(t(info.tagline), textX, currentY + 11, { maxWidth: maxTextWidth });

  doc.setFontSize(8);
  doc.setTextColor(100);
  doc.text(t(info.address), textX, currentY + 16, { maxWidth: maxTextWidth });
  doc.text(t(`Tel : ${info.phone}  |  Email : ${info.email}`), textX, currentY + 21, { maxWidth: maxTextWidth });

  const idLines: string[] = [];
  if (info.rc) idLines.push(`RC : ${info.rc}`);
  if (info.ninea) idLines.push(info.ninea);
  if (idLines.length > 0) {
    doc.text(t(idLines.join("  |  ")), textX, currentY + 26, { maxWidth: maxTextWidth });
  }

  // Ligne de séparation
  const headerBottom = currentY + (logoWidth > 0 ? 32 : 30);
  doc.setDrawColor(22, 101, 52);
  doc.setLineWidth(0.5);
  doc.line(14, headerBottom, doc.internalPageSize.getWidth() - 14, headerBottom);

  return headerBottom + 4; // Y position après l'en-tête
}

/* ─── Rapport PDF Dépôts ─────────────────────────────────────────────────── */

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

  // En-tête société (logo + infos)
  let y = drawCompanyHeader(doc, logoDataUrl, companyInfo);

  // Titre du rapport
  doc.setFontSize(14);
  doc.setTextColor(22, 101, 52); // green-700
  doc.text(t("RAPPORT DEPOTS CLIENTS"), 14, y);
  y += 6;

  doc.setFontSize(10);
  doc.setTextColor(100);
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

  doc.setFontSize(10);
  doc.setTextColor(22, 101, 52);
  doc.text(t(`Total depose : ${formatMoney(totalDeposed)}`), 14, y);
  doc.setTextColor(180, 83, 9); // amber-600
  doc.text(t(`Total retire : ${formatMoney(totalWithdrawn)}`), 100, y);
  doc.setTextColor(5, 150, 105); // emerald
  doc.text(t(`Solde a rendre : ${formatMoney(balance)}`), 200, y);
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
      formatMoney(d.amount),
      t(PAYMENT_METHOD_LABELS[d.method] ?? d.method),
      formatMoney(tw),
      formatMoney(rem),
      t(status),
    ];
  });

  autoTable(doc, {
    startY: y,
    head: [[t("Client"), t("Tel."), t("Date depot"), t("Montant"), t("Mode"), t("Retire"), t("Restant"), t("Statut")]],
    body: rows,
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [22, 101, 52], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [240, 253, 244] },
    columnStyles: {
      3: { halign: "right" },
      5: { halign: "right" },
      6: { halign: "right" },
    },
  });

  // Pied de page
  const pageHeight = doc.internalPageSize.getHeight();
  const info = companyInfo ?? getDefaultCompanyInfo();
  doc.setFontSize(8);
  doc.setTextColor(150);
  doc.text(t(`${info.name} - Rapport depots clients`), 14, pageHeight - 8);
  doc.text(
    t(`${filtered.length} depot(s) - ${formatMoney(totalDeposed)}`),
    14,
    pageHeight - 4
  );

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

  // En-tête société (logo + infos)
  let y = drawCompanyHeader(doc, logoDataUrl, companyInfo);

  // Titre du rapport
  doc.setFontSize(14);
  doc.setTextColor(180, 83, 9); // amber-700
  doc.text(t("RAPPORT RETRAITS CLIENTS"), 14, y);
  y += 6;

  doc.setFontSize(10);
  doc.setTextColor(100);
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

  doc.setFontSize(10);
  doc.setTextColor(180, 83, 9);
  doc.text(t(`Total retire : ${formatMoney(totalWithdrawn)}`), 14, y);
  doc.text(t(`${filtered.length} retrait(s)`), 100, y);
  y += 6;

  // Tableau
  const rows = filtered.map((w) => [
    t(`${w.depositFirstName} ${w.depositLastName}`),
    w.depositPhone || "-",
    formatDate(w.date),
    formatMoney(w.amount),
    t(w.note || "-"),
    formatMoney(w.depositAmount),
    t(PAYMENT_METHOD_LABELS[w.depositMethod] ?? w.depositMethod),
    formatDate(w.depositDate),
  ]);

  autoTable(doc, {
    startY: y,
    head: [[t("Client"), t("Tel."), t("Date retrait"), t("Montant retire"), t("Note"), t("Depot origine"), t("Mode depot"), t("Date depot")]],
    body: rows,
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [180, 83, 9], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [255, 251, 240] },
    columnStyles: {
      3: { halign: "right" },
      5: { halign: "right" },
    },
  });

  // Pied de page
  const pageHeight = doc.internalPageSize.getHeight();
  const info = companyInfo ?? getDefaultCompanyInfo();
  doc.setFontSize(8);
  doc.setTextColor(150);
  doc.text(t(`${info.name} - Rapport retraits clients`), 14, pageHeight - 8);
  doc.text(
    t(`${filtered.length} retrait(s) - ${formatMoney(totalWithdrawn)}`),
    14,
    pageHeight - 4
  );

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
  const pageWidth = doc.internalPageSize.getWidth();
  const pageHeight = doc.internalPageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;

  // ── En-tête société (logo + infos)
  let y = drawCompanyHeader(doc, logoDataUrl, companyInfo);

  // ── Titre du reçu
  y += 4;
  doc.setFontSize(18);
  doc.setTextColor(22, 101, 52);
  doc.text(t("RECU DE DEPOT"), pageWidth / 2, y, { align: "center" });
  y += 3;

  // Ligne sous le titre
  doc.setDrawColor(22, 101, 52);
  doc.setLineWidth(1);
  doc.line(margin, y, pageWidth - margin, y);
  y += 8;

  // ── N° reçu + date
  const receiptNum = `DPT-${deposit.id.slice(-6).toUpperCase()}`;
  doc.setFontSize(9);
  doc.setTextColor(100);
  doc.text(t(`N. Recu : ${receiptNum}`), margin, y);
  doc.text(t(`Date : ${formatDate(new Date().toISOString())}`), pageWidth - margin, y, { align: "right" });
  y += 10;

  // ── Infos client
  doc.setFontSize(11);
  doc.setTextColor(30);
  doc.setFont("helvetica", "bold");
  doc.text(t("Informations client"), margin, y);
  y += 2;
  doc.setDrawColor(200);
  doc.setLineWidth(0.3);
  doc.line(margin, y, margin + contentWidth, y);
  y += 6;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(50);

  // Client name + phone
  doc.setFont("helvetica", "bold");
  doc.text(t("Nom complet :"), margin, y);
  doc.setFont("helvetica", "normal");
  doc.text(t(`${deposit.firstName} ${deposit.lastName}`), margin + 40, y);
  y += 6;

  if (deposit.phone) {
    doc.setFont("helvetica", "bold");
    doc.text(t("Telephone :"), margin, y);
    doc.setFont("helvetica", "normal");
    doc.text(deposit.phone, margin + 40, y);
    y += 6;
  }

  y += 4;

  // ── Détails de la transaction
  doc.setFontSize(11);
  doc.setTextColor(30);
  doc.setFont("helvetica", "bold");
  doc.text(t("Details du depot"), margin, y);
  y += 2;
  doc.setDrawColor(200);
  doc.line(margin, y, margin + contentWidth, y);
  y += 6;

  doc.setFontSize(10);
  doc.setTextColor(50);

  // Date du dépôt
  doc.setFont("helvetica", "bold");
  doc.text(t("Date du depot :"), margin, y);
  doc.setFont("helvetica", "normal");
  doc.text(formatDate(deposit.date), margin + 45, y);
  y += 7;

  // Mode de paiement
  doc.setFont("helvetica", "bold");
  doc.text(t("Mode de paiement :"), margin, y);
  doc.setFont("helvetica", "normal");
  doc.text(t(PAYMENT_METHOD_LABELS[deposit.method] ?? deposit.method), margin + 45, y);
  y += 7;

  if (deposit.notes) {
    doc.setFont("helvetica", "bold");
    doc.text(t("Notes :"), margin, y);
    doc.setFont("helvetica", "normal");
    doc.text(t(deposit.notes), margin + 45, y, { maxWidth: contentWidth - 45 });
    y += 7;
  }

  // ── Montant encadré
  y += 6;
  const boxX = margin;
  const boxY = y;
  const boxW = contentWidth;
  const boxH = 22;

  doc.setFillColor(240, 253, 244); // green-50
  doc.setDrawColor(22, 101, 52);
  doc.setLineWidth(0.8);
  doc.roundedRect(boxX, boxY, boxW, boxH, 3, 3, "FD");

  doc.setFontSize(10);
  doc.setTextColor(22, 101, 52);
  doc.setFont("helvetica", "bold");
  doc.text(t("MONTANT DEPOSE"), boxX + boxW / 2, boxY + 8, { align: "center" });

  doc.setFontSize(16);
  doc.text(formatMoney(deposit.amount), boxX + boxW / 2, boxY + 17, { align: "center" });
  y = boxY + boxH + 10;

  // ── Historique retraits (si applicable)
  const totalWithdrawn = deposit.withdrawals?.reduce((s, w) => s + w.amount, 0) ?? 0;
  const remaining = Math.max(0, deposit.amount - totalWithdrawn);

  if (totalWithdrawn > 0) {
    doc.setFontSize(11);
    doc.setTextColor(30);
    doc.setFont("helvetica", "bold");
    doc.text(t("Retraits effectues"), margin, y);
    y += 2;
    doc.setDrawColor(200);
    doc.setLineWidth(0.3);
    doc.line(margin, y, margin + contentWidth, y);
    y += 6;

    if (deposit.withdrawals && deposit.withdrawals.length > 0) {
      autoTable(doc, {
        startY: y,
        margin: { left: margin, right: margin },
        head: [[t("Date"), t("Montant retire"), t("Note")]],
        body: deposit.withdrawals.map((w) => [
          formatDate(w.date),
          formatMoney(w.amount),
          t(w.note || "-"),
        ]),
        styles: { fontSize: 9, cellPadding: 3 },
        headStyles: { fillColor: [180, 83, 9], textColor: 255, fontStyle: "bold" },
        columnStyles: { 1: { halign: "right" } },
      });
      // Get the final Y from autoTable
      const finalY = (doc as unknown as Record<string, { finalY: number }>).lastAutoTable?.finalY;
      if (finalY && Number.isFinite(finalY)) {
        y = finalY;
      } else {
        y += 30;
      }
      y += 4;
    }

    // Solde restant
    doc.setFontSize(11);
    doc.setTextColor(180, 83, 9);
    doc.setFont("helvetica", "bold");
    doc.text(t(`Total retire : ${formatMoney(totalWithdrawn)}`), margin, y);
    y += 6;
    doc.setTextColor(22, 101, 52);
    doc.text(t(`Solde restant : ${formatMoney(remaining)}`), margin, y);
    y += 10;
  }

  // ── Ligne de signature
  y = Math.max(y, pageHeight - 50);
  doc.setDrawColor(180);
  doc.setLineWidth(0.3);
  doc.line(margin, y, margin + 50, y);
  doc.setFontSize(9);
  doc.setTextColor(100);
  doc.setFont("helvetica", "normal");
  doc.text(t("Signature & Cachet"), margin, y + 5);

  // ── Pied de page
  doc.setFontSize(7);
  doc.setTextColor(150);
  doc.text(t(`${info.name} - ${info.address} - Tel : ${info.phone}`), pageWidth / 2, pageHeight - 8, { align: "center" });
  doc.text(t(`Recu genere le ${formatDate(new Date().toISOString())}`), pageWidth / 2, pageHeight - 4, { align: "center" });

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
  const pageWidth = doc.internalPageSize.getWidth();
  const pageHeight = doc.internalPageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;

  // ── En-tête société (logo + infos)
  let y = drawCompanyHeader(doc, logoDataUrl, companyInfo);

  // ── Titre du reçu
  y += 4;
  doc.setFontSize(18);
  doc.setTextColor(180, 83, 9); // amber-700
  doc.text(t("RECU DE RETRAIT"), pageWidth / 2, y, { align: "center" });
  y += 3;

  // Ligne sous le titre
  doc.setDrawColor(180, 83, 9);
  doc.setLineWidth(1);
  doc.line(margin, y, pageWidth - margin, y);
  y += 8;

  // ── N° reçu + date
  const receiptNum = `RET-${withdrawal.id.slice(-6).toUpperCase()}`;
  doc.setFontSize(9);
  doc.setTextColor(100);
  doc.text(t(`N. Recu : ${receiptNum}`), margin, y);
  doc.text(t(`Date : ${formatDate(new Date().toISOString())}`), pageWidth - margin, y, { align: "right" });
  y += 10;

  // ── Infos client
  doc.setFontSize(11);
  doc.setTextColor(30);
  doc.setFont("helvetica", "bold");
  doc.text(t("Informations client"), margin, y);
  y += 2;
  doc.setDrawColor(200);
  doc.setLineWidth(0.3);
  doc.line(margin, y, margin + contentWidth, y);
  y += 6;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(50);

  doc.setFont("helvetica", "bold");
  doc.text(t("Nom complet :"), margin, y);
  doc.setFont("helvetica", "normal");
  doc.text(t(`${withdrawal.depositFirstName} ${withdrawal.depositLastName}`), margin + 40, y);
  y += 6;

  if (withdrawal.depositPhone) {
    doc.setFont("helvetica", "bold");
    doc.text(t("Telephone :"), margin, y);
    doc.setFont("helvetica", "normal");
    doc.text(withdrawal.depositPhone, margin + 40, y);
    y += 6;
  }

  y += 4;

  // ── Référence dépôt d'origine
  doc.setFontSize(11);
  doc.setTextColor(30);
  doc.setFont("helvetica", "bold");
  doc.text(t("Depot d'origine"), margin, y);
  y += 2;
  doc.setDrawColor(200);
  doc.line(margin, y, margin + contentWidth, y);
  y += 6;

  doc.setFontSize(10);
  doc.setTextColor(50);

  doc.setFont("helvetica", "bold");
  doc.text(t("Date du depot :"), margin, y);
  doc.setFont("helvetica", "normal");
  doc.text(formatDate(withdrawal.depositDate), margin + 45, y);
  y += 7;

  doc.setFont("helvetica", "bold");
  doc.text(t("Montant depose :"), margin, y);
  doc.setFont("helvetica", "normal");
  doc.text(formatMoney(withdrawal.depositAmount), margin + 45, y);
  y += 7;

  doc.setFont("helvetica", "bold");
  doc.text(t("Mode de paiement :"), margin, y);
  doc.setFont("helvetica", "normal");
  doc.text(t(PAYMENT_METHOD_LABELS[withdrawal.depositMethod] ?? withdrawal.depositMethod), margin + 45, y);
  y += 10;

  // ── Détails du retrait
  doc.setFontSize(11);
  doc.setTextColor(30);
  doc.setFont("helvetica", "bold");
  doc.text(t("Details du retrait"), margin, y);
  y += 2;
  doc.setDrawColor(200);
  doc.line(margin, y, margin + contentWidth, y);
  y += 6;

  doc.setFontSize(10);
  doc.setTextColor(50);

  doc.setFont("helvetica", "bold");
  doc.text(t("Date du retrait :"), margin, y);
  doc.setFont("helvetica", "normal");
  doc.text(formatDate(withdrawal.date), margin + 45, y);
  y += 7;

  if (withdrawal.note) {
    doc.setFont("helvetica", "bold");
    doc.text(t("Motif :"), margin, y);
    doc.setFont("helvetica", "normal");
    doc.text(t(withdrawal.note), margin + 45, y, { maxWidth: contentWidth - 45 });
    y += 7;
  }

  // ── Montant encadré
  y += 6;
  const boxX = margin;
  const boxY = y;
  const boxW = contentWidth;
  const boxH = 22;

  doc.setFillColor(255, 251, 240); // amber-50
  doc.setDrawColor(180, 83, 9);
  doc.setLineWidth(0.8);
  doc.roundedRect(boxX, boxY, boxW, boxH, 3, 3, "FD");

  doc.setFontSize(10);
  doc.setTextColor(180, 83, 9);
  doc.setFont("helvetica", "bold");
  doc.text(t("MONTANT RETIRE"), boxX + boxW / 2, boxY + 8, { align: "center" });

  doc.setFontSize(16);
  doc.text(formatMoney(withdrawal.amount), boxX + boxW / 2, boxY + 17, { align: "center" });
  y = boxY + boxH + 10;

  // ── Solde restant après retrait
  const remainingAfter = Math.max(0, withdrawal.depositAmount - withdrawal.amount);
  doc.setFontSize(10);
  doc.setTextColor(22, 101, 52);
  doc.setFont("helvetica", "bold");
  doc.text(t(`Solde restant apres retrait : ${formatMoney(remainingAfter)}`), margin, y);
  y += 10;

  // ── Ligne de signature
  y = Math.max(y, pageHeight - 50);
  doc.setDrawColor(180);
  doc.setLineWidth(0.3);
  doc.line(margin, y, margin + 50, y);
  doc.setFontSize(9);
  doc.setTextColor(100);
  doc.setFont("helvetica", "normal");
  doc.text(t("Signature & Cachet"), margin, y + 5);

  // ── Pied de page
  doc.setFontSize(7);
  doc.setTextColor(150);
  doc.text(t(`${info.name} - ${info.address} - Tel : ${info.phone}`), pageWidth / 2, pageHeight - 8, { align: "center" });
  doc.text(t(`Recu genere le ${formatDate(new Date().toISOString())}`), pageWidth / 2, pageHeight - 4, { align: "center" });

  doc.save(`recu-retrait-${withdrawal.depositFirstName}-${withdrawal.depositLastName}-${withdrawal.id.slice(-6)}.pdf`);
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
