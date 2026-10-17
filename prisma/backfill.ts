// Backfill : versements initiaux à partir de amountPaid + snapshot des prix d'achat
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  // 1. Créer un versement initial pour les factures avec amountPaid > 0 mais aucun versement
  const invoices = await db.invoice.findMany({
    where: { amountPaid: { gt: 0 } },
    include: { payments: true },
  });
  let paymentsCreated = 0;
  for (const inv of invoices) {
    if (inv.payments.length === 0) {
      await db.payment.create({
        data: {
          invoiceId: inv.id,
          amount: inv.amountPaid,
          method: "ESPECES",
          paidAt: inv.date,
          note: "Versement initial (importé)",
        },
      });
      paymentsCreated += 1;
    }
  }

  // 2. Renseigner le prix d'achat des lignes de facture existantes (calcul de marge)
  const items = await db.invoiceItem.findMany({
    where: { purchasePrice: null, productId: { not: null } },
  });
  let itemsUpdated = 0;
  for (const it of items) {
    if (!it.productId) continue;
    const p = await db.product.findUnique({ where: { id: it.productId } });
    if (p) {
      await db.invoiceItem.update({
        where: { id: it.id },
        data: { purchasePrice: p.purchasePrice },
      });
      itemsUpdated += 1;
    }
  }

  console.log(`Backfill OK : ${paymentsCreated} versement(s) créé(s), ${itemsUpdated} ligne(s) mise(s) à jour.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
