import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { syncCreditFromInvoice } from "@/lib/credit-sync";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const invoice = await db.invoice.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!invoice) {
      return NextResponse.json({ error: "Facture introuvable" }, { status: 404 });
    }
    return NextResponse.json(invoice);
  } catch (error) {
    console.error("GET /api/invoices/[id]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const body = await request.json();
    const existing = await db.invoice.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Facture introuvable" }, { status: 404 });
    }

    const rawItems = Array.isArray(body.items) ? body.items : existing.items;
    const items = rawItems
      .map((it: Record<string, unknown>) => {
        const quantity = Number(it.quantity) || 0;
        const unitPrice = Number(it.unitPrice) || 0;
        return {
          productId: (it.productId as string) || null,
          productName: ((it.productName as string) ?? "").toString().trim() || "Article",
          category: (it.category as string) || null,
          unit: ((it.unit as string) ?? "pièce").toString().trim(),
          quantity,
          unitPrice,
        };
      })
      .filter((it: { quantity: number }) => it.quantity > 0);

    if (items.length === 0) {
      return NextResponse.json({ error: "Ajoutez au moins un article" }, { status: 400 });
    }

    const totalHT = items.reduce((s: number, i: { quantity: number; unitPrice: number }) => s + i.quantity * i.unitPrice, 0);
    const taxRate = Number(body.taxRate ?? existing.taxRate) || 0;
    const totalTTC = Math.round(totalHT * (1 + taxRate / 100));

    let paymentStatus = body.paymentStatus ?? existing.paymentStatus;
    if (!["PAYE", "PARTIEL", "NON_PAYE"].includes(paymentStatus)) paymentStatus = "NON_PAYE";
    let amountPaid =
      body.amountPaid !== undefined ? Number(body.amountPaid) || 0 : existing.amountPaid;
    if (paymentStatus === "PAYE") amountPaid = totalTTC;
    if (paymentStatus === "NON_PAYE") amountPaid = 0;
    if (amountPaid > totalTTC) amountPaid = totalTTC;

    const deliveryStatus =
      body.deliveryStatus === "LIVRE"
        ? "LIVRE"
        : body.deliveryStatus === "NON_LIVRE"
          ? "NON_LIVRE"
          : existing.deliveryStatus;

    const updateStock = existing.type === "VENTE" && body.updateStock !== false;

    // Valider le clientId : s'il n'existe plus en base (client supprimé, données
    // réinitialisées…), on ne bloque PAS la modification — on retombe sur null
    // en conservant le nom saisi.
    let nextClientId: string | null =
      body.clientId !== undefined ? body.clientId || null : existing.clientId;
    if (nextClientId) {
      const clientExists = await db.client.findUnique({
        where: { id: nextClientId },
        select: { id: true },
      });
      if (!clientExists) nextClientId = null;
    }

    const invoice = await db.$transaction(async (tx) => {
      if (updateStock) {
        // Restaurer le stock des anciens articles liés à un produit
        for (const old of existing.items) {
          if (!old.productId) continue;
          const product = await tx.product.findUnique({ where: { id: old.productId } });
          if (!product) continue;
          await tx.product.update({
            where: { id: old.productId },
            data: { stock: product.stock + Math.round(old.quantity) },
          });
        }
        // Décrémenter avec les nouveaux articles
        for (const item of items) {
          if (!item.productId) continue;
          const product = await tx.product.findUnique({ where: { id: item.productId } });
          if (!product) continue;
          await tx.product.update({
            where: { id: item.productId },
            data: { stock: Math.max(0, product.stock - Math.round(item.quantity)) },
          });
        }
      }

      await tx.invoiceItem.deleteMany({ where: { invoiceId: id } });
      return tx.invoice.update({
        where: { id },
        data: {
          clientId: nextClientId,
          clientName: body.clientName?.toString().trim() ?? existing.clientName,
          clientPhone: body.clientPhone?.toString().trim() || null,
          clientAddress: body.clientAddress?.toString().trim() || null,
          date: body.date ? new Date(body.date) : existing.date,
          dueDate: body.dueDate ? new Date(body.dueDate) : null,
          deliveryStatus,
          paymentStatus,
          amountPaid,
          taxRate,
          totalHT,
          totalTTC,
          notes: body.notes?.toString().trim() || null,
          items: {
            create: items.map((i: (typeof items)[number]) => ({
              productId: i.productId,
              productName: i.productName,
              category: i.category,
              unit: i.unit,
              quantity: i.quantity,
              unitPrice: i.unitPrice,
              total: i.quantity * i.unitPrice,
            })),
          },
        },
        include: { items: true },
      });
    });

    await logAudit(request, "UPDATE", "Invoice", id, invoice.number);

    // Répercute l'édition (total TTC, montant payé, statut) sur l'achat à crédit
    // lié afin que la mise à jour soit visible dans Factures ET dans Commerçant.
    await syncCreditFromInvoice(invoice.id);

    return NextResponse.json(invoice);
  } catch (error) {
    console.error("PUT /api/invoices/[id]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const existing = await db.invoice.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Facture introuvable" }, { status: 404 });
    }

    await db.$transaction(async (tx) => {
      if (existing.type === "VENTE") {
        for (const item of existing.items) {
          if (!item.productId) continue;
          const product = await tx.product.findUnique({ where: { id: item.productId } });
          if (!product) continue;
          await tx.product.update({
            where: { id: item.productId },
            data: { stock: product.stock + Math.round(item.quantity) },
          });
        }
      }
      // Supprime l'achat à crédit lié (transfert Commerçant / Immo) s'il existe
      await tx.creditPurchase.deleteMany({ where: { sourceId: id } });
      return tx.invoice.delete({ where: { id } });
    });

    await logAudit(request, "DELETE", "Invoice", id, existing.number);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/invoices/[id]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
