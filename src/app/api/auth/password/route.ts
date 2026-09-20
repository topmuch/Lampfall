import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser, hashPassword, verifyPassword } from "@/lib/auth";

/** Changement du mot de passe du compte connecté. */
export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthUser(request);
    if (!auth) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }
    const body = await request.json();
    const current = (body.current ?? "").toString();
    const next = (body.next ?? "").toString();

    if (next.length < 6) {
      return NextResponse.json(
        { error: "Le nouveau mot de passe doit contenir au moins 6 caractères" },
        { status: 400 }
      );
    }

    const user = await db.user.findUnique({ where: { id: auth.id } });
    if (!user || !verifyPassword(current, user.password)) {
      return NextResponse.json({ error: "Mot de passe actuel incorrect" }, { status: 400 });
    }

    await db.user.update({
      where: { id: auth.id },
      data: { password: hashPassword(next) },
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("POST /api/auth/password", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
