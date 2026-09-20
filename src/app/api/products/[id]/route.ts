import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { PRODUCT_CATEGORIES } from "@/lib/constants";

type Params = { params: Promise<{ id: string }> };

export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const body = await request.json();
    const name = (body.name ?? "").toString().trim();
    if (!name) {
      return NextResponse.json({ error: "Le nom du produit est obligatoire" }, { status: 400 });
    }
    if (!PRODUCT_CATEGORIES.includes(body.category)) {
      return NextResponse.json({ error: "Catégorie invalide" }, { status: 400 });
    }
    const product = await db.product.update({
      where: { id },
      data: {
        name,
        reference: body.reference?.toString().trim() || null,
        category: body.category,
        purchasePrice: Number(body.purchasePrice) || 0,
        salePrice: Number(body.salePrice) || 0,
        stock: Math.round(Number(body.stock) || 0),
        unit: body.unit?.toString().trim() || "pièce",
        minStock: Math.round(Number(body.minStock) || 0),
      },
    });
    return NextResponse.json(product);
  } catch (error) {
    console.error("PUT /api/products/[id]", error);
    return NextResponse.json({ error: "Produit introuvable ou erreur serveur" }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    await db.product.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/products/[id]", error);
    return NextResponse.json({ error: "Produit introuvable ou erreur serveur" }, { status: 500 });
  }
}
