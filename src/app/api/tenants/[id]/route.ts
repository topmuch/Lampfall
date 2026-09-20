import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const body = await request.json();
    const name = (body.name ?? "").toString().trim();
    const building = (body.building ?? "").toString().trim();
    if (!name) {
      return NextResponse.json({ error: "Le nom du locataire est obligatoire" }, { status: 400 });
    }
    if (!building) {
      return NextResponse.json({ error: "L'immeuble est obligatoire" }, { status: 400 });
    }
    const tenant = await db.tenant.update({
      where: { id },
      data: {
        name,
        phone: body.phone?.toString().trim() || null,
        building,
        unit: body.unit?.toString().trim() || null,
        monthlyRent: Number(body.monthlyRent) || 0,
        notes: body.notes?.toString().trim() || null,
      },
      include: { rents: { orderBy: { month: "desc" } } },
    });
    return NextResponse.json(tenant);
  } catch (error) {
    console.error("PUT /api/tenants/[id]", error);
    return NextResponse.json({ error: "Locataire introuvable ou erreur serveur" }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    await db.tenant.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/tenants/[id]", error);
    return NextResponse.json({ error: "Locataire introuvable ou erreur serveur" }, { status: 500 });
  }
}
