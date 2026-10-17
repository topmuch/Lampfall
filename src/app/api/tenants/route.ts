import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
    const where: Record<string, unknown> = {};
    if (q) {
      where.OR = [
        { name: { contains: q } },
        { building: { contains: q } },
        { phone: { contains: q } },
      ];
    }
    const tenants = await db.tenant.findMany({
      where,
      include: { rents: { orderBy: { month: "desc" } } },
      orderBy: { name: "asc" },
    });
    return NextResponse.json(tenants);
  } catch (error) {
    console.error("GET /api/tenants", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const name = (body.name ?? "").toString().trim();
    const building = (body.building ?? "").toString().trim();
    if (!name) {
      return NextResponse.json({ error: "Le nom du locataire est obligatoire" }, { status: 400 });
    }
    if (!building) {
      return NextResponse.json({ error: "L'immeuble est obligatoire" }, { status: 400 });
    }
    const tenant = await db.tenant.create({
      data: {
        name,
        phone: body.phone?.toString().trim() || null,
        building,
        unit: body.unit?.toString().trim() || null,
        monthlyRent: Number(body.monthlyRent) || 0,
        notes: body.notes?.toString().trim() || null,
      },
      include: { rents: true },
    });
    return NextResponse.json(tenant, { status: 201 });
  } catch (error) {
    console.error("POST /api/tenants", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
