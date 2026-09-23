import { db } from "@/lib/db";

/**
 * Synchronisation Facture ↔ Achat à crédit (rubriques Commerçant / Immo).
 *
 * Règle de gestion : toute modification d'un document (édition de la facture,
 * versement enregistré dans l'onglet Factures ou dans l'onglet Commerçant)
 * doit être répercutée à la fois sur la facture et sur l'achat à crédit lié.
 *
 * Le montant payé d'une facture = somme des versements facture (Payment)
 * + somme des versements achat à crédit (CreditPayment du transfert lié)
 * + un éventuel composant saisi manuellement depuis l'éditeur de facture
 *   (statut de paiement / montant payé sans versement tracé).
 */

/** Statut de paiement déduit du montant payé (identique aux autres routes). */
function computePaymentStatus(totalTTC: number, amountPaid: number): "PAYE" | "PARTIEL" | "NON_PAYE" {
  if (amountPaid >= totalTTC) return "PAYE";
  if (amountPaid > 0) return "PARTIEL";
  return "NON_PAYE";
}

/**
 * Recalcule le montant payé d'une facture à partir de TOUS les versements
 * puis synchronise l'achat à crédit lié (total + montant réglé + statut).
 *
 * À appeler juste après une variation des versements enregistrés.
 *
 * @param invoiceId facture concernée
 * @param delta     variation du total des versements venant d'être appliquée
 *                  (ex. +5000 après création d'un versement, -5000 après suppression)
 */
export async function syncPaidAmounts(invoiceId: string, delta: number): Promise<void> {
  const invoice = await db.invoice.findUnique({ where: { id: invoiceId } });
  if (!invoice) return;

  const [invAgg, credit] = await Promise.all([
    db.payment.aggregate({ where: { invoiceId }, _sum: { amount: true } }),
    db.creditPurchase.findUnique({ where: { sourceId: invoiceId } }),
  ]);
  const invoiceSum = invAgg._sum.amount ?? 0;

  let creditSum = 0;
  if (credit) {
    const crAgg = await db.creditPayment.aggregate({
      where: { purchaseId: credit.id },
      _sum: { amount: true },
    });
    creditSum = crAgg._sum.amount ?? 0;
  }

  // Composant saisi manuellement sur la facture (hors versements tracés),
  // déduit de l'état AVANT la dernière variation de versement.
  const recordedBefore = invoiceSum + creditSum - delta;
  const manual = Math.max(0, invoice.amountPaid - recordedBefore);

  const amountPaid = Math.min(invoiceSum + creditSum + manual, invoice.totalTTC);
  const paymentStatus = computePaymentStatus(invoice.totalTTC, amountPaid);

  const updates: Promise<unknown>[] = [
    db.invoice.update({ where: { id: invoice.id }, data: { amountPaid, paymentStatus } }),
  ];
  if (credit) {
    updates.push(
      db.creditPurchase.update({
        where: { id: credit.id },
        data: { total: invoice.totalTTC, amountPaid },
      })
    );
  }
  await Promise.all(updates);
}

/**
 * Synchronise l'achat à crédit lié depuis l'état actuel de la facture.
 * À appeler après une édition de la facture (PUT) : le total TTC et le montant
 * payé définis dans l'éditeur font foi et sont répercutés sur Commerçant / Immo.
 */
export async function syncCreditFromInvoice(invoiceId: string): Promise<void> {
  const invoice = await db.invoice.findUnique({ where: { id: invoiceId } });
  if (!invoice) return;
  const credit = await db.creditPurchase.findUnique({ where: { sourceId: invoiceId } });
  if (!credit) return;
  await db.creditPurchase.update({
    where: { id: credit.id },
    data: {
      total: invoice.totalTTC,
      amountPaid: Math.min(invoice.amountPaid, invoice.totalTTC),
    },
  });
}
