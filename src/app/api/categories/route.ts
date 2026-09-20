import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/** Génère un code unique (MAJUSCULES_SANS_ACCENTS) à partir d'un libellé */
function toCode(label: string): string {
  return label
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // retire les accents
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
}

export async function GET() {
  try {
    const categories = await db.category.findMany({ orderBy: { label: "asc" } });
    const products = await db.product.groupBy({ by: ["category"], _count: { _all: true } });
    const counts = new Map(products.map((p) => [p.category, p._count._all]));
    return NextResponse.json(
      categories.map((c) => ({ ...c, productCount: counts.get(c.code) ?? 0 }))
    );
  } catch (error) {
    console.error("GET /api/categories", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const label = (body.label ?? "").toString().trim();
    if (!label) {
      return NextResponse.json({ error: "Le libellé de la catégorie est obligatoire" }, { status: 400 });
    }
    const code = toCode(label);
    if (!code) {
      return NextResponse.json({ error: "Libellé de catégorie invalide" }, { status: 400 });
    }
    const existing = await db.category.findFirst({
      where: { OR: [{ code }, { label: { equals: label } }] },
    });
    if (existing) {
      return NextResponse.json({ error: "Cette catégorie existe déjà" }, { status: 400 });
    }
    const category = await db.category.create({ data: { code, label } });
    return NextResponse.json({ ...category, productCount: 0 }, { status: 201 });
  } catch (error) {
    console.error("POST /api/categories", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
