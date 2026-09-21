import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";

type Params = { params: Promise<{ id: string }> };

/** Liste des versements d'un achat à crédit. */
export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const payments = await db.creditPayment.findMany({
      where: { purchaseId: id },
      orderBy: { paidAt: "desc" },
    });
    return NextResponse.json(payments);
  } catch (error) {
    console.error("GET /api/credit-purchases/[id]/payments", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/** Ajoute un versement (règlement vers le commerçant / bailleur). */
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const body = await request.json();

    const amount = Number(body.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: "Montant invalide" }, { status: 400 });
    }
    const method = (body.method ?? "ESPECES").toString();
    const paidAtRaw = (body.paidAt ?? "").toString();
    const paidAt = paidAtRaw ? new Date(`${paidAtRaw}T12:00:00`) : new Date();
    const note = (body.note ?? "").toString().trim();

    const purchase = await db.creditPurchase.findUnique({ where: { id } });
    if (!purchase) {
      return NextResponse.json({ error: "Achat à crédit introuvable" }, { status: 404 });
    }

    const payment = await db.creditPayment.create({
      data: { purchaseId: id, amount, method, paidAt, note: note || null },
    });

    const updated = await db.creditPurchase.update({
      where: { id },
      data: { amountPaid: { increment: amount } },
      include: { payments: { orderBy: { paidAt: "desc" } } },
    });

    await logAudit(request, "CREATE", "CreditPayment", payment.id, `${purchase.number} : ${amount}`);

    return NextResponse.json({ payment, purchase: updated }, { status: 201 });
  } catch (error) {
    console.error("POST /api/credit-purchases/[id]/payments", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
