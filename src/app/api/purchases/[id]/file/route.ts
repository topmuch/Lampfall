import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";
import { db } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

const UPLOAD_DIR = path.join(process.cwd(), "db", "uploads");

// Téléchargement / consultation de la pièce jointe d'une facture d'achat
export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const purchase = await db.purchase.findUnique({ where: { id } });
    if (!purchase?.fileStored) {
      return NextResponse.json({ error: "Aucune pièce jointe" }, { status: 404 });
    }
    const buffer = await readFile(path.join(UPLOAD_DIR, purchase.fileStored));
    const bytes = new Uint8Array(buffer);
    return new NextResponse(bytes, {
      headers: {
        "Content-Type": purchase.fileType || "application/octet-stream",
        "Content-Disposition": `inline; filename="${encodeURIComponent(purchase.fileName || "fichier")}"`,
      },
    });
  } catch (error) {
    console.error("GET /api/purchases/[id]/file", error);
    return NextResponse.json({ error: "Fichier introuvable" }, { status: 404 });
  }
}
