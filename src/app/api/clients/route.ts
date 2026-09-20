import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
    const clients = await db.client.findMany({
      where: q
        ? {
            OR: [
              { name: { contains: q } },
              { phone: { contains: q } },
              { email: { contains: q } },
            ],
          }
        : undefined,
      include: { _count: { select: { invoices: true, orders: true } } },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(clients);
  } catch (error) {
    console.error("GET /api/clients", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const name = (body.name ?? "").toString().trim();
    if (!name) {
      return NextResponse.json({ error: "Le nom du client est obligatoire" }, { status: 400 });
    }
    const client = await db.client.create({
      data: {
        name,
        phone: body.phone?.toString().trim() || null,
        email: body.email?.toString().trim() || null,
        address: body.address?.toString().trim() || null,
        type: body.type === "ENTREPRISE" ? "ENTREPRISE" : "PARTICULIER",
        notes: body.notes?.toString().trim() || null,
      },
    });
    return NextResponse.json(client, { status: 201 });
  } catch (error) {
    console.error("POST /api/clients", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
