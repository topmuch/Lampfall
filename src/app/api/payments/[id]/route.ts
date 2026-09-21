import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

/** PAYE si amountPaid >= totalTTC, PARTIEL si > 0, sinon NON_PAYE. */
function computePaymentStatus(totalTTC: number, amountPaid: number): string {
  if (amountPaid >= totalTTC) return "PAYE";
  if (amountPaid > 0) return "PARTIEL";
  return "NON_PAYE";
}

// ─── DELETE : supprimer un versement et recalculer la facture liée ──────────

export async function DELETE(_request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;

    const invoice = await db.$transaction(async (tx) => {
      const payment = await tx.payment.findUnique({ where: { id } });
      if (!payment) return null;

      await tx.payment.delete({ where: { id } });

      const target = await tx.invoice.findUnique({ where: { id: payment.invoiceId } });
      if (!target) return null;

      const agg = await tx.payment.aggregate({
        where: { invoiceId: payment.invoiceId },
        _sum: { amount: true },
      });
      const sum = agg._sum.amount ?? 0;
      const amountPaid = Math.min(sum, target.totalTTC);
      const paymentStatus = computePaymentStatus(target.totalTTC, amountPaid);

      return tx.invoice.update({
        where: { id: target.id },
        data: { amountPaid, paymentStatus },
      });
    });

    if (!invoice) {
      return NextResponse.json({ error: "Versement introuvable" }, { status: 404 });
    }

    return NextResponse.json({ invoice });
  } catch (error) {
    console.error("DELETE /api/payments/[id]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
