/**
 * Utilitaire de génération de rapports PDF pour les dépôts et retraits clients.
 * Utilise jsPDF + autoTable (déjà installés dans le projet).
 * Inclut le logo et les infos de la société dans l'en-tête.
 */

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { formatDate, formatMoney, PAYMENT_METHOD_LABELS, COMPANY } from "@/lib/constants";
import type { ClientDeposit, ClientWithdrawal } from "@/lib/types";

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
      // Dimensions du logo dans le PDF
      const logoW = 28;
      const logoH = 28;
      doc.addImage(logoDataUrl, "PNG", 14, currentY, logoW, logoH);
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
  doc.text(info.name, textX, currentY + 5, { maxWidth: maxTextWidth });

  doc.setFontSize(9);
  doc.setTextColor(80);
  doc.text(info.tagline, textX, currentY + 11, { maxWidth: maxTextWidth });

  doc.setFontSize(8);
  doc.setTextColor(100);
  doc.text(info.address, textX, currentY + 16, { maxWidth: maxTextWidth });
  doc.text(`Tél : ${info.phone}  |  Email : ${info.email}`, textX, currentY + 21, { maxWidth: maxTextWidth });

  const idLines: string[] = [];
  if (info.rc) idLines.push(`RC : ${info.rc}`);
  if (info.ninea) idLines.push(info.ninea);
  if (idLines.length > 0) {
    doc.text(idLines.join("  |  "), textX, currentY + 26, { maxWidth: maxTextWidth });
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
  doc.text("RAPPORT DÉPÔTS CLIENTS", 14, y);
  y += 6;

  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(
    `Période : ${PERIOD_LABELS[period]} — du ${formatDate(start.toISOString())} au ${formatDate(new Date(end.getTime() - 1).toISOString())}`,
    14,
    y
  );
  y += 5;
  doc.text(`Généré le ${formatDate(new Date().toISOString())}`, 14, y);
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
  doc.text(`Total déposé : ${formatMoney(totalDeposed)}`, 14, y);
  doc.setTextColor(180, 83, 9); // amber-600
  doc.text(`Total retiré : ${formatMoney(totalWithdrawn)}`, 100, y);
  doc.setTextColor(5, 150, 105); // emerald
  doc.text(`Solde à rendre : ${formatMoney(balance)}`, 200, y);
  y += 6;

  // Tableau
  const rows = filtered.map((d) => {
    const tw = d.withdrawals?.reduce((s, w) => s + w.amount, 0) ?? 0;
    const rem = d.amount - tw;
    const status =
      rem <= 0.009 ? "Soldé" : tw > 0 ? "Retrait partiel" : "Non retiré";
    return [
      `${d.firstName} ${d.lastName}`,
      d.phone || "—",
      formatDate(d.date),
      formatMoney(d.amount),
      PAYMENT_METHOD_LABELS[d.method] ?? d.method,
      formatMoney(tw),
      formatMoney(rem),
      status,
    ];
  });

  autoTable(doc, {
    startY: y,
    head: [["Client", "Tél.", "Date dépôt", "Montant", "Mode", "Retiré", "Restant", "Statut"]],
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
  doc.text(`${info.name} — Rapport dépôts clients`, 14, pageHeight - 8);
  doc.text(
    `${filtered.length} dépôt(s) — ${formatMoney(totalDeposed)}`,
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
  doc.text("RAPPORT RETRAITS CLIENTS", 14, y);
  y += 6;

  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(
    `Période : ${PERIOD_LABELS[period]} — du ${formatDate(start.toISOString())} au ${formatDate(new Date(end.getTime() - 1).toISOString())}`,
    14,
    y
  );
  y += 5;
  doc.text(`Généré le ${formatDate(new Date().toISOString())}`, 14, y);
  y += 8;

  // Stats
  const totalWithdrawn = filtered.reduce((s, w) => s + w.amount, 0);

  doc.setFontSize(10);
  doc.setTextColor(180, 83, 9);
  doc.text(`Total retiré : ${formatMoney(totalWithdrawn)}`, 14, y);
  doc.text(`${filtered.length} retrait(s)`, 100, y);
  y += 6;

  // Tableau
  const rows = filtered.map((w) => [
    `${w.depositFirstName} ${w.depositLastName}`,
    w.depositPhone || "—",
    formatDate(w.date),
    formatMoney(w.amount),
    w.note || "—",
    formatMoney(w.depositAmount),
    PAYMENT_METHOD_LABELS[w.depositMethod] ?? w.depositMethod,
    formatDate(w.depositDate),
  ]);

  autoTable(doc, {
    startY: y,
    head: [["Client", "Tél.", "Date retrait", "Montant retiré", "Note", "Dépôt origine", "Mode dépôt", "Date dépôt"]],
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
  doc.text(`${info.name} — Rapport retraits clients`, 14, pageHeight - 8);
  doc.text(
    `${filtered.length} retrait(s) — ${formatMoney(totalWithdrawn)}`,
    14,
    pageHeight - 4
  );

  doc.save(`rapport-retraits-${period}-${start.toISOString().slice(0, 10)}.pdf`);
}

/* ─── Utilitaire : charger le logo en base64 ─────────────────────────────── */

let cachedLogoDataUrl: string | null = null;
let logoLoadAttempted = false;

/**
 * Charge le logo de l'entreprise en base64 data URL.
 * Utilise le logo des settings si disponible, sinon le logo par défaut `/logo-green.png`.
 * Le résultat est mis en cache pour éviter les rechargements.
 */
export async function loadLogoAsDataUrl(logoUrl?: string | null): Promise<string | undefined> {
  // Retourne le cache si déjà chargé
  if (cachedLogoDataUrl) return cachedLogoDataUrl;
  if (logoLoadAttempted && !cachedLogoDataUrl) return undefined;

  try {
    const url = logoUrl || "/logo-green.png";
    const response = await fetch(url);
    if (!response.ok) {
      logoLoadAttempted = true;
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
    logoLoadAttempted = true;
    return dataUrl;
  } catch {
    logoLoadAttempted = true;
    return undefined;
  }
}
