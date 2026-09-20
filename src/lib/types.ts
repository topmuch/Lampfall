// Types partagés entre le frontend et les API (versions sérialisées JSON)

export interface Client {
  id: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  type: string;
  notes?: string | null;
  createdAt: string;
}

export interface Product {
  id: string;
  name: string;
  reference?: string | null;
  category: string;
  purchasePrice: number;
  salePrice: number;
  stock: number;
  unit: string;
  minStock: number;
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
  createdAt: string;
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
  date: string;
  total: number;
  fileName?: string | null;
  fileType?: string | null;
  fileSize?: number | null;
  notes?: string | null;
  items: PurchaseItem[];
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
  invoiceCount: number;
  proformaCount: number;
  clientCount: number;
  productCount: number;
  revenueTotal: number;
  paidTotal: number;
  unpaidTotal: number;
  purchaseTotal: number;
  pendingOrders: number;
  lowStock: Product[];
  monthlyRevenue: { month: string; total: number; paid: number }[];
  recentInvoices: Invoice[];
  topCategories: { category: string; total: number }[];
}
