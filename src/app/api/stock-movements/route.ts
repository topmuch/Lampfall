import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";

// ─── GET : journal des mouvements de stock ──────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const productId = params.get("productId")?.trim() ?? "";
    const type = params.get("type")?.trim() ?? "";
    const takeRaw = Number(params.get("take"));
    const take =
      Number.isFinite(takeRaw) && takeRaw > 0 ? Math.min(Math.round(takeRaw), 1000) : 200;

    const where: Record<string, unknown> = {};
    if (productId) where.productId = productId;
    if (type === "ENTREE" || type === "SORTIE" || type === "AJUSTEMENT") where.type = type;

    const movements = await db.stockMovement.findMany({
      where,
      include: { product: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take,
    });

    return NextResponse.json(
      movements.map((m) => ({
        ...m,
        productName: m.product.name,
      }))
    );
  } catch (error) {
    console.error("GET /api/stock-movements", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// ─── POST : ajustement manuel du stock d'un produit ─────────────────────────

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const productId = (body.productId ?? "").toString().trim();
    const reason = body.reason?.toString().trim() || null;
    const newStockRaw = Number(body.newStock);

    if (!productId) {
      return NextResponse.json({ error: "Le produit est obligatoire" }, { status: 400 });
    }
    if (!Number.isFinite(newStockRaw)) {
      return NextResponse.json({ error: "Le nouveau stock est invalide" }, { status: 400 });
    }

    const user = await getAuthUser(request);
    const userName = user?.name ?? null;

    const product = await db.product.findUnique({ where: { id: productId } });
    if (!product) {
      return NextResponse.json({ error: "Produit introuvable" }, { status: 404 });
    }

    const stockBefore = product.stock;
    const stockAfter = Math.max(0, Math.round(newStockRaw));
    if (stockAfter === stockBefore) {
      return NextResponse.json(
        { error: "Le nouveau stock est identique à l'actuel" },
        { status: 400 }
      );
    }

    const result = await db.$transaction(async (tx) => {
      const updated = await tx.product.update({
        where: { id: productId },
        data: { stock: stockAfter },
      });
      const movement = await tx.stockMovement.create({
        data: {
          productId,
          type: "AJUSTEMENT",
          quantity: Math.abs(stockAfter - stockBefore),
          stockBefore,
          stockAfter,
          reason,
          refType: "MANUEL",
          userName,
        },
      });
      return { movement, product: updated };
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error("POST /api/stock-movements", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
