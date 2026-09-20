import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser, hashPassword } from "@/lib/auth";

async function requireAdmin(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user || user.role !== "ADMIN") return null;
  return user;
}

export async function GET(request: NextRequest) {
  try {
    const admin = await requireAdmin(request);
    if (!admin) return NextResponse.json({ error: "Accès réservé à l'administrateur" }, { status: 403 });

    const users = await db.user.findMany({
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        username: true,
        name: true,
        role: true,
        actif: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    return NextResponse.json(users);
  } catch (error) {
    console.error("GET /api/users", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin(request);
    if (!admin) return NextResponse.json({ error: "Accès réservé à l'administrateur" }, { status: 403 });

    const body = await request.json();
    const name = (body.name ?? "").toString().trim();
    const username = (body.username ?? "").toString().trim().toLowerCase();
    const password = (body.password ?? "").toString();
    const role = body.role === "ADMIN" ? "ADMIN" : "EMPLOYE";

    if (!name || !username) {
      return NextResponse.json({ error: "Nom et identifiant obligatoires" }, { status: 400 });
    }
    if (password.length < 6) {
      return NextResponse.json(
        { error: "Le mot de passe doit contenir au moins 6 caractères" },
        { status: 400 }
      );
    }

    const exists = await db.user.findUnique({ where: { username } });
    if (exists) {
      return NextResponse.json({ error: "Cet identifiant est déjà utilisé" }, { status: 409 });
    }

    const user = await db.user.create({
      data: { name, username, password: hashPassword(password), role, actif: body.actif !== false },
      select: { id: true, username: true, name: true, role: true, actif: true, createdAt: true, updatedAt: true },
    });
    return NextResponse.json(user, { status: 201 });
  } catch (error) {
    console.error("POST /api/users", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
