import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isValidCategory, sanitizeImage } from "@/lib/product-validation";

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const q = params.get("q")?.trim() ?? "";
    const category = params.get("category")?.trim() ?? "";

    const where: Record<string, unknown> = {};
    if (q) {
      where.OR = [{ name: { contains: q } }, { reference: { contains: q } }];
    }
    if (category && category !== "all") {
      where.category = category;
    }

    const products = await db.product.findMany({ where, orderBy: { name: "asc" } });
    return NextResponse.json(products);
  } catch (error) {
    console.error("GET /api/products", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const name = (body.name ?? "").toString().trim();
    if (!name) {
      return NextResponse.json({ error: "Le nom du produit est obligatoire" }, { status: 400 });
    }
    if (!(await isValidCategory(body.category))) {
      return NextResponse.json({ error: "Catégorie invalide" }, { status: 400 });
    }
    const product = await db.product.create({
      data: {
        name,
        reference: body.reference?.toString().trim() || null,
        category: body.category,
        image: sanitizeImage(body.image),
        purchasePrice: Number(body.purchasePrice) || 0,
        salePrice: Number(body.salePrice) || 0,
        stock: Math.round(Number(body.stock) || 0),
        unit: body.unit?.toString().trim() || "pièce",
        minStock: Math.round(Number(body.minStock) || 0),
      },
    });
    return NextResponse.json(product, { status: 201 });
  } catch (error) {
    console.error("POST /api/products", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
