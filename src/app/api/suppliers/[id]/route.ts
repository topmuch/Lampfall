import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";

type Params = { params: Promise<{ id: string }> };

// ─── PUT : modifier un fournisseur ──────────────────────────────────────────

export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const body = await request.json();
    const name = (body.name ?? "").toString().trim();
    if (!name) {
      return NextResponse.json({ error: "Le nom du fournisseur est obligatoire" }, { status: 400 });
    }

    const existing = await db.supplier.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Fournisseur introuvable" }, { status: 404 });
    }

    const duplicate = await db.supplier.findFirst({ where: { name, id: { not: id } } });
    if (duplicate) {
      return NextResponse.json({ error: "Un fournisseur avec ce nom existe déjà" }, { status: 400 });
    }

    const supplier = await db.supplier.update({
      where: { id },
      data: {
        name,
        phone: body.phone?.toString().trim() || null,
        email: body.email?.toString().trim() || null,
        address: body.address?.toString().trim() || null,
        notes: body.notes?.toString().trim() || null,
      },
    });

    await logAudit(request, "UPDATE", "Supplier", id, supplier.name);
    return NextResponse.json(supplier);
  } catch (error) {
    console.error("PUT /api/suppliers/[id]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// ─── DELETE : supprimer un fournisseur ──────────────────────────────────────

export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const existing = await db.supplier.findUnique({
      where: { id },
      include: { _count: { select: { purchases: true } } },
    });
    if (!existing) {
      return NextResponse.json({ error: "Fournisseur introuvable" }, { status: 404 });
    }

    if (existing._count.purchases > 0) {
      return NextResponse.json(
        {
          error: `Impossible : ${existing._count.purchases} achat(s) lié(s) à ce fournisseur`,
        },
        { status: 400 }
      );
    }

    await db.supplier.delete({ where: { id } });
    await logAudit(request, "DELETE", "Supplier", id, existing.name);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/suppliers/[id]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
