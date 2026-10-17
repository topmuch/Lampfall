import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isValidCategory, sanitizeImage } from "@/lib/product-validation";
import { logAudit } from "@/lib/audit";
import { getAuthUser } from "@/lib/auth";

type Params = { params: Promise<{ id: string }> };

export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const body = await request.json();
    const name = (body.name ?? "").toString().trim();
    if (!name) {
      return NextResponse.json({ error: "Le nom du produit est obligatoire" }, { status: 400 });
    }
    if (!(await isValidCategory(body.category))) {
      return NextResponse.json({ error: "Catégorie invalide" }, { status: 400 });
    }

    const existing = await db.product.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Produit introuvable" }, { status: 404 });
    }

    const newStock = Math.round(Number(body.stock) || 0);
    const stockChanged = existing.stock !== newStock;

    const user = await getAuthUser(request);
    const userName = user?.name ?? null;

    const product = await db.$transaction(async (tx) => {
      const updated = await tx.product.update({
        where: { id },
        data: {
          name,
          reference: body.reference?.toString().trim() || null,
          category: body.category,
          image: sanitizeImage(body.image),
          purchasePrice: Number(body.purchasePrice) || 0,
          salePrice: Number(body.salePrice) || 0,
          stock: newStock,
          unit: body.unit?.toString().trim() || "pièce",
          minStock: Math.round(Number(body.minStock) || 0),
        },
      });

      // Stock modifié → mouvement d'ajustement manuel
      if (stockChanged) {
        await tx.stockMovement.create({
          data: {
            productId: id,
            type: "AJUSTEMENT",
            quantity: Math.abs(newStock - existing.stock),
            stockBefore: existing.stock,
            stockAfter: newStock,
            reason: "Modification fiche produit",
            refType: "MANUEL",
            userName,
          },
        });
      }

      return updated;
    });

    await logAudit(request, "UPDATE", "Product", id, product.name);
    return NextResponse.json(product);
  } catch (error) {
    console.error("PUT /api/products/[id]", error);
    return NextResponse.json({ error: "Produit introuvable ou erreur serveur" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const existing = await db.product.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Produit introuvable" }, { status: 404 });
    }

    await db.product.delete({ where: { id } });
    await logAudit(request, "DELETE", "Product", id, existing.name);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/products/[id]", error);
    return NextResponse.json({ error: "Produit introuvable ou erreur serveur" }, { status: 500 });
  }
}
