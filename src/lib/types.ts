// Types partagés entre le frontend et les API (versions sérialisées JSON)

export interface Client {
  id: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  type: string;
  creditLimit?: number;
  notes?: string | null;
  createdAt: string;
}

export interface Product {
  id: string;
  name: string;
  reference?: string | null;
  category: string;
  image?: string | null;
  purchasePrice: number;
  salePrice: number;
  stock: number;
  unit: string;
  minStock: number;
  createdAt: string;
}

export interface Category {
  id: string;
  code: string;
  label: string;
  createdAt: string;
}

export interface CategoryWithCount extends Category {
  productCount?: number;
}

export interface Tenant {
  id: string;
  name: string;
  phone?: string | null;
  building: string;
  unit?: string | null;
  monthlyRent: number;
  notes?: string | null;
  createdAt: string;
  rents: Rent[];
}

export interface Rent {
  id: string;
  tenantId: string;
  month: string; // AAAA-MM
  amount: number;
  status: "PAYE" | "NON_PAYE";
  paidAt?: string | null;
  notes?: string | null;
  createdAt: string;
}

export interface InvoiceItem {
  id?: string;
  productId?: string | null;
  productName: string;
  category?: string | null;
  unit: string;
  quantity: number;
  unitPrice: number;
  total: number;
  purchasePrice?: number | null;
}

export interface Invoice {
  id: string;
  number: string;
  type: "VENTE" | "PROFORMA";
  clientId?: string | null;
  client?: Client | null;
  clientName: string;
  clientPhone?: string | null;
  clientAddress?: string | null;
  date: string;
  dueDate?: string | null;
  deliveryStatus: "LIVRE" | "NON_LIVRE";
  paymentStatus: "PAYE" | "PARTIEL" | "NON_PAYE";
  amountPaid: number;
  taxRate: number;
  totalHT: number;
  totalTTC: number;
  notes?: string | null;
  items: InvoiceItem[];
  payments?: Payment[];
  createdAt: string;
}

export interface Payment {
  id: string;
  invoiceId: string;
  amount: number;
  method: string;
  paidAt: string;
  note?: string | null;
  createdAt: string;
}

// ─── Achats à crédit (factures / proformas transférées) ─────────────────────

export interface CreditPayment {
  id: string;
  purchaseId: string;
  amount: number;
  method: string;
  paidAt: string;
  note?: string | null;
  createdAt: string;
}

export interface CreditPurchase {
  id: string;
  destination: "COMMERCANT" | "IMMO";
  sourceType: "VENTE" | "PROFORMA";
  sourceId: string;
  number: string;
  tier: string;
  total: number;
  amountPaid: number;
  dueDate?: string | null;
  note?: string | null;
  createdAt: string;
  payments?: CreditPayment[];
  /** Statuts du document source (facture / proforma d'origine) */
  sourceDeliveryStatus?: string | null;
  sourcePaymentStatus?: string | null;
}

export interface PurchaseItem {
  id?: string;
  productId?: string | null;
  productName: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface Purchase {
  id: string;
  number: string;
  supplier: string;
  supplierId?: string | null;
  date: string;
  total: number;
  fileName?: string | null;
  fileType?: string | null;
  fileSize?: number | null;
  notes?: string | null;
  items: PurchaseItem[];
  createdAt: string;
}

export interface Supplier {
  id: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  notes?: string | null;
  createdAt: string;
  purchaseCount?: number;
  purchaseTotal?: number;
}

export interface StockMovement {
  id: string;
  productId: string;
  productName?: string;
  type: "ENTREE" | "SORTIE" | "AJUSTEMENT";
  quantity: number;
  stockBefore: number;
  stockAfter: number;
  reason?: string | null;
  refType?: string | null;
  refId?: string | null;
  userName?: string | null;
  createdAt: string;
}

// ─── Inventaire / État du stock ─────────────────────────────────────────────

/** Ligne inventaire d'un produit sur une période donnée */
export interface InventoryProductRow {
  productId: string;
  name: string;
  reference?: string | null;
  category: string;
  categoryLabel: string;
  unit: string;
  minStock: number;
  purchasePrice: number;
  salePrice: number;
  /** Stock en début de période (rejoué depuis le journal des mouvements) */
  stockInitial: number;
  /** Quantités achetées sur la période (entrées refType=ACHAT) */
  achats: number;
  /** Quantités vendues sur la période (sorties refType=VENTE) */
  ventes: number;
  /** Retours + ajustements + entrées initiales (signé) */
  retoursAjustements: number;
  /** Stock final = initial + achats − ventes + retours/ajustements */
  stockFinal: number;
  /** Stock réel actuel du produit (référence) */
  currentStock: number;
  /** stockFinal × prix d'achat */
  valeurStockAchat: number;
  /** stockFinal × prix de vente */
  valeurStockVente: number;
  /** ventes × prix de vente */
  ventesValeur: number;
  /** ventes × (prix de vente − prix d'achat) */
  marge: number;
}

/** Agrégat inventaire d'une catégorie (avec détail produits) */
export interface InventoryCategoryRow {
  category: string;
  label: string;
  productCount: number;
  stockInitial: number;
  achats: number;
  ventes: number;
  retoursAjustements: number;
  stockFinal: number;
  valeurStockAchat: number;
  valeurStockVente: number;
  ventesValeur: number;
  marge: number;
  products: InventoryProductRow[];
}

/** Réponse de l'API /api/inventory */
export interface InventoryResponse {
  period: {
    type: "semaine" | "mensuel" | "trimestriel" | "semestriel" | "annuel";
    label: string;
    startDate: string;
    endDate: string;
    startLabel: string;
    endLabel: string;
  };
  products: InventoryProductRow[];
  categories: InventoryCategoryRow[];
  totals: {
    productCount: number;
    stockInitial: number;
    achats: number;
    ventes: number;
    retoursAjustements: number;
    stockFinal: number;
    valeurStockAchat: number;
    valeurStockVente: number;
    ventesValeur: number;
    marge: number;
  };
}

export interface AuditLogEntry {
  id: string;
  userId?: string | null;
  userName?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  details?: string | null;
  createdAt: string;
}

export interface OrderItem {
  id?: string;
  productId?: string | null;
  productName: string;
  category?: string | null;
  unit: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface Order {
  id: string;
  number: string;
  clientId?: string | null;
  client?: Client | null;
  clientName: string;
  date: string;
  deliveryDate?: string | null;
  status: "EN_COURS" | "CONFIRMEE" | "LIVREE" | "ANNULEE";
  notes?: string | null;
  items: OrderItem[];
  createdAt: string;
}

export interface DashboardStats {
  year: number;
  month: string;
  invoiceCount: number;
  proformaCount: number;
  clientCount: number;
  productCount: number;
  revenueTotal: number;
  paidTotal: number;
  unpaidTotal: number;
  purchaseTotal: number;
  pendingOrders: number;
  prevYearRevenue: number;
  lowStock: Product[];
  monthlyRevenue: { month: string; monthKey: string; total: number; paid: number }[];
  dailyRevenue: { day: number; total: number; count: number }[];
  tranches: { label: string; count: number; total: number }[];
  topClients: { name: string; total: number }[];
  recentInvoices: Invoice[];
  topCategories: { category: string; label: string; total: number }[];
  /** Statistiques du jour (ventes, encaissements) */
  today: DashboardToday;
  /** Répartition des factures de vente par statut de paiement */
  statusCounts: { PAYE: number; PARTIEL: number; NON_PAYE: number };
  /** Achats à crédit (Commerçant + Immo) */
  credit: { count: number; total: number; paid: number; reste: number };
}

export interface DashboardToday {
  /** Total TTC des factures de vente du jour */
  sales: number;
  /** Somme des versements encaissés du jour (factures) */
  received: number;
  /** Nombre de factures de vente du jour */
  invoiceCount: number;
  /** Nombre de versements du jour */
  paymentCount: number;
  /** Nombre de proformas du jour */
  proformaCount: number;
}

// ─── Rapport du jour ────────────────────────────────────────────────────────

export interface DailyPaymentRow {
  id: string;
  amount: number;
  method: string;
  paidAt: string;
  note?: string | null;
  invoiceNumber: string;
  clientName: string;
}

export interface DailyCreditPaymentRow {
  id: string;
  amount: number;
  method: string;
  paidAt: string;
  note?: string | null;
  number: string;
  tier: string;
  destination: "COMMERCANT" | "IMMO";
}

export interface DailyReport {
  date: string;
  summary: {
    invoiceCount: number;
    proformaCount: number;
    totalHT: number;
    totalTTC: number;
    vatTotal: number;
    /** Somme des versements factures encaissés ce jour */
    receivedTotal: number;
    /** Somme des règlements crédit (Commerçant + Immo) ce jour */
    creditPaidTotal: number;
    paidCount: number;
    partialCount: number;
    unpaidCount: number;
  };
  invoices: Invoice[];
  payments: DailyPaymentRow[];
  creditPayments: DailyCreditPaymentRow[];
  byMethod: { method: string; label: string; amount: number; count: number }[];
}

// ─── Paramètres société ─────────────────────────────────────────────────────

export interface Settings {
  id: string;
  nomSociete: string;
  tagline: string;
  adresse: string;
  telephone: string;
  email: string;
  rc: string;
  ninea: string;
  logo?: string | null;
  maintenanceActive?: boolean;
  maintenanceSince?: string | null;
  updatedAt?: string;
}

// ─── Utilisateurs ───────────────────────────────────────────────────────────

export interface AuthUser {
  id: string;
  username: string;
  name: string;
  role: "ADMIN" | "EMPLOYE";
}

export interface UserRecord {
  id: string;
  username: string;
  name: string;
  role: "ADMIN" | "EMPLOYE";
  actif: boolean;
  createdAt: string;
  updatedAt: string;
}

// ─── Rapports de vente ──────────────────────────────────────────────────────

export interface SalesReportSummary {
  count: number;
  totalHT: number;
  totalTTC: number;
  vatTotal: number;
  paidTotal: number;
  unpaidTotal: number;
  avgTicket: number;
  paidCount: number;
  partialCount: number;
  unpaidCount: number;
  deliveredCount: number;
  notDeliveredCount: number;
  itemsCount: number;
  margin: number;
  marginPct: number;
  prevTotalTTC: number;
  prevCount: number;
}

// ─── Dépôts clients ──────────────────────────────────────────────────────────

export interface ClientWithdrawal {
  id: string;
  depositId: string;
  amount: number;
  date: string;
  note?: string | null;
  createdAt: string;
}

export interface ClientDeposit {
  id: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
  amount: number;
  method: string;
  date: string;
  notes?: string | null;
  createdAt: string;
  withdrawals?: ClientWithdrawal[];
}

export interface SalesReport {
  from: string;
  to: string;
  summary: SalesReportSummary;
  monthly: { monthKey: string; label: string; total: number; paid: number; margin: number }[];
  topClients: { name: string; count: number; total: number }[];
  byCategory: { category: string; label: string; total: number; quantity: number; margin: number }[];
  topProducts: { name: string; quantity: number; total: number; margin: number }[];
  invoices: Invoice[];
}
