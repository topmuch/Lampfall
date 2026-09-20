import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

type Params = { params: Promise<{ code: string }> };

export async function DELETE(_request: NextRequest, { params }: Params) {
  try {
    const { code } = await params;
    const category = await db.category.findUnique({ where: { code } });
    if (!category) {
      return NextResponse.json({ error: "Catégorie introuvable" }, { status: 404 });
    }
    const productCount = await db.product.count({ where: { category: code } });
    if (productCount > 0) {
      return NextResponse.json(
        {
          error: `Impossible de supprimer : ${productCount} produit(s) utilisent encore cette catégorie. Déplacez-les d'abord vers une autre catégorie.`,
        },
        { status: 400 }
      );
    }
    await db.category.delete({ where: { code } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/categories/[code]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
