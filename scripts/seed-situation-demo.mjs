// Crée 5 factures VENTE de démonstration pour « Alioune Sow »
// (simule l'exemple « Senhotel : 5 factures » de l'utilisateur).
// Idempotent : supprime d'abord les factures de test existantes.
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const YEAR = new Date().getFullYear();

const client = await db.client.findFirst({
  where: { name: { contains: "Alioune" } },
});
if (!client) {
  console.error("Client « Alioune Sow » introuvable — lancez le seed d'abord.");
  process.exit(1);
}

// Nettoyage idempotent (factures de démo FV/PF année en cours, série 9xxx)
await db.invoice.deleteMany({ where: { number: { endsWith: "-9001" } } });
await db.invoice.deleteMany({ where: { number: { endsWith: "-9002" } } });
await db.invoice.deleteMany({ where: { number: { endsWith: "-9003" } } });
await db.invoice.deleteMany({ where: { number: { endsWith: "-9004" } } });
await db.invoice.deleteMany({ where: { number: { endsWith: "-9005" } } });
await db.invoice.deleteMany({ where: { number: { endsWith: "-9006" } } });

const defs = [
  // [seq, daysAgo, delivery, payment, amountPaid, items]
  [1, 45, "LIVRE", "PAYE", null, [["Mitigeur lavabo chromé", 4, 20000]]],
  [2, 32, "LIVRE", "PARTIEL", 150000, [["Cuve réservoir d'eau 1000L", 2, 105000], ["Pompe surpresseur 800W", 1, 95000]]],
  [3, 21, "NON_LIVRE", "NON_PAYE", 0, [["Cabine de douche 80x80", 3, 120000]]],
  [4, 14, "NON_LIVRE", "PAYE", null, [["Lustre moderne 5 branches doré", 2, 85000]]],
  [5, 3, "LIVRE", "PARTIEL", 50000, [["Tube PPR Ø25 (barre 4m)", 30, 4500], ["Coude PPR 90° femelle", 40, 1600]]],
];

for (const [seq, daysAgo, delivery, payment, amountPaid, items] of defs) {
  const totalHT = items.reduce((s, [, q, pu]) => s + q * pu, 0);
  const totalTTC = Math.round(totalHT * 1.18);
  const paid = amountPaid === null ? totalTTC : amountPaid;
  await db.invoice.create({
    data: {
      number: `FV-${YEAR}-9${String(seq).padStart(3, "0")}`,
      type: "VENTE",
      clientId: client.id,
      clientName: client.name,
      clientPhone: client.phone,
      date: new Date(Date.now() - daysAgo * 86_400_000),
      deliveryStatus: delivery,
      paymentStatus: payment,
      amountPaid: paid,
      taxRate: 18,
      totalHT,
      totalTTC,
      items: {
        create: items.map(([name, q, pu]) => ({
          productName: name,
          quantity: q,
          unitPrice: pu,
          total: q * pu,
        })),
      },
    },
  });
  console.log(`  + FV-${YEAR}-9${String(seq).padStart(3, "0")} | TTC=${totalTTC} | payé=${paid} | ${delivery} | ${payment}`);
}

// Une PROFORMA pour vérifier l'exclusion (Option A : seules les VENTE comptent)
{
  const totalHT = 10 * 24000;
  const totalTTC = Math.round(totalHT * 1.18);
  await db.invoice.create({
    data: {
      number: `PF-${YEAR}-9006`,
      type: "PROFORMA",
      clientId: client.id,
      clientName: client.name,
      clientPhone: client.phone,
      date: new Date(Date.now() - 5 * 86_400_000),
      deliveryStatus: "NON_LIVRE",
      paymentStatus: "NON_PAYE",
      amountPaid: 0,
      taxRate: 18,
      totalHT,
      totalTTC,
      items: {
        create: [
          { productName: "Réservoir WC plastique double chasse", quantity: 10, unitPrice: 24000, total: totalHT },
        ],
      },
    },
  });
  console.log(`  + PF-${YEAR}-9006 (PROFORMA, ne doit PAS apparaître dans la situation)`);
}

console.log("5 factures VENTE + 1 proforma créées pour", client.name);
await db.$disconnect();
