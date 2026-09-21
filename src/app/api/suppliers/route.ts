import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";

// ─── GET : liste des fournisseurs avec stats d'achats ───────────────────────

export async function GET(request: NextRequest) {
  try {
    const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";

    const suppliers = await db.supplier.findMany({
      where: q ? { name: { contains: q } } : undefined,
      include: { _count: { select: { purchases: true } } },
      orderBy: { name: "asc" },
    });

    // Totaux d'achats par fournisseur (groupBy : _sum n'est pas disponible
    // sur une relation dans findMany)
    const sums = await db.purchase.groupBy({
      by: ["supplierId"],
      _sum: { total: true },
    });
    const totals = new Map<string, number>();
    for (const s of sums) {
      if (s.supplierId) totals.set(s.supplierId, s._sum.total ?? 0);
    }

    return NextResponse.json(
      suppliers.map((s) => ({
        ...s,
        purchaseCount: s._count.purchases,
        purchaseTotal: totals.get(s.id) ?? 0,
      }))
    );
  } catch (error) {
    console.error("GET /api/suppliers", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// ─── POST : créer un fournisseur ────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const name = (body.name ?? "").toString().trim();
    if (!name) {
      return NextResponse.json({ error: "Le nom du fournisseur est obligatoire" }, { status: 400 });
    }
    const existing = await db.supplier.findFirst({ where: { name } });
    if (existing) {
      return NextResponse.json({ error: "Un fournisseur avec ce nom existe déjà" }, { status: 400 });
    }

    const supplier = await db.supplier.create({
      data: {
        name,
        phone: body.phone?.toString().trim() || null,
        email: body.email?.toString().trim() || null,
        address: body.address?.toString().trim() || null,
        notes: body.notes?.toString().trim() || null,
      },
    });

    await logAudit(request, "CREATE", "Supplier", supplier.id, supplier.name);
    return NextResponse.json(supplier, { status: 201 });
  } catch (error) {
    console.error("POST /api/suppliers", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
