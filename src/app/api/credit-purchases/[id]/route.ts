import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";

type Params = { params: Promise<{ id: string }> };

/** Récupère un achat à crédit. */
export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const purchase = await db.creditPurchase.findUnique({
      where: { id },
      include: { payments: { orderBy: { paidAt: "desc" } } },
    });
    if (!purchase) {
      return NextResponse.json({ error: "Achat à crédit introuvable" }, { status: 404 });
    }
    return NextResponse.json(purchase);
  } catch (error) {
    console.error("GET /api/credit-purchases/[id]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/** Annule le transfert : supprime l'achat à crédit (la facture d'origine est conservée). */
export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const purchase = await db.creditPurchase.findUnique({ where: { id } });
    if (!purchase) {
      return NextResponse.json({ error: "Achat à crédit introuvable" }, { status: 404 });
    }
    await db.creditPurchase.delete({ where: { id } });
    await logAudit(request, "DELETE", "CreditPurchase", id, `${purchase.number} (${purchase.destination})`);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/credit-purchases/[id]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
