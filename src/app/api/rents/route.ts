import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

function isValidMonth(raw: unknown): raw is string {
  return typeof raw === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(raw);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const tenantId = (body.tenantId ?? "").toString();
    if (!tenantId) {
      return NextResponse.json({ error: "Locataire manquant" }, { status: 400 });
    }
    if (!isValidMonth(body.month)) {
      return NextResponse.json({ error: "Mois invalide (format attendu AAAA-MM)" }, { status: 400 });
    }
    const tenant = await db.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) {
      return NextResponse.json({ error: "Locataire introuvable" }, { status: 404 });
    }
    const existing = await db.rent.findUnique({
      where: { tenantId_month: { tenantId, month: body.month } },
    });
    if (existing) {
      return NextResponse.json(
        { error: "Un loyer existe déjà pour ce locataire et ce mois" },
        { status: 400 }
      );
    }
    const status = body.status === "PAYE" ? "PAYE" : "NON_PAYE";
    const rent = await db.rent.create({
      data: {
        tenantId,
        month: body.month,
        amount: Number(body.amount) || 0,
        status,
        paidAt: status === "PAYE" ? new Date() : null,
        notes: body.notes?.toString().trim() || null,
      },
    });
    return NextResponse.json(rent, { status: 201 });
  } catch (error) {
    console.error("POST /api/rents", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
