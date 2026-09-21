import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { PAYMENT_METHOD_LABELS } from "@/lib/constants";

type Params = { params: Promise<{ id: string }> };

/** PAYE si amountPaid >= totalTTC, PARTIEL si > 0, sinon NON_PAYE. */
function computePaymentStatus(totalTTC: number, amountPaid: number): string {
  if (amountPaid >= totalTTC) return "PAYE";
  if (amountPaid > 0) return "PARTIEL";
  return "NON_PAYE";
}

// ─── GET : liste des versements de la facture ───────────────────────────────

export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const invoice = await db.invoice.findUnique({ where: { id }, select: { id: true } });
    if (!invoice) {
      return NextResponse.json({ error: "Facture introuvable" }, { status: 404 });
    }
    const payments = await db.payment.findMany({
      where: { invoiceId: id },
      orderBy: { paidAt: "desc" },
    });
    return NextResponse.json(payments);
  } catch (error) {
    console.error("GET /api/invoices/[id]/payments", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// ─── POST : enregistrer un versement ────────────────────────────────────────

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const body = await request.json();

    const invoice = await db.invoice.findUnique({ where: { id } });
    if (!invoice) {
      return NextResponse.json({ error: "Facture introuvable" }, { status: 404 });
    }

    const amount = Number(body.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json(
        { error: "Le montant du versement doit être supérieur à 0" },
        { status: 400 }
      );
    }

    const method =
      typeof body.method === "string" && body.method in PAYMENT_METHOD_LABELS
        ? body.method
        : "ESPECES";

    let paidAt = new Date();
    if (body.paidAt) {
      const parsed = new Date(body.paidAt);
      if (!Number.isNaN(parsed.getTime())) paidAt = parsed;
    }
    const note = body.note?.toString().trim() || null;

    // Somme déjà versée (source de vérité : les versements)
    const agg = await db.payment.aggregate({
      where: { invoiceId: id },
      _sum: { amount: true },
    });
    const existingSum = agg._sum.amount ?? 0;
    const reste = Math.max(0, invoice.totalTTC - existingSum);
    if (amount > reste + 0.01) {
      return NextResponse.json(
        {
          error: `Le montant dépasse le reste à payer (${new Intl.NumberFormat("fr-FR", {
            maximumFractionDigits: 0,
          }).format(reste)} FCFA)`,
        },
        { status: 400 }
      );
    }

    const result = await db.$transaction(async (tx) => {
      const payment = await tx.payment.create({
        data: {
          invoiceId: id,
          amount,
          method,
          paidAt,
          note,
        },
      });

      const sum = existingSum + amount;
      const amountPaid = Math.min(sum, invoice.totalTTC);
      const paymentStatus = computePaymentStatus(invoice.totalTTC, amountPaid);
      const updatedInvoice = await tx.invoice.update({
        where: { id },
        data: { amountPaid, paymentStatus },
      });

      return { payment, invoice: updatedInvoice };
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error("POST /api/invoices/[id]/payments", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
