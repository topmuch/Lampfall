import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

// Convertir une commande prévisionnelle en facture de vente
export async function POST(_request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const order = await db.order.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!order) {
      return NextResponse.json({ error: "Commande introuvable" }, { status: 404 });
    }

    const year = new Date().getFullYear();
    const count = await db.invoice.count({
      where: { type: "VENTE", number: { startsWith: `FV-${year}-` } },
    });
    const number = `FV-${year}-${String(count + 1).padStart(4, "0")}`;

    const totalHT = order.items.reduce((s, i) => s + i.total, 0);
    const taxRate = 18;
    const totalTTC = Math.round(totalHT * (1 + taxRate / 100));

    const result = await db.$transaction(async (tx) => {
      const created = await tx.invoice.create({
        data: {
          number,
          type: "VENTE",
          clientId: order.clientId,
          clientName: order.clientName,
          date: new Date(),
          deliveryStatus: "NON_LIVRE",
          paymentStatus: "NON_PAYE",
          amountPaid: 0,
          taxRate,
          totalHT,
          totalTTC,
          notes: `Issue de la commande prévisionnelle ${order.number}`,
          items: {
            create: order.items.map((i) => ({
              productId: i.productId,
              productName: i.productName,
              category: i.category,
              unit: i.unit,
              quantity: i.quantity,
              unitPrice: i.unitPrice,
              total: i.total,
            })),
          },
        },
        include: { items: true },
      });

      for (const item of order.items) {
        if (!item.productId) continue;
        const product = await tx.product.findUnique({ where: { id: item.productId } });
        if (!product) continue;
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: Math.max(0, product.stock - Math.round(item.quantity)) },
        });
      }

      await tx.order.update({ where: { id: order.id }, data: { status: "CONFIRMEE" } });

      return created;
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error("POST /api/orders/[id]/convert", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
