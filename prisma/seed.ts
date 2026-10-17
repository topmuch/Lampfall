import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

const year = new Date().getFullYear();

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(10, 30, 0, 0);
  return d;
}

async function main() {
  console.log("Nettoyage…");
  await db.invoiceItem.deleteMany();
  await db.invoice.deleteMany();
  await db.purchaseItem.deleteMany();
  await db.purchase.deleteMany();
  await db.orderItem.deleteMany();
  await db.order.deleteMany();
  await db.client.deleteMany();
  await db.product.deleteMany();

  console.log("Produits…");
  const products = [
    { name: "WC complet à poser Blanc", reference: "SAN-WC-001", category: "SANITAIRE", purchasePrice: 45000, salePrice: 65000, stock: 12, unit: "pièce", minStock: 3 },
    { name: "Lavabo céramique sur colonne", reference: "SAN-LAV-002", category: "SANITAIRE", purchasePrice: 38000, salePrice: 55000, stock: 8, unit: "pièce", minStock: 3 },
    { name: "Cabine de douche 80x80", reference: "SAN-CD-003", category: "SANITAIRE", purchasePrice: 85000, salePrice: 120000, stock: 4, unit: "pièce", minStock: 2 },
    { name: "Tube PVC Ø100 (barre 4m)", reference: "PLB-PVC-100", category: "PLOMBERIE", purchasePrice: 6500, salePrice: 9500, stock: 40, unit: "barre", minStock: 10 },
    { name: "Coude PVC 90° Ø100", reference: "PLB-COD-100", category: "PLOMBERIE", purchasePrice: 1500, salePrice: 2500, stock: 60, unit: "pièce", minStock: 15 },
    { name: "Plafonnier LED 24W rond", reference: "LUM-LED-024", category: "LUMINAIRE", purchasePrice: 5500, salePrice: 8500, stock: 30, unit: "pièce", minStock: 8 },
    { name: "Lustre moderne 5 branches doré", reference: "LUM-LUS-005", category: "LUMINAIRE", purchasePrice: 55000, salePrice: 85000, stock: 5, unit: "pièce", minStock: 2 },
    { name: "Ampoule LED E27 9W", reference: "ELE-AMP-009", category: "ELECTRICITE", purchasePrice: 700, salePrice: 1500, stock: 150, unit: "pièce", minStock: 30 },
    { name: "Interrupteur simple blanc Legrand", reference: "ELE-INT-001", category: "ELECTRICITE", purchasePrice: 1800, salePrice: 3500, stock: 45, unit: "pièce", minStock: 10 },
    { name: "Câble électrique 2,5mm² (rouleau 100m)", reference: "ELE-CAB-250", category: "ELECTRICITE", purchasePrice: 32000, salePrice: 45000, stock: 14, unit: "rouleau", minStock: 5 },
    { name: "Kit goutte-à-goutte 100m", reference: "GAG-KIT-100", category: "GOUTTE_A_GOUTTE", purchasePrice: 28000, salePrice: 42000, stock: 9, unit: "kit", minStock: 3 },
    { name: "Goutteur régulé 4L/h (lot de 50)", reference: "GAG-GTT-050", category: "GOUTTE_A_GOUTTE", purchasePrice: 7500, salePrice: 12000, stock: 20, unit: "lot", minStock: 5 },
    { name: "Tube PPR Ø25 (barre 4m)", reference: "TUY-PPR-025", category: "TUYAUTERIE", purchasePrice: 2800, salePrice: 4500, stock: 50, unit: "barre", minStock: 12 },
    { name: "Coude PPR Ø25 femelle", reference: "TUY-COD-025", category: "TUYAUTERIE", purchasePrice: 900, salePrice: 1600, stock: 80, unit: "pièce", minStock: 20 },
    { name: "Miroir rectangulaire 60x80 avec cadre", reference: "MIR-6080-01", category: "MIROITERIE", purchasePrice: 22000, salePrice: 35000, stock: 6, unit: "pièce", minStock: 2 },
    { name: "Miroir rond lumineux Ø60", reference: "MIR-RND-060", category: "MIROITERIE", purchasePrice: 32000, salePrice: 50000, stock: 2, unit: "pièce", minStock: 2 },
    { name: "Mitigeur lavabo chromé", reference: "ROB-MIT-LAV", category: "ROBINETTERIE", purchasePrice: 12500, salePrice: 20000, stock: 18, unit: "pièce", minStock: 5 },
    { name: "Robinet d'arrêt Ø15", reference: "ROB-ARR-015", category: "ROBINETTERIE", purchasePrice: 2500, salePrice: 4000, stock: 35, unit: "pièce", minStock: 10 },
    { name: "Pompe surpresseur 800W", reference: "POM-SUR-800", category: "POMPE", purchasePrice: 65000, salePrice: 95000, stock: 6, unit: "pièce", minStock: 2 },
    { name: "Pompe immergée 1CV", reference: "POM-IMM-100", category: "POMPE", purchasePrice: 95000, salePrice: 140000, stock: 3, unit: "pièce", minStock: 2 },
    { name: "Chasse de douche complète", reference: "CHS-DCH-001", category: "CHASSE_DOUCHE", purchasePrice: 8500, salePrice: 14000, stock: 15, unit: "pièce", minStock: 4 },
    { name: "Réservoir WC plastique double chasse", reference: "RES-WC-002", category: "RESERVOIR_EAU", purchasePrice: 15000, salePrice: 24000, stock: 10, unit: "pièce", minStock: 3 },
    { name: "Cuve réservoir d'eau 1000L", reference: "RES-EAU-1000", category: "RESERVOIR_EAU", purchasePrice: 75000, salePrice: 105000, stock: 1, unit: "pièce", minStock: 2 },
  ];
  for (const p of products) {
    await db.product.create({ data: p });
  }
  const createdProducts = await db.product.findMany();

  console.log("Clients…");
  const clients = [
    { name: "M. Abdoulaye Diop", phone: "+221 77 512 34 56", email: "a.diop@gmail.com", address: "Sacré-Cœur 3, Dakar", type: "PARTICULIER" },
    { name: "Mme Fatou Ndiaye", phone: "+221 76 998 12 34", email: "fatou.ndiaye@yahoo.fr", address: "Ouakam, Dakar", type: "PARTICULIER" },
    { name: "SARL BTP Teranga", phone: "+221 33 869 00 11", email: "contact@btpteranga.sn", address: "Zone industrielle, Rufisque", type: "ENTREPRISE" },
    { name: "Hôtel Les Palmiers", phone: "+221 77 654 32 10", email: "achats@lespalmiers.sn", address: "Route de Ngor, Dakar", type: "ENTREPRISE" },
    { name: "M. Ibrahima Sarr", phone: "+221 70 123 45 67", email: null, address: "Guédiawaye", type: "PARTICULIER" },
    { name: "Promoteur Keur Dansa", phone: "+221 78 456 78 90", email: "info@keurdansa.com", address: "Diamniadio", type: "ENTREPRISE" },
  ];
  const createdClients = [];
  for (const c of clients) {
    createdClients.push(await db.client.create({ data: c }));
  }

  console.log("Factures…");
  const cat = (name: string) => createdProducts.find((p) => p.name === name)!;

  async function createInvoice(opts: {
    type: "VENTE" | "PROFORMA";
    seq: number;
    clientIdx: number;
    daysAgo: number;
    delivery: "LIVRE" | "NON_LIVRE";
    payment: "PAYE" | "PARTIEL" | "NON_PAYE";
    items: { p: string; q: number; price?: number }[];
    taxRate?: number;
  }) {
    const client = createdClients[opts.clientIdx];
    const items = opts.items.map((it) => {
      const prod = cat(it.p);
      const unitPrice = it.price ?? prod.salePrice;
      return {
        productId: prod.id,
        productName: prod.name,
        category: prod.category,
        unit: prod.unit,
        quantity: it.q,
        unitPrice,
        total: it.q * unitPrice,
      };
    });
    const totalHT = items.reduce((s, i) => s + i.total, 0);
    const taxRate = opts.taxRate ?? 18;
    const totalTTC = Math.round(totalHT * (1 + taxRate / 100));
    const amountPaid =
      opts.payment === "PAYE" ? totalTTC : opts.payment === "PARTIEL" ? Math.round(totalTTC / 2) : 0;
    const prefix = opts.type === "VENTE" ? "FV" : "PF";
    return db.invoice.create({
      data: {
        number: `${prefix}-${year}-${String(opts.seq).padStart(4, "0")}`,
        type: opts.type,
        clientId: client.id,
        clientName: client.name,
        clientPhone: client.phone,
        clientAddress: client.address,
        date: daysAgo(opts.daysAgo),
        deliveryStatus: opts.delivery,
        paymentStatus: opts.payment,
        amountPaid,
        taxRate,
        totalHT,
        totalTTC,
        items: { create: items },
      },
    });
  }

  await createInvoice({ type: "VENTE", seq: 1, clientIdx: 0, daysAgo: 45, delivery: "LIVRE", payment: "PAYE", items: [{ p: "WC complet à poser Blanc", q: 2 }, { p: "Mitigeur lavabo chromé", q: 2 }] });
  await createInvoice({ type: "VENTE", seq: 2, clientIdx: 2, daysAgo: 40, delivery: "LIVRE", payment: "PARTIEL", items: [{ p: "Tube PVC Ø100 (barre 4m)", q: 30 }, { p: "Coude PVC 90° Ø100", q: 40 }, { p: "Tube PPR Ø25 (barre 4m)", q: 20 }] });
  await createInvoice({ type: "VENTE", seq: 3, clientIdx: 3, daysAgo: 33, delivery: "LIVRE", payment: "PAYE", items: [{ p: "Plafonnier LED 24W rond", q: 25 }, { p: "Ampoule LED E27 9W", q: 100 }, { p: "Lustre moderne 5 branches doré", q: 4 }] });
  await createInvoice({ type: "VENTE", seq: 4, clientIdx: 1, daysAgo: 25, delivery: "NON_LIVRE", payment: "NON_PAYE", items: [{ p: "Cabine de douche 80x80", q: 1 }, { p: "Chasse de douche complète", q: 1 }] });
  await createInvoice({ type: "VENTE", seq: 5, clientIdx: 4, daysAgo: 18, delivery: "LIVRE", payment: "PAYE", items: [{ p: "Pompe surpresseur 800W", q: 1 }, { p: "Robinet d'arrêt Ø15", q: 6 }] });
  await createInvoice({ type: "VENTE", seq: 6, clientIdx: 5, daysAgo: 12, delivery: "LIVRE", payment: "NON_PAYE", items: [{ p: "Kit goutte-à-goutte 100m", q: 3 }, { p: "Goutteur régulé 4L/h (lot de 50)", q: 4 }, { p: "Cuve réservoir d'eau 1000L", q: 2 }] });
  await createInvoice({ type: "VENTE", seq: 7, clientIdx: 0, daysAgo: 6, delivery: "NON_LIVRE", payment: "PARTIEL", items: [{ p: "Miroir rectangulaire 60x80 avec cadre", q: 2 }, { p: "Lavabo céramique sur colonne", q: 1 }] });
  await createInvoice({ type: "PROFORMA", seq: 1, clientIdx: 5, daysAgo: 9, delivery: "NON_LIVRE", payment: "NON_PAYE", items: [{ p: "Réservoir WC plastique double chasse", q: 10 }, { p: "WC complet à poser Blanc", q: 10 }, { p: "Lavabo céramique sur colonne", q: 8 }] });
  await createInvoice({ type: "PROFORMA", seq: 2, clientIdx: 3, daysAgo: 4, delivery: "NON_LIVRE", payment: "NON_PAYE", items: [{ p: "Interrupteur simple blanc Legrand", q: 40 }, { p: "Câble électrique 2,5mm² (rouleau 100m)", q: 10 }, { p: "Plafonnier LED 24W rond", q: 30 }] });
  await createInvoice({ type: "PROFORMA", seq: 3, clientIdx: 2, daysAgo: 2, delivery: "NON_LIVRE", payment: "NON_PAYE", items: [{ p: "Miroir rond lumineux Ø60", q: 5 }, { p: "Mitigeur lavabo chromé", q: 10 }] });

  console.log("Achats…");
  const suppliers = ["SOTRA Import", "Plomberie China Import", "Ets Moussa Distribution"];
  for (let i = 0; i < 3; i++) {
    const items = [
      { productName: "Tube PVC Ø100 (barre 4m)", quantity: 50, unitPrice: 6500, total: 325000 },
      { productName: "Coude PVC 90° Ø100", quantity: 100, unitPrice: 1500, total: 150000 },
    ];
    await db.purchase.create({
      data: {
        number: `FA-${year}-${String(i + 1).padStart(4, "0")}`,
        supplier: suppliers[i],
        date: daysAgo(50 - i * 12),
        total: items.reduce((s, it) => s + it.total, 0),
        notes: i === 0 ? "Réapprovisionnement mensuel" : null,
        items: { create: items },
      },
    });
  }

  console.log("Commandes prévisionnelles…");
  async function createOrder(opts: {
    seq: number;
    clientIdx: number;
    daysAgo: number;
    status: string;
    items: { p: string; q: number }[];
  }) {
    const client = createdClients[opts.clientIdx];
    const items = opts.items.map((it) => {
      const prod = cat(it.p);
      return {
        productId: prod.id,
        productName: prod.name,
        category: prod.category,
        unit: prod.unit,
        quantity: it.q,
        unitPrice: prod.salePrice,
        total: it.q * prod.salePrice,
      };
    });
    const deliveryDate = new Date();
    deliveryDate.setDate(deliveryDate.getDate() + 14 - opts.daysAgo);
    return db.order.create({
      data: {
        number: `CMD-${year}-${String(opts.seq).padStart(4, "0")}`,
        clientId: client.id,
        clientName: client.name,
        date: daysAgo(opts.daysAgo),
        deliveryDate,
        status: opts.status,
        items: { create: items },
      },
    });
  }
  await createOrder({ seq: 1, clientIdx: 5, daysAgo: 10, status: "EN_COURS", items: [{ p: "WC complet à poser Blanc", q: 12 }, { p: "Lavabo céramique sur colonne", q: 10 }, { p: "Mitigeur lavabo chromé", q: 15 }] });
  await createOrder({ seq: 2, clientIdx: 3, daysAgo: 5, status: "CONFIRMEE", items: [{ p: "Plafonnier LED 24W rond", q: 40 }, { p: "Ampoule LED E27 9W", q: 200 }] });
  await createOrder({ seq: 3, clientIdx: 2, daysAgo: 2, status: "EN_COURS", items: [{ p: "Cuve réservoir d'eau 1000L", q: 4 }, { p: "Pompe immergée 1CV", q: 2 }] });

  const counts = {
    clients: await db.client.count(),
    products: await db.product.count(),
    invoices: await db.invoice.count(),
    purchases: await db.purchase.count(),
    orders: await db.order.count(),
  };
  console.log("Terminé :", counts);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
