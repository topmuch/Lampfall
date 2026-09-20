// ─── Catégories de produits ETS LAMP FALL ───────────────────────────────────

export const PRODUCT_CATEGORIES = [
  "SANITAIRE",
  "PLOMBERIE",
  "LUMINAIRE",
  "ELECTRICITE",
  "GOUTTE_A_GOUTTE",
  "TUYAUTERIE",
  "MIROITERIE",
  "ROBINETTERIE",
  "POMPE",
  "CHASSE_DOUCHE",
  "RESERVOIR_EAU",
] as const;

export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number];

export const CATEGORY_LABELS: Record<string, string> = {
  SANITAIRE: "Sanitaire",
  PLOMBERIE: "Plomberie",
  LUMINAIRE: "Luminaire",
  ELECTRICITE: "Électricité",
  GOUTTE_A_GOUTTE: "Goutte à goutte",
  TUYAUTERIE: "Tuyauterie",
  MIROITERIE: "Miroiterie",
  ROBINETTERIE: "Robinetterie",
  POMPE: "Pompe",
  CHASSE_DOUCHE: "Chasse de douche",
  RESERVOIR_EAU: "Réservoir d'eau",
};

// ─── Statuts ────────────────────────────────────────────────────────────────

export const INVOICE_TYPES = ["VENTE", "PROFORMA"] as const;
export type InvoiceType = (typeof INVOICE_TYPES)[number];

export const DELIVERY_STATUSES = ["LIVRE", "NON_LIVRE"] as const;
export type DeliveryStatus = (typeof DELIVERY_STATUSES)[number];

export const PAYMENT_STATUSES = ["PAYE", "PARTIEL", "NON_PAYE"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const ORDER_STATUSES = ["EN_COURS", "CONFIRMEE", "LIVREE", "ANNULEE"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ORDER_STATUS_LABELS: Record<string, string> = {
  EN_COURS: "En cours",
  CONFIRMEE: "Confirmée",
  LIVREE: "Livrée",
  ANNULEE: "Annulée",
};

export const DELIVERY_LABELS: Record<string, string> = {
  LIVRE: "Livré",
  NON_LIVRE: "Non livré",
};

export const PAYMENT_LABELS: Record<string, string> = {
  PAYE: "Payé",
  PARTIEL: "Partiel",
  NON_PAYE: "Non payé",
};

export const CLIENT_TYPES = ["PARTICULIER", "ENTREPRISE"] as const;

// ─── Infos société ──────────────────────────────────────────────────────────

export const COMPANY = {
  name: "ETS LAMP FALL",
  tagline: "Plomberie - Sanitaire - Luminaire",
  address: "Dakar, Sénégal",
  phone: "+221 77 000 00 00",
  email: "contact@etslampfall.sn",
  ninea: "NINEA : 00000000 0000",
};

export const CURRENCY = "FCFA";

// ─── Formatters ─────────────────────────────────────────────────────────────

export function formatMoney(value: number | null | undefined): string {
  const n = value ?? 0;
  return `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(n)} ${CURRENCY}`;
}

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d);
}

export function toISODate(value: string | Date | null | undefined): string {
  if (!value) return "";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

// ─── Numérotation ───────────────────────────────────────────────────────────

export function nextNumber(prefix: string, count: number, year: number): string {
  return `${prefix}-${year}-${String(count + 1).padStart(4, "0")}`;
}

export const NUMBER_PREFIXES = {
  VENTE: "FV",
  PROFORMA: "PF",
  ACHAT: "FA",
  COMMANDE: "CMD",
} as const;
