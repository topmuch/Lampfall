import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";

/** Liste des dépôts clients, avec retraits inclus. */
export async function GET(request: NextRequest) {
  try {
    const year = request.nextUrl.searchParams.get("year")?.trim() ?? "";
    const deposits = await db.clientDeposit.findMany({
      where: year ? { date: { gte: new Date(`${year}-01-01`), lt: new Date(`${Number(year) + 1}-01-01`) } } : undefined,
      include: { withdrawals: { orderBy: { date: "desc" } } },
      orderBy: { date: "desc" },
    });
    return NextResponse.json(deposits);
  } catch (error) {
    console.error("GET /api/client-deposits", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/** Créer un nouveau dépôt client. */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const firstName = (body.firstName ?? "").toString().trim();
    const lastName = (body.lastName ?? "").toString().trim();
    const phone = (body.phone ?? "").toString().trim();
    const amount = Number(body.amount);
    const method = (body.method ?? "ESPECES").toString();
    const dateRaw = (body.date ?? "").toString().trim();
    const notes = (body.notes ?? "").toString().trim();

    if (!firstName) {
      return NextResponse.json({ error: "Le prénom est requis" }, { status: 400 });
    }
    if (!lastName) {
      return NextResponse.json({ error: "Le nom est requis" }, { status: 400 });
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: "Le montant doit être positif" }, { status: 400 });
    }

    const date = dateRaw ? new Date(`${dateRaw}T12:00:00`) : new Date();

    const deposit = await db.clientDeposit.create({
      data: {
        firstName,
        lastName,
        phone: phone || null,
        amount,
        method,
        date,
        notes: notes || null,
      },
      include: { withdrawals: true },
    });

    await logAudit(request, "CREATE", "ClientDeposit", deposit.id, `${firstName} ${lastName} : ${amount}`);

    return NextResponse.json(deposit, { status: 201 });
  } catch (error) {
    console.error("POST /api/client-deposits", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
