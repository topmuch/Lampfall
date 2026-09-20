import { NextRequest, NextResponse } from "next/server";
import { unlink } from "fs/promises";
import path from "path";
import { db } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

const UPLOAD_DIR = path.join(process.cwd(), "db", "uploads");

export async function DELETE(_request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const existing = await db.purchase.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Achat introuvable" }, { status: 404 });
    }
    if (existing.fileStored) {
      try {
        await unlink(path.join(UPLOAD_DIR, existing.fileStored));
      } catch {
        /* fichier déjà absent */
      }
    }
    await db.purchase.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/purchases/[id]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
