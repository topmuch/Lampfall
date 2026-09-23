import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { syncPaidAmounts } from "@/lib/credit-sync";

type Params = { params: Promise<{ id: string; paymentId: string }> };

/**
 * Supprime un versement d'un achat à crédit. La facture d'origine est
 * synchronisée (montant payé + statut) afin que la mise à jour soit visible
 * à la fois dans l'onglet Commerçant et dans Factures.
 */
export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const { id, paymentId } = await params;
    const payment = await db.creditPayment.findUnique({ where: { id: paymentId } });
    if (!payment || payment.purchaseId !== id) {
      return NextResponse.json({ error: "Versement introuvable" }, { status: 404 });
    }
    const purchase = await db.creditPurchase.findUnique({ where: { id } });
    if (!purchase) {
      return NextResponse.json({ error: "Achat à crédit introuvable" }, { status: 404 });
    }

    await db.creditPayment.delete({ where: { id: paymentId } });

    const invoice = await db.invoice.findUnique({ where: { id: purchase.sourceId }, select: { id: true } });
    if (invoice) {
      // Synchronise la facture ET l'achat à crédit (montants + statuts)
      await syncPaidAmounts(purchase.sourceId, -payment.amount);
    } else {
      // Document source introuvable (donnée orpheline) : mise à jour locale
      await db.creditPurchase.update({
        where: { id },
        data: { amountPaid: { decrement: payment.amount } },
      });
    }

    const updated = await db.creditPurchase.findUnique({
      where: { id },
      include: { payments: { orderBy: { paidAt: "desc" } } },
    });

    await logAudit(request, "DELETE", "CreditPayment", paymentId, `Achat à crédit ${purchase.number}`);
    return NextResponse.json({ ok: true, purchase: updated });
  } catch (error) {
    console.error("DELETE /api/credit-purchases/[id]/payments/[paymentId]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
