import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const body = await request.json();
    const existing = await db.order.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Commande introuvable" }, { status: 404 });
    }

    const status = ["EN_COURS", "CONFIRMEE", "LIVREE", "ANNULEE"].includes(body.status)
      ? body.status
      : existing.status;

    const order = await db.order.update({
      where: { id },
      data: {
        clientId: body.clientId !== undefined ? body.clientId || null : existing.clientId,
        clientName: body.clientName?.toString().trim() ?? existing.clientName,
        date: body.date ? new Date(body.date) : existing.date,
        deliveryDate:
          body.deliveryDate !== undefined
            ? body.deliveryDate
              ? new Date(body.deliveryDate)
              : null
            : existing.deliveryDate,
        status,
        notes: body.notes?.toString().trim() || null,
      },
      include: { items: true },
    });
    return NextResponse.json(order);
  } catch (error) {
    console.error("PUT /api/orders/[id]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    await db.order.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/orders/[id]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
