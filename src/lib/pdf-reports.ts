/**
 * Utilitaire de génération de rapports PDF pour les dépôts et retraits clients.
 * Utilise jsPDF + autoTable (déjà installés dans le projet).
 */

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { formatDate, formatMoney, PAYMENT_METHOD_LABELS } from "@/lib/constants";
import type { ClientDeposit, ClientWithdrawal } from "@/lib/types";

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

/* ─── Rapport PDF Dépôts ─────────────────────────────────────────────────── */

export function generateDepositsPdf(
  deposits: ClientDeposit[],
  period: Period,
  refDate?: Date
) {
  const ref = refDate ?? new Date();
  const start = periodStart(ref, period);
  const end = periodEnd(start, period);
  const filtered = filterByPeriod<ClientDeposit>(deposits, "date", period, ref);

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

  // En-tête
  doc.setFontSize(16);
  doc.setTextColor(22, 101, 52); // green-700
  doc.text("RAPPORT DÉPÔTS CLIENTS", 14, 18);
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(
    `Période : ${PERIOD_LABELS[period]} — du ${formatDate(start.toISOString())} au ${formatDate(new Date(end.getTime() - 1).toISOString())}`,
    14,
    26
  );
  doc.text(`Généré le ${formatDate(new Date().toISOString())}`, 14, 32);

  // Stats
  const totalDeposed = filtered.reduce((s, d) => s + d.amount, 0);
  const totalWithdrawn = filtered.reduce(
    (s, d) => s + (d.withdrawals?.reduce((s2, w) => s2 + w.amount, 0) ?? 0),
    0
  );
  const balance = totalDeposed - totalWithdrawn;

  doc.setFontSize(11);
  doc.setTextColor(22, 101, 52);
  doc.text(`Total déposé : ${formatMoney(totalDeposed)}`, 14, 40);
  doc.setTextColor(180, 83, 9); // amber-600
  doc.text(`Total retiré : ${formatMoney(totalWithdrawn)}`, 100, 40);
  doc.setTextColor(5, 150, 105); // emerald
  doc.text(`Solde à rendre : ${formatMoney(balance)}`, 200, 40);

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
    startY: 46,
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
  const pageHeight = doc.internal.pageSize.getHeight();
  doc.setFontSize(8);
  doc.setTextColor(150);
  doc.text("Lampe Fall — Rapport dépôts clients", 14, pageHeight - 8);
  doc.text(
    `${filtered.length} dépôt(s) — ${formatMoney(totalDeposed)} FCFA`,
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
  refDate?: Date
) {
  const ref = refDate ?? new Date();
  const start = periodStart(ref, period);
  const end = periodEnd(start, period);
  const filtered = filterByPeriod<WithdrawalRow>(withdrawals, "date", period, ref);

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

  // En-tête
  doc.setFontSize(16);
  doc.setTextColor(180, 83, 9); // amber-700
  doc.text("RAPPORT RETRAITS CLIENTS", 14, 18);
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(
    `Période : ${PERIOD_LABELS[period]} — du ${formatDate(start.toISOString())} au ${formatDate(new Date(end.getTime() - 1).toISOString())}`,
    14,
    26
  );
  doc.text(`Généré le ${formatDate(new Date().toISOString())}`, 14, 32);

  // Stats
  const totalWithdrawn = filtered.reduce((s, w) => s + w.amount, 0);

  doc.setFontSize(11);
  doc.setTextColor(180, 83, 9);
  doc.text(`Total retiré : ${formatMoney(totalWithdrawn)}`, 14, 40);
  doc.text(`${filtered.length} retrait(s)`, 100, 40);

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
    startY: 46,
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
  const pageHeight = doc.internal.pageSize.getHeight();
  doc.setFontSize(8);
  doc.setTextColor(150);
  doc.text("Lampe Fall — Rapport retraits clients", 14, pageHeight - 8);
  doc.text(
    `${filtered.length} retrait(s) — ${formatMoney(totalWithdrawn)} FCFA`,
    14,
    pageHeight - 4
  );

  doc.save(`rapport-retraits-${period}-${start.toISOString().slice(0, 10)}.pdf`);
}
