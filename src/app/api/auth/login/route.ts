import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyPassword, createToken } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const username = (body.username ?? "").toString().trim().toLowerCase();
    const password = (body.password ?? "").toString();

    if (!username || !password) {
      return NextResponse.json({ error: "Identifiant et mot de passe requis" }, { status: 400 });
    }

    const user = await db.user.findUnique({ where: { username } });
    if (!user || !verifyPassword(password, user.password)) {
      return NextResponse.json({ error: "Identifiant ou mot de passe incorrect" }, { status: 401 });
    }
    if (!user.actif) {
      return NextResponse.json(
        { error: "Ce compte est désactivé. Contactez l'administrateur." },
        { status: 403 }
      );
    }

    const token = createToken(user.id);
    return NextResponse.json({
      token,
      user: { id: user.id, username: user.username, name: user.name, role: user.role },
    });
  } catch (error) {
    console.error("POST /api/auth/login", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
