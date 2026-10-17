import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";

const AUDIT_ACTIONS = ["CREATE", "UPDATE", "DELETE"] as const;

/**
 * GET /api/audit?action=CREATE|UPDATE|DELETE&q=&take=200
 * Journal d'audit (réservé ADMIN) : liste des entrées triées de la plus récente
 * à la plus ancienne. `action` filtre sur le type d'opération, `q` cherche dans
 * le nom de l'utilisateur, l'entité et les détails, `take` limite le nombre de
 * lignes (200 par défaut, 500 maximum).
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user || user.role !== "ADMIN") {
      return NextResponse.json({ error: "Accès réservé à l'administrateur" }, { status: 403 });
    }

    const sp = request.nextUrl.searchParams;

    const actionParam = sp.get("action")?.trim() ?? "";
    const action = (AUDIT_ACTIONS as readonly string[]).includes(actionParam) ? actionParam : undefined;

    const q = sp.get("q")?.trim() ?? "";

    const takeParam = Number(sp.get("take"));
    const take =
      Number.isFinite(takeParam) && takeParam > 0 ? Math.min(Math.floor(takeParam), 500) : 200;

    const entries = await db.auditLog.findMany({
      where: {
        ...(action ? { action } : {}),
        ...(q
          ? {
              OR: [
                { userName: { contains: q } },
                { entity: { contains: q } },
                { details: { contains: q } },
              ],
            }
          : {}),
      },
      orderBy: { createdAt: "desc" },
      take,
    });

    return NextResponse.json(entries);
  } catch (error) {
    console.error("GET /api/audit", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
