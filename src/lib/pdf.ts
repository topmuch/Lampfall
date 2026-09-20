"use client";

// Génération de documents PDF côté client avec jsPDF + AutoTable
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { Invoice, Order, Purchase } from "./types";
import {
  CATEGORY_LABELS,
  COMPANY,
  DELIVERY_LABELS,
  ORDER_STATUS_LABELS,
  PAYMENT_LABELS,
} from "./constants";

// ─── Couleurs (charte ETS LAMP FALL) ────────────────────────────────────────

const GREEN = [30, 107, 58] as const;
const GREEN_LIGHT = [113, 172, 131] as const;
const GREEN_BG = [240, 248, 243] as const;
const RED = [192, 43, 43] as const;
const ORANGE = [202, 111, 9] as const;
const GRAY = [105, 112, 108] as const;
const DARK = [35, 45, 40] as const;

// ─── Formatage ──────────────────────────────────────────────────────────────

function fmtNum(n: number): string {
  const rounded = Math.round(n * 100) / 100;
  const [int, dec] = rounded.toString().split(".");
  const withSpaces = int.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return dec ? `${withSpaces},${dec}` : withSpaces;
}

function fmtMoney(n: number): string {
  return `${fmtNum(n)} FCFA`;
}

function fmtDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "—";
  const pad = (x: number) => String(x).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

function categoryLabel(cat?: string | null): string {
  if (!cat) return "—";
  return CATEGORY_LABELS[cat] ?? cat;
}

// ─── Montant en lettres (français) ──────────────────────────────────────────

const UNITS = [
  "zéro", "un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf",
  "dix", "onze", "douze", "treize", "quatorze", "quinze", "seize", "dix-sept",
  "dix-huit", "dix-neuf",
];
const TENS: Record<number, string> = {
  2: "vingt", 3: "trente", 4: "quarante", 5: "cinquante", 6: "soixante",
  8: "quatre-vingt",
};

function below100(n: number): string {
  if (n < 20) return UNITS[n];
  const t = Math.floor(n / 10);
  const u = n % 10;
  if (t === 7 || t === 9) {
    const base = t === 7 ? "soixante" : "quatre-vingt";
    const rest = n - (t === 7 ? 60 : 80);
    if (rest === 0) return t === 7 ? "soixante-dix" : "quatre-vingt-dix";
    if (rest === 11) return `${base}-onze`;
    if (rest === 1 && t === 7) return "soixante et onze";
    return `${base}-${UNITS[rest]}`;
  }
  if (u === 0) return t === 8 ? "quatre-vingts" : TENS[t];
  if (u === 1 && t !== 8) return `${TENS[t]} et un`;
  return `${TENS[t]}-${UNITS[u]}`;
}

function below1000(n: number): string {
  if (n < 100) return below100(n);
  const c = Math.floor(n / 100);
  const r = n % 100;
  if (c === 1) return r === 0 ? "cent" : `cent ${below100(r)}`;
  return r === 0 ? `${UNITS[c]} cents` : `${UNITS[c]} cent ${below100(r)}`;
}

export function amountInWordsFCFA(amount: number): string {
  const n = Math.round(amount);
  if (n === 0) return "Zéro franc CFA";
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

// ─── Logo ───────────────────────────────────────────────────────────────────

let logoCache: string | null = null;

export async function getLogoBase64(): Promise<string | null> {
  if (logoCache) return logoCache;
  try {
    const res = await fetch("/logo.png");
    const blob = await res.blob();
    logoCache = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
  return logoCache;
}

// ─── Helpers de dessin ──────────────────────────────────────────────────────

function drawHeader(doc: jsPDF, logo: string | null, title: string, subtitle: string) {
  // Bandeau vert fin en haut
  doc.setFillColor(...GREEN);
  doc.rect(0, 0, 210, 3, "F");

  // Logo
  if (logo) {
    try {
      doc.addImage(logo, "PNG", 14, 8, 30, 25.6);
    } catch {
      /* ignore */
    }
  }

  // Infos société
  const xText = logo ? 48 : 14;
  doc.setTextColor(...DARK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(COMPANY.name, xText, 15);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...GREEN);
  doc.text(COMPANY.tagline, xText, 20);
  doc.setTextColor(...GRAY);
  doc.text(COMPANY.address, xText, 24.5);
  doc.text(`Tél : ${COMPANY.phone}`, xText, 28.5);
  doc.text(COMPANY.email, xText, 32.5);

  // Titre à droite
  doc.setTextColor(...GREEN);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text(title, 196, 16, { align: "right" });
  doc.setFontSize(9);
  doc.setTextColor(...GRAY);
  doc.text(subtitle, 196, 22, { align: "right" });

  // Ligne de séparation
  doc.setDrawColor(...GREEN);
  doc.setLineWidth(0.6);
  doc.line(14, 40, 196, 40);
  doc.setDrawColor(...GREEN_LIGHT);
  doc.setLineWidth(0.25);
  doc.line(14, 41.2, 196, 41.2);
}

function drawFooter(doc: jsPDF) {
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    const y = 288;
    doc.setDrawColor(...GREEN);
    doc.setLineWidth(0.4);
    doc.line(14, y - 4, 196, y - 4);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...GRAY);
    doc.text(
      `${COMPANY.name} • ${COMPANY.tagline} • Tél : ${COMPANY.phone} • ${COMPANY.email}`,
      105,
      y,
      { align: "center" }
    );
    doc.text("Merci de votre confiance !", 105, y + 3.5, { align: "center" });
    doc.text(`Page ${i}/${pageCount}`, 196, y, { align: "right" });
  }
}

function statusBadge(
  doc: jsPDF,
  label: string,
  color: readonly [number, number, number] | number[],
  x: number,
  y: number
) {
  const w = 32;
  const h = 7.5;
  doc.setFillColor(color[0], color[1], color[2]);
  doc.roundedRect(x, y, w, h, 1.5, 1.5, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.text(label, x + w / 2, y + h / 2 + 1.2, { align: "center" });
}

function paymentColor(status: string) {
  if (status === "PAYE") return GREEN as unknown as number[];
  if (status === "PARTIEL") return ORANGE as unknown as number[];
  return RED as unknown as number[];
}

function deliveryColor(status: string) {
  return status === "LIVRE" ? (GREEN as unknown as number[]) : GRAY as unknown as number[];
}

function watermark(doc: jsPDF, text: string, color: readonly number[]) {
  try {
    const GStateCtor = (doc as unknown as { GState: new (opts: { opacity: number }) => unknown }).GState;
    const g = new GStateCtor({ opacity: 0.07 });
    (doc as unknown as { setGState: (g: unknown) => void }).setGState(g);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(60);
    doc.setTextColor(color[0], color[1], color[2]);
    doc.text(text, 105, 165, { align: "center", angle: 40 });
    // Restaurer l'opacité normale après le filigrane
    const opaque = new GStateCtor({ opacity: 1 });
    (doc as unknown as { setGState: (g: unknown) => void }).setGState(opaque);
    doc.setFontSize(10);
    doc.setTextColor(...DARK);
  } catch {
    /* GState non supporté */
  }
}

type TableItem = {
  productName: string;
  category?: string | null;
  unit?: string | null;
  quantity: number;
  unitPrice: number;
  total: number;
};

function drawItemsTable(doc: jsPDF, items: TableItem[], startY: number): number {
  autoTable(doc, {
    startY,
    head: [["Désignation", "Catégorie", "Qté", "PU (FCFA)", "Total (FCFA)"]],
    body: items.map((it) => [
      it.productName,
      categoryLabel(it.category),
      `${fmtNum(it.quantity)} ${it.unit ?? ""}`.trim(),
      fmtNum(it.unitPrice),
      fmtNum(it.total),
    ]),
    theme: "grid",
    styles: {
      font: "helvetica",
      fontSize: 8.5,
      textColor: DARK as unknown as number[],
      lineColor: [210, 218, 213],
      lineWidth: 0.15,
      cellPadding: { top: 2, right: 2.5, bottom: 2, left: 2.5 },
    },
    headStyles: {
      fillColor: GREEN as unknown as number[],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 8.5,
      halign: "left",
    },
    alternateRowStyles: { fillColor: GREEN_BG as unknown as number[] },
    columnStyles: {
      0: { cellWidth: 78, fontStyle: "bold" },
      1: { cellWidth: 34, fontSize: 7.8, textColor: GRAY as unknown as number[] },
      2: { cellWidth: 22, halign: "center" },
      3: { cellWidth: 27, halign: "right" },
      4: { cellWidth: 29, halign: "right", fontStyle: "bold" },
    },
    margin: { left: 14, right: 14 },
  });
  const last = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable;
  return last ? last.finalY : startY + 30;
}

// ─── Facture / Proforma ─────────────────────────────────────────────────────

export async function buildInvoicePDF(invoice: Invoice): Promise<jsPDF> {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const logo = await getLogoBase64();
  const isProforma = invoice.type === "PROFORMA";

  drawHeader(
    doc,
    logo,
    isProforma ? "FACTURE PROFORMA" : "FACTURE",
    `N° ${invoice.number}`
  );

  // Watermark
  if (isProforma) watermark(doc, "PROFORMA", GREEN_LIGHT);
  else if (invoice.paymentStatus === "PAYE") watermark(doc, "PAYÉ", GREEN_LIGHT);
  else if (invoice.paymentStatus === "NON_PAYE") watermark(doc, "IMPAYÉ", [220, 190, 190]);

  // Bloc client
  const blockY = 48;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...GRAY);
  doc.text("FACTURER À", 14, blockY);
  doc.setFontSize(11);
  doc.setTextColor(...DARK);
  const clientName = invoice.clientName || "Client comptoir";
  const nameLines = doc.splitTextToSize(clientName, 85);
  doc.text(nameLines, 14, blockY + 6);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...GRAY);
  let cy = blockY + 6 + nameLines.length * 5;
  if (invoice.clientPhone) {
    doc.text(`Tél : ${invoice.clientPhone}`, 14, cy);
    cy += 4.5;
  }
  if (invoice.clientAddress) {
    doc.text(doc.splitTextToSize(invoice.clientAddress, 85), 14, cy);
    cy += 4.5;
  }

  // Infos facture
  doc.setFontSize(8.5);
  const infoX = 128;
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...GRAY);
  doc.text("Date :", infoX, blockY);
  doc.text(fmtDate(invoice.date), 196, blockY, { align: "right" });
  if (invoice.dueDate) {
    doc.text("Échéance :", infoX, blockY + 5);
    doc.text(fmtDate(invoice.dueDate), 196, blockY + 5, { align: "right" });
  }

  // Badges statuts
  if (!isProforma) {
    statusBadge(
      doc,
      PAYMENT_LABELS[invoice.paymentStatus] ?? invoice.paymentStatus,
      paymentColor(invoice.paymentStatus),
      164,
      blockY + (invoice.dueDate ? 12 : 7)
    );
    statusBadge(
      doc,
      DELIVERY_LABELS[invoice.deliveryStatus] ?? invoice.deliveryStatus,
      deliveryColor(invoice.deliveryStatus),
      128,
      blockY + (invoice.dueDate ? 12 : 7)
    );
  } else {
    doc.setFont("helvetica", "italic");
    doc.setTextColor(...GREEN);
    doc.setFontSize(8);
    doc.text("Document prévisionnel — non valable comme facture définitive", 196, blockY + 8, {
      align: "right",
    });
  }

  // Tableau des articles
  const tableEnd = drawItemsTable(doc, invoice.items, blockY + 20);

  // Totaux
  const totalsX = 122;
  let ty = tableEnd + 7;
  const rowH = 6;

  const totalRow = (label: string, value: string, opts?: { bold?: boolean; color?: number[]; fill?: number[] }) => {
    if (opts?.fill) {
      doc.setFillColor(...(opts.fill as [number, number, number]));
      doc.rect(totalsX, ty - 4.4, 196 - totalsX, rowH, "F");
    }
    doc.setFont("helvetica", opts?.bold ? "bold" : "normal");
    doc.setFontSize(9);
    doc.setTextColor(...(opts?.color ?? (DARK as unknown as number[])));
    doc.text(label, totalsX + 2, ty);
    doc.text(value, 194, ty, { align: "right" });
    ty += rowH;
  };

  totalRow("Total HT", fmtMoney(invoice.totalHT));
  totalRow(`TVA (${invoice.taxRate}%)`, fmtMoney(invoice.totalTTC - invoice.totalHT));
  doc.setDrawColor(...GREEN);
  doc.setLineWidth(0.4);
  doc.line(totalsX, ty - 4.6, 196, ty - 4.6);
  totalRow("TOTAL TTC", fmtMoney(invoice.totalTTC), {
    bold: true,
    color: GREEN as unknown as number[],
    fill: GREEN_BG as unknown as number[],
  });
  if (!isProforma) {
    totalRow("Montant payé", fmtMoney(invoice.amountPaid));
    const reste = invoice.totalTTC - invoice.amountPaid;
    totalRow("Reste à payer", fmtMoney(reste), {
      bold: true,
      color: reste > 0 ? (RED as unknown as number[]) : (GREEN as unknown as number[]),
    });
  }

  // Bloc « arrêté à la somme de » / signature
  let by = tableEnd + 8;
  const words = amountInWordsFCFA(invoice.totalTTC);
  doc.setFont("helvetica", "italic");
  doc.setFontSize(8.5);
  doc.setTextColor(...DARK);
  const sentence = isProforma
    ? `Montant estimé de la commande : ${words}`
    : `Arrêtée la présente facture à la somme de : ${words}`;
  const wrapped = doc.splitTextToSize(sentence, 100);
  doc.text(wrapped, 14, by);
  by += wrapped.length * 4.5 + 4;

  if (isProforma) {
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...GRAY);
    doc.setFontSize(8);
    doc.text("Bon pour accord — Signature & cachet du client :", 14, by + 4);
    doc.setDrawColor(...GRAY);
    doc.setLineWidth(0.25);
    doc.roundedRect(14, by + 6, 60, 22, 1, 1, "S");
  } else if (invoice.notes) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...GRAY);
    doc.text(doc.splitTextToSize(`Notes : ${invoice.notes}`, 100), 14, by);
  }

  drawFooter(doc);
  return doc;
}

// ─── Commande prévisionnelle (bon de commande) ──────────────────────────────

export async function buildOrderPDF(order: Order): Promise<jsPDF> {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const logo = await getLogoBase64();

  drawHeader(doc, logo, "COMMANDE PRÉVISIONNELLE", `N° ${order.number}`);

  const blockY = 48;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...GRAY);
  doc.text("CLIENT", 14, blockY);
  doc.setFontSize(11);
  doc.setTextColor(...DARK);
  const clientName = order.clientName || "Client comptoir";
  const nameLines = doc.splitTextToSize(clientName, 85);
  doc.text(nameLines, 14, blockY + 6);

  doc.setFontSize(8.5);
  const infoX = 128;
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...GRAY);
  doc.text("Date :", infoX, blockY);
  doc.text(fmtDate(order.date), 196, blockY, { align: "right" });
  doc.text("Livraison prévue :", infoX, blockY + 5);
  doc.text(fmtDate(order.deliveryDate), 196, blockY + 5, { align: "right" });

  statusBadge(
    doc,
    ORDER_STATUS_LABELS[order.status] ?? order.status,
    order.status === "LIVREE"
      ? (GREEN as unknown as number[])
      : order.status === "ANNULEE"
        ? (RED as unknown as number[])
        : order.status === "CONFIRMEE"
          ? (ORANGE as unknown as number[])
          : (GRAY as unknown as number[]),
    164,
    blockY + 12
  );

  const tableEnd = drawItemsTable(doc, order.items, blockY + 20);

  let ty = tableEnd + 7;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...GREEN);
  doc.text("MONTANT ESTIMÉ :", 122, ty);
  doc.text(fmtMoney(order.items.reduce((s, i) => s + i.total, 0)), 194, ty, {
    align: "right",
  });

  if (order.notes) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...GRAY);
    doc.text(doc.splitTextToSize(`Notes : ${order.notes}`, 180), 14, ty + 8);
  }

  doc.setFont("helvetica", "italic");
  doc.setFontSize(8);
  doc.setTextColor(...GRAY);
  doc.text(
    "Document prévisionnel — les quantités et prix restent susceptibles d'ajustement.",
    14,
    275
  );

  drawFooter(doc);
  return doc;
}

// ─── Liste des commandes prévisionnelles ────────────────────────────────────

export async function buildOrdersListPDF(orders: Order[]): Promise<jsPDF> {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const logo = await getLogoBase64();

  drawHeader(doc, logo, "LISTE DES COMMANDES", `${orders.length} commande(s) prévisionnelle(s)`);

  autoTable(doc, {
    startY: 48,
    head: [["N°", "Client", "Date", "Livraison prév.", "Statut", "Articles", "Montant estimé"]],
    body: orders.map((o) => [
      o.number,
      o.clientName || "Client comptoir",
      fmtDate(o.date),
      fmtDate(o.deliveryDate),
      ORDER_STATUS_LABELS[o.status] ?? o.status,
      String(o.items.length),
      fmtNum(o.items.reduce((s, i) => s + i.total, 0)),
    ]),
    foot: [
      [
        "TOTAL", "", "", "", "", "",
        fmtNum(orders.reduce((s, o) => s + o.items.reduce((a, i) => a + i.total, 0), 0)),
      ],
    ],
    theme: "grid",
    styles: {
      font: "helvetica",
      fontSize: 8,
      textColor: DARK as unknown as number[],
      lineColor: [210, 218, 213],
      lineWidth: 0.15,
      cellPadding: { top: 1.8, right: 2, bottom: 1.8, left: 2 },
    },
    headStyles: { fillColor: GREEN as unknown as number[], textColor: [255, 255, 255], fontStyle: "bold" },
    footStyles: { fillColor: GREEN_BG as unknown as number[], textColor: GREEN as unknown as number[], fontStyle: "bold" },
    alternateRowStyles: { fillColor: GREEN_BG as unknown as number[] },
    columnStyles: {
      0: { cellWidth: 26, fontStyle: "bold" },
      1: { cellWidth: 44 },
      2: { cellWidth: 20, halign: "center" },
      3: { cellWidth: 24, halign: "center" },
      4: { cellWidth: 22, halign: "center" },
      5: { cellWidth: 16, halign: "center" },
      6: { halign: "right", fontStyle: "bold" },
    },
    margin: { left: 14, right: 14 },
  });

  drawFooter(doc);
  return doc;
}

// ─── Bon d'achat (facture fournisseur) ──────────────────────────────────────

export async function buildPurchasePDF(purchase: Purchase): Promise<jsPDF> {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const logo = await getLogoBase64();

  drawHeader(doc, logo, "BON D'ACHAT", `N° ${purchase.number}`);

  const blockY = 48;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...GRAY);
  doc.text("FOURNISSEUR", 14, blockY);
  doc.setFontSize(11);
  doc.setTextColor(...DARK);
  doc.text(doc.splitTextToSize(purchase.supplier, 85), 14, blockY + 6);

  doc.setFontSize(8.5);
  const infoX = 128;
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...GRAY);
  doc.text("Date :", infoX, blockY);
  doc.text(fmtDate(purchase.date), 196, blockY, { align: "right" });
  if (purchase.fileName) {
    doc.text("Pièce jointe :", infoX, blockY + 5);
    doc.setTextColor(...GREEN);
    doc.text(purchase.fileName.slice(0, 30), 196, blockY + 5, { align: "right" });
  }

  const tableEnd = drawItemsTable(doc, purchase.items, blockY + 20);

  let ty = tableEnd + 7;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...GREEN);
  doc.text("TOTAL ACHAT :", 122, ty);
  doc.text(fmtMoney(purchase.total), 194, ty, { align: "right" });

  if (purchase.notes) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...GRAY);
    doc.text(doc.splitTextToSize(`Notes : ${purchase.notes}`, 180), 14, ty + 8);
  }

  drawFooter(doc);
  return doc;
}

// ─── Liste des factures ─────────────────────────────────────────────────────

export async function buildInvoiceListPDF(
  invoices: Invoice[],
  title: string,
  subtitle: string
): Promise<jsPDF> {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const logo = await getLogoBase64();

  drawHeader(doc, logo, title, subtitle);

  autoTable(doc, {
    startY: 48,
    head: [["N°", "Date", "Client", "Paiement", "Livraison", "Total TTC"]],
    body: invoices.map((f) => [
      f.number,
      fmtDate(f.date),
      f.clientName || "Client comptoir",
      PAYMENT_LABELS[f.paymentStatus] ?? f.paymentStatus,
      DELIVERY_LABELS[f.deliveryStatus] ?? f.deliveryStatus,
      fmtNum(f.totalTTC),
    ]),
    foot: [["TOTAL", "", "", "", "", fmtNum(invoices.reduce((s, f) => s + f.totalTTC, 0))]],
    theme: "grid",
    styles: {
      font: "helvetica",
      fontSize: 8,
      textColor: DARK as unknown as number[],
      lineColor: [210, 218, 213],
      lineWidth: 0.15,
      cellPadding: { top: 1.8, right: 2, bottom: 1.8, left: 2 },
    },
    headStyles: { fillColor: GREEN as unknown as number[], textColor: [255, 255, 255], fontStyle: "bold" },
    footStyles: { fillColor: GREEN_BG as unknown as number[], textColor: GREEN as unknown as number[], fontStyle: "bold" },
    alternateRowStyles: { fillColor: GREEN_BG as unknown as number[] },
    columnStyles: {
      0: { cellWidth: 30, fontStyle: "bold" },
      1: { cellWidth: 22, halign: "center" },
      2: { cellWidth: 62 },
      3: { cellWidth: 22, halign: "center" },
      4: { cellWidth: 22, halign: "center" },
      5: { halign: "right", fontStyle: "bold" },
    },
    margin: { left: 14, right: 14 },
  });

  drawFooter(doc);
  return doc;
}

// ─── Actions ────────────────────────────────────────────────────────────────

export function downloadPDF(doc: jsPDF, filename: string) {
  doc.save(filename);
}

export function openPDF(doc: jsPDF) {
  const url = doc.output("bloburl");
  window.open(url as unknown as string, "_blank");
}

export async function saveOrOpenInvoicePDF(invoice: Invoice, action: "download" | "open") {
  const doc = await buildInvoicePDF(invoice);
  const filename = `${invoice.type === "PROFORMA" ? "Proforma" : "Facture"}-${invoice.number}.pdf`;
  if (action === "download") downloadPDF(doc, filename);
  else openPDF(doc);
}
