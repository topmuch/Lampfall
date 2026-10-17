import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { PAYMENT_METHOD_LABELS } from "@/lib/constants";
import { syncPaidAmounts } from "@/lib/credit-sync";

type Params = { params: Promise<{ id: string }> };

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

/**
 * Enregistre un versement sur la facture. Si la facture est transférée en
 * achat à crédit (Commerçant / Immo), l'achat lié est synchronisé afin que la
 * mise à jour soit visible à la fois dans Factures et dans Commerçant.
 */
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

    // Plafond : tous les versements confondus (facture + achat à crédit lié)
    const reste = Math.max(0, invoice.totalTTC - invoice.amountPaid);
    if (amount > reste + 0.009) {
      return NextResponse.json(
        {
          error: `Le montant dépasse le reste à payer (${new Intl.NumberFormat("fr-FR", {
            maximumFractionDigits: 0,
          }).format(reste)} FCFA)`,
        },
        { status: 400 }
      );
    }

    const payment = await db.payment.create({
      data: { invoiceId: id, amount, method, paidAt, note },
    });

    // Recalcule le montant payé (versements facture + crédit + manuel) et
    // synchronise l'achat à crédit lié.
    await syncPaidAmounts(id, amount);

    const freshInvoice = await db.invoice.findUnique({ where: { id } });

    return NextResponse.json({ payment, invoice: freshInvoice }, { status: 201 });
  } catch (error) {
    console.error("POST /api/invoices/[id]/payments", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
