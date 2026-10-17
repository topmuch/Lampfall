import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { syncPaidAmounts } from "@/lib/credit-sync";

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

/**
 * Ajoute un versement (règlement vers le commerçant / bailleur).
 * La facture d'origine est synchronisée (montant payé + statut) afin que la
 * mise à jour soit visible à la fois dans l'onglet Commerçant et dans Factures.
 */
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

    // Plafond : ne pas dépasser le reste à payer (facture d'origine si elle existe)
    const invoice = await db.invoice.findUnique({ where: { id: purchase.sourceId } });
    const referenceTotal = invoice ? invoice.totalTTC : purchase.total;
    const referencePaid = invoice ? invoice.amountPaid : purchase.amountPaid;
    const reste = Math.max(0, referenceTotal - referencePaid);
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

    const payment = await db.creditPayment.create({
      data: { purchaseId: id, amount, method, paidAt, note: note || null },
    });

    if (invoice) {
      // Synchronise la facture ET l'achat à crédit (montants + statuts)
      await syncPaidAmounts(purchase.sourceId, amount);
    } else {
      // Document source introuvable (donnée orpheline) : mise à jour locale
      await db.creditPurchase.update({
        where: { id },
        data: { amountPaid: { increment: amount } },
      });
    }

    const updated = await db.creditPurchase.findUnique({
      where: { id },
      include: { payments: { orderBy: { paidAt: "desc" } } },
    });

    await logAudit(request, "CREATE", "CreditPayment", payment.id, `${purchase.number} : ${amount}`);

    return NextResponse.json({ payment, purchase: updated }, { status: 201 });
  } catch (error) {
    console.error("POST /api/credit-purchases/[id]/payments", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
