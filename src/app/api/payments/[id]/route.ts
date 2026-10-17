import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { syncPaidAmounts } from "@/lib/credit-sync";

type Params = { params: Promise<{ id: string }> };

// ─── DELETE : supprimer un versement et recalculer la facture liée ──────────

/**
 * Supprime un versement de la facture. Si la facture est transférée en achat
 * à crédit (Commerçant / Immo), l'achat lié est synchronisé afin que la mise
 * à jour soit visible à la fois dans Factures et dans Commerçant.
 */
export async function DELETE(_request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;

    const payment = await db.payment.findUnique({ where: { id } });
    if (!payment) {
      return NextResponse.json({ error: "Versement introuvable" }, { status: 404 });
    }

    const target = await db.invoice.findUnique({ where: { id: payment.invoiceId } });
    if (!target) {
      return NextResponse.json({ error: "Facture introuvable" }, { status: 404 });
    }

    await db.payment.delete({ where: { id } });

    // Recalcule le montant payé (versements facture + crédit + manuel) et
    // synchronise l'achat à crédit lié.
    await syncPaidAmounts(target.id, -payment.amount);

    const freshInvoice = await db.invoice.findUnique({ where: { id: target.id } });

    return NextResponse.json({ invoice: freshInvoice });
  } catch (error) {
    console.error("DELETE /api/payments/[id]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
