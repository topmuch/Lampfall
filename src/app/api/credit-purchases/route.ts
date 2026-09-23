import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";

const DESTINATIONS = ["COMMERCANT", "IMMO"] as const;

/** Liste des achats à crédit, optionnellement filtrée par destination. */
export async function GET(request: NextRequest) {
  try {
    const destination = request.nextUrl.searchParams.get("destination")?.trim() ?? "";
    const purchases = await db.creditPurchase.findMany({
      where: destination ? { destination } : undefined,
      include: { payments: { orderBy: { paidAt: "desc" } } },
      orderBy: { createdAt: "desc" },
    });

    // Statuts du document source (facture / proforma) : livraison & paiement d'origine
    const sourceIds = [...new Set(purchases.map((p) => p.sourceId))];
    const sources = sourceIds.length
      ? await db.invoice.findMany({
          where: { id: { in: sourceIds } },
          select: { id: true, deliveryStatus: true, paymentStatus: true },
        })
      : [];
    const sourceMap = new Map(sources.map((s) => [s.id, s]));

    return NextResponse.json(
      purchases.map((p) => ({
        ...p,
        sourceDeliveryStatus: sourceMap.get(p.sourceId)?.deliveryStatus ?? null,
        sourcePaymentStatus: sourceMap.get(p.sourceId)?.paymentStatus ?? null,
      }))
    );
  } catch (error) {
    console.error("GET /api/credit-purchases", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * Transfère une facture / proforma existante en achat à crédit
 * (destination : Commerçant ou Immobilier).
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const sourceId = (body.sourceId ?? "").toString().trim();
    const destination = (body.destination ?? "").toString().trim().toUpperCase();
    const tier = (body.tier ?? "").toString().trim();
    const note = (body.note ?? "").toString().trim();
    const dueDateRaw = (body.dueDate ?? "").toString().trim();

    if (!sourceId) {
      return NextResponse.json({ error: "Document source manquant" }, { status: 400 });
    }
    if (!DESTINATIONS.includes(destination as (typeof DESTINATIONS)[number])) {
      return NextResponse.json(
        { error: "Destination invalide (Commerçant ou Immobilier)" },
        { status: 400 }
      );
    }

    const invoice = await db.invoice.findUnique({ where: { id: sourceId } });
    if (!invoice) {
      return NextResponse.json({ error: "Facture / proforma introuvable" }, { status: 404 });
    }

    const existing = await db.creditPurchase.findUnique({ where: { sourceId } });
    if (existing) {
      return NextResponse.json(
        {
          error: `Le document ${invoice.number} est déjà transféré en achat à crédit.`,
        },
        { status: 409 }
      );
    }

    const dueDate = dueDateRaw ? new Date(`${dueDateRaw}T12:00:00`) : null;

    const purchase = await db.creditPurchase.create({
      data: {
        destination,
        sourceType: invoice.type,
        sourceId: invoice.id,
        number: invoice.number,
        tier: tier || invoice.clientName || "—",
        total: invoice.totalTTC,
        // Reprend les versements déjà enregistrés sur la facture afin que les
        // onglets Factures et Commerçant affichent les mêmes montants.
        amountPaid: Math.min(invoice.amountPaid, invoice.totalTTC),
        dueDate,
        note: note || null,
      },
      include: { payments: true },
    });

    await logAudit(request, "CREATE", "CreditPurchase", purchase.id, `${invoice.number} → ${destination}`);

    return NextResponse.json(purchase, { status: 201 });
  } catch (error) {
    console.error("POST /api/credit-purchases", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
