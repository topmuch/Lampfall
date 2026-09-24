import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";

const DEFAULTS = {
  id: "main",
  nomSociete: "ETS LAMP FALL",
  tagline: "Plomberie - Sanitaire - Luminaire",
  adresse: "Dakar, Sénégal",
  telephone: "+221 77 000 00 00",
  email: "contact@etslampfall.sn",
  rc: "",
  ninea: "",
};

async function getOrCreateSettings() {
  const s = await db.setting.findUnique({ where: { id: "main" } });
  if (s) return s;
  return db.setting.create({ data: DEFAULTS });
}

export async function GET() {
  try {
    const settings = await getOrCreateSettings();
    return NextResponse.json(settings);
  } catch (error) {
    console.error("GET /api/settings", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const auth = await getAuthUser(request);
    if (!auth || auth.role !== "ADMIN") {
      return NextResponse.json({ error: "Accès réservé à l'administrateur" }, { status: 403 });
    }

    const body = await request.json();
    const clean = (v: unknown, max = 200) => (v ?? "").toString().trim().slice(0, max);

    const logo = body.logo === null ? null : body.logo ? body.logo.toString() : undefined;
    if (logo && !logo.startsWith("data:image/")) {
      return NextResponse.json({ error: "Format de logo invalide (image attendue)" }, { status: 400 });
    }
    if (logo && logo.length > 3_500_000) {
      return NextResponse.json({ error: "Logo trop volumineux (max ~2,5 Mo)" }, { status: 400 });
    }

    // Mise à jour partielle sûre : un champ absent du corps de la requête
    // conserve sa valeur actuelle (évite d'effacer le slogan via un simple
    // basculement du mode maintenance, par exemple).
    const current = await getOrCreateSettings();
    const pick = (key: keyof typeof DEFAULTS, max: number) =>
      body[key] !== undefined ? clean(body[key], max) : (current[key] as string) ?? "";

    const data: Record<string, unknown> = {
      nomSociete: pick("nomSociete", 120) || DEFAULTS.nomSociete,
      tagline: pick("tagline", 160),
      adresse: pick("adresse", 200),
      telephone: pick("telephone", 60),
      email: pick("email", 120),
      rc: pick("rc", 80),
      ninea: pick("ninea", 80),
    };
    if (logo !== undefined) data.logo = logo;

    // Mode maintenance : à l'activation, on horodate le début (base du compteur)
    // si aucun début n'existe déjà ; à la désactivation, on réinitialise.
    if (typeof body.maintenanceActive === "boolean") {
      if (body.maintenanceActive) {
        data.maintenanceActive = true;
        data.maintenanceSince =
          current.maintenanceSince ?? (body.maintenanceSince ? new Date(body.maintenanceSince) : new Date());
      } else {
        data.maintenanceActive = false;
        data.maintenanceSince = null;
      }
    }

    const settings = await db.setting.update({ where: { id: "main" }, data });
    return NextResponse.json(settings);
  } catch (error) {
    console.error("PUT /api/settings", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
