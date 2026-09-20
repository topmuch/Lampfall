import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const body = await request.json();
    const name = (body.name ?? "").toString().trim();
    if (!name) {
      return NextResponse.json({ error: "Le nom du client est obligatoire" }, { status: 400 });
    }
    const client = await db.client.update({
      where: { id },
      data: {
        name,
        phone: body.phone?.toString().trim() || null,
        email: body.email?.toString().trim() || null,
        address: body.address?.toString().trim() || null,
        type: body.type === "ENTREPRISE" ? "ENTREPRISE" : "PARTICULIER",
        notes: body.notes?.toString().trim() || null,
      },
    });
    return NextResponse.json(client);
  } catch (error) {
    console.error("PUT /api/clients/[id]", error);
    return NextResponse.json({ error: "Client introuvable ou erreur serveur" }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    await db.client.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/clients/[id]", error);
    return NextResponse.json({ error: "Client introuvable ou erreur serveur" }, { status: 500 });
  }
}
