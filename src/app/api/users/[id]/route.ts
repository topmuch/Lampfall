import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser, hashPassword } from "@/lib/auth";

type Params = { params: Promise<{ id: string }> };

async function requireAdmin(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user || user.role !== "ADMIN") return null;
  return user;
}

export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const admin = await requireAdmin(request);
    if (!admin) return NextResponse.json({ error: "Accès réservé à l'administrateur" }, { status: 403 });

    const { id } = await params;
    const body = await request.json();

    const target = await db.user.findUnique({ where: { id } });
    if (!target) {
      return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 });
    }

    const data: Record<string, unknown> = {};
    if (body.name !== undefined) data.name = body.name.toString().trim();
    if (body.username !== undefined) {
      const username = body.username.toString().trim().toLowerCase();
      if (!username) return NextResponse.json({ error: "Identifiant invalide" }, { status: 400 });
      const exists = await db.user.findFirst({ where: { username, NOT: { id } } });
      if (exists) return NextResponse.json({ error: "Cet identifiant est déjà utilisé" }, { status: 409 });
      data.username = username;
    }
    if (body.role !== undefined) {
      const role = body.role === "ADMIN" ? "ADMIN" : "EMPLOYE";
      // Empêche de rétrograder le dernier admin actif
      if (target.role === "ADMIN" && role !== "ADMIN" && target.actif) {
        const adminCount = await db.user.count({ where: { role: "ADMIN", actif: true, NOT: { id } } });
        if (adminCount === 0) {
          return NextResponse.json({ error: "Impossible de retirer le dernier administrateur" }, { status: 400 });
        }
      }
      data.role = role;
    }
    if (body.actif !== undefined) {
      const actif = Boolean(body.actif);
      // Empêche de désactiver le dernier admin actif ou soi-même
      if (target.id === admin.id && !actif) {
        return NextResponse.json({ error: "Vous ne pouvez pas désactiver votre propre compte" }, { status: 400 });
      }
      if (target.actif && !actif && target.role === "ADMIN") {
        const adminCount = await db.user.count({ where: { role: "ADMIN", actif: true, NOT: { id } } });
        if (adminCount === 0) {
          return NextResponse.json({ error: "Impossible de désactiver le dernier administrateur" }, { status: 400 });
        }
      }
      data.actif = actif;
    }
    if (body.password) {
      const password = body.password.toString();
      if (password.length < 6) {
        return NextResponse.json(
          { error: "Le mot de passe doit contenir au moins 6 caractères" },
          { status: 400 }
        );
      }
      data.password = hashPassword(password);
    }

    const user = await db.user.update({
      where: { id },
      data,
      select: { id: true, username: true, name: true, role: true, actif: true, createdAt: true, updatedAt: true },
    });
    return NextResponse.json(user);
  } catch (error) {
    console.error("PUT /api/users/[id]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const admin = await requireAdmin(request);
    if (!admin) return NextResponse.json({ error: "Accès réservé à l'administrateur" }, { status: 403 });

    const { id } = await params;
    if (id === admin.id) {
      return NextResponse.json({ error: "Vous ne pouvez pas supprimer votre propre compte" }, { status: 400 });
    }
    const target = await db.user.findUnique({ where: { id } });
    if (!target) return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 });
    if (target.role === "ADMIN" && target.actif) {
      const adminCount = await db.user.count({ where: { role: "ADMIN", actif: true, NOT: { id } } });
      if (adminCount === 0) {
        return NextResponse.json({ error: "Impossible de supprimer le dernier administrateur" }, { status: 400 });
      }
    }
    await db.user.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/users/[id]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
