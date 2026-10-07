// Inspection de la base locale : clients + factures (VENTE/PROFORMA)
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

const clients = await db.client.findMany({ orderBy: { name: "asc" } });
console.log("── CLIENTS (" + clients.length + ") ──");
for (const c of clients) {
  console.log(`  ${c.name} | ${c.phone ?? "—"} | ${c.type}`);
}

const invoices = await db.invoice.findMany({
  orderBy: { date: "desc" },
  include: { client: true },
});
console.log("\n── FACTURES (" + invoices.length + ") ──");
for (const f of invoices) {
  console.log(
    `  ${f.number} | ${f.type} | ${f.clientName} | TTC=${f.totalTTC} | payé=${f.amountPaid} | ${f.deliveryStatus} | ${f.paymentStatus}`
  );
}

await db.$disconnect();
