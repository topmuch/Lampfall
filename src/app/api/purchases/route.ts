import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { db } from "@/lib/db";
import { nextNumber, NUMBER_PREFIXES } from "@/lib/constants";

const UPLOAD_DIR = path.join(process.cwd(), "db", "uploads");
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 Mo

export async function GET(request: NextRequest) {
  try {
    const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
    const purchases = await db.purchase.findMany({
      where: q
        ? {
            OR: [{ number: { contains: q } }, { supplier: { contains: q } }],
          }
        : undefined,
      include: { items: true },
      orderBy: { date: "desc" },
    });
    return NextResponse.json(purchases);
  } catch (error) {
    console.error("GET /api/purchases", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const supplier = (formData.get("supplier")?.toString() ?? "").trim();
    if (!supplier) {
      return NextResponse.json({ error: "Le fournisseur est obligatoire" }, { status: 400 });
    }

    let items: { productId?: string | null; productName: string; quantity: number; unitPrice: number }[] = [];
    try {
      const parsed = JSON.parse(formData.get("items")?.toString() ?? "[]");
      items = (Array.isArray(parsed) ? parsed : [])
        .map((it: Record<string, unknown>) => ({
          productId: (it.productId as string) || null,
          productName: ((it.productName as string) ?? "").toString().trim() || "Article",
          quantity: Number(it.quantity) || 0,
          unitPrice: Number(it.unitPrice) || 0,
        }))
        .filter((it: { quantity: number }) => it.quantity > 0);
    } catch {
      items = [];
    }

    const total =
      Number(formData.get("total")) ||
      items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);

    const updateStock = formData.get("updateStock") === "true";

    // Gestion du fichier joint (facture d'achat scannée)
    let fileMeta: { fileName: string | null; fileType: string | null; fileSize: number | null; fileStored: string | null } = {
      fileName: null,
      fileType: null,
      fileSize: null,
      fileStored: null,
    };
    const file = formData.get("file");
    if (file && typeof file === "object" && "arrayBuffer" in file) {
      const blob = file as File;
      if (blob.size > MAX_FILE_SIZE) {
        return NextResponse.json({ error: "Fichier trop volumineux (max 5 Mo)" }, { status: 400 });
      }
      await mkdir(UPLOAD_DIR, { recursive: true });
      const ext = blob.name.includes(".") ? blob.name.split(".").pop() : "bin";
      const stored = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`;
      const buffer = Buffer.from(await blob.arrayBuffer());
      await writeFile(path.join(UPLOAD_DIR, stored), buffer);
      fileMeta = {
        fileName: blob.name,
        fileType: blob.type || null,
        fileSize: blob.size,
        fileStored: stored,
      };
    }

    const year = new Date().getFullYear();
    const count = await db.purchase.count({
      where: { number: { startsWith: `FA-${year}-` } },
    });
    const number =
      formData.get("number")?.toString().trim() || nextNumber(NUMBER_PREFIXES.ACHAT, count, year);

    const purchase = await db.$transaction(async (tx) => {
      const created = await tx.purchase.create({
        data: {
          number,
          supplier,
          date: formData.get("date") ? new Date(formData.get("date")!.toString()) : new Date(),
          total,
          notes: formData.get("notes")?.toString().trim() || null,
          ...fileMeta,
          items: {
            create: items.map((i) => ({
              productId: i.productId,
              productName: i.productName,
              quantity: i.quantity,
              unitPrice: i.unitPrice,
              total: i.quantity * i.unitPrice,
            })),
          },
        },
        include: { items: true },
      });

      if (updateStock) {
        for (const item of items) {
          if (!item.productId) continue;
          const product = await tx.product.findUnique({ where: { id: item.productId } });
          if (!product) continue;
          await tx.product.update({
            where: { id: item.productId },
            data: { stock: product.stock + Math.round(item.quantity) },
          });
        }
      }
      return created;
    });

    return NextResponse.json(purchase, { status: 201 });
  } catch (error) {
    console.error("POST /api/purchases", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
