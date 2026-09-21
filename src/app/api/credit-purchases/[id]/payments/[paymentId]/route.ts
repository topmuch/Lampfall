import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";

type Params = { params: Promise<{ id: string; paymentId: string }> };

/** Supprime un versement d'un achat à crédit (montant décrémenté). */
export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const { id, paymentId } = await params;
    const payment = await db.creditPayment.findUnique({ where: { id: paymentId } });
    if (!payment || payment.purchaseId !== id) {
      return NextResponse.json({ error: "Versement introuvable" }, { status: 404 });
    }
    await db.creditPayment.delete({ where: { id: paymentId } });
    const updated = await db.creditPurchase.update({
      where: { id },
      data: { amountPaid: { decrement: payment.amount } },
      include: { payments: { orderBy: { paidAt: "desc" } } },
    });
    await logAudit(request, "DELETE", "CreditPayment", paymentId, `Achat à crédit ${id}`);
    return NextResponse.json({ ok: true, purchase: updated });
  } catch (error) {
    console.error("DELETE /api/credit-purchases/[id]/payments/[paymentId]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
