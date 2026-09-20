import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }
    return NextResponse.json({ user });
  } catch (error) {
    console.error("GET /api/auth/me", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
