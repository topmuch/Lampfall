import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const body = await request.json();
    const existing = await db.rent.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Loyer introuvable" }, { status: 404 });
    }

    const data: Record<string, unknown> = {};

    // Changement de statut
    if (body.status !== undefined) {
      const status = body.status === "PAYE" ? "PAYE" : "NON_PAYE";
      data.status = status;
      data.paidAt = status === "PAYE" ? new Date() : null;
    }
    if (body.amount !== undefined) {
      data.amount = Number(body.amount) || 0;
    }
    if (body.notes !== undefined) {
      data.notes = body.notes?.toString().trim() || null;
    }

    const rent = await db.rent.update({ where: { id }, data });
    return NextResponse.json(rent);
  } catch (error) {
    console.error("PUT /api/rents/[id]", error);
    return NextResponse.json({ error: "Loyer introuvable ou erreur serveur" }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    await db.rent.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/rents/[id]", error);
    return NextResponse.json({ error: "Loyer introuvable ou erreur serveur" }, { status: 500 });
  }
}
