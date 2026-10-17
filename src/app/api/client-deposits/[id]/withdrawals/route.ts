import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";

type Params = { params: Promise<{ id: string }> };

/** Ajouter un retrait à un dépôt client. */
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const body = await request.json();

    const amount = Number(body.amount);
    const dateRaw = (body.date ?? "").toString().trim();
    const note = (body.note ?? "").toString().trim();

    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: "Le montant doit être positif" }, { status: 400 });
    }

    const deposit = await db.clientDeposit.findUnique({
      where: { id },
      include: { withdrawals: true },
    });
    if (!deposit) {
      return NextResponse.json({ error: "Dépôt introuvable" }, { status: 404 });
    }

    // Vérifier que le montant ne dépasse pas le solde restant
    const totalWithdrawn = deposit.withdrawals.reduce((sum, w) => sum + w.amount, 0);
    const remaining = deposit.amount - totalWithdrawn;
    if (amount > remaining + 0.009) {
      return NextResponse.json(
        {
          error: `Le montant dépasse le solde restant (${new Intl.NumberFormat("fr-FR", {
            maximumFractionDigits: 0,
          }).format(remaining)} FCFA)`,
        },
        { status: 400 }
      );
    }

    const date = dateRaw ? new Date(`${dateRaw}T12:00:00`) : new Date();

    const withdrawal = await db.clientWithdrawal.create({
      data: { depositId: id, amount, date, note: note || null },
    });

    const updated = await db.clientDeposit.findUnique({
      where: { id },
      include: { withdrawals: { orderBy: { date: "desc" } } },
    });

    await logAudit(request, "CREATE", "ClientWithdrawal", withdrawal.id, `${deposit.firstName} ${deposit.lastName} : -${amount}`);

    return NextResponse.json({ withdrawal, deposit: updated }, { status: 201 });
  } catch (error) {
    console.error("POST /api/client-deposits/[id]/withdrawals", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
