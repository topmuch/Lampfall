import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";

type Params = { params: Promise<{ id: string }> };

/** Supprimer un dépôt client. */
export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const deposit = await db.clientDeposit.findUnique({ where: { id } });
    if (!deposit) {
      return NextResponse.json({ error: "Dépôt introuvable" }, { status: 404 });
    }

    await db.clientDeposit.delete({ where: { id } });
    await logAudit(request, "DELETE", "ClientDeposit", id, `${deposit.firstName} ${deposit.lastName}`);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/client-deposits/[id]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
