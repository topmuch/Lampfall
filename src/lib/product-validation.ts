import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { PRODUCT_CATEGORIES } from "@/lib/constants";

/**
 * Valide le code catégorie : accepte toute catégorie connue en base,
 * ou à défaut une catégorie de la liste statique (base vide / seed).
 */
export async function isValidCategory(code: unknown): Promise<boolean> {
  const c = (code ?? "").toString();
  if (!c) return false;
  const inDb = await db.category.findUnique({ where: { code: c }, select: { id: true } });
  if (inDb) return true;
  return (PRODUCT_CATEGORIES as readonly string[]).includes(c);
}

/** Valide l'image du produit (data-URL) */
export function sanitizeImage(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  if (!raw.startsWith("data:image/")) return null;
  // ~2 Mo max en base
  if (raw.length > 2_800_000) return null;
  return raw;
}
