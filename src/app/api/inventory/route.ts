import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { CATEGORY_LABELS } from "@/lib/constants";
import type {
  InventoryCategoryRow,
  InventoryProductRow,
} from "@/lib/types";

// ─── Types de période ───────────────────────────────────────────────────────

const PERIOD_TYPES = ["semaine", "mensuel", "trimestriel", "semestriel", "annuel"] as const;
type PeriodType = (typeof PERIOD_TYPES)[number];

function isPeriodType(value: string): value is PeriodType {
  return (PERIOD_TYPES as readonly string[]).includes(value);
}

// ─── Utilitaires de dates ───────────────────────────────────────────────────

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Lundi de la semaine contenant d (semaine ISO, début lundi) */
function startOfWeek(d: Date): Date {
  const date = startOfDay(d);
  const day = (date.getDay() + 6) % 7; // dimanche = 6 → lundi = 0
  date.setDate(date.getDate() - day);
  return date;
}

/**
 * Calcule la plage [start, end) de la période demandée.
 * `end` est exclusive (début de la période suivante).
 */
function computeRange(
  period: PeriodType,
  anchor: Date,
  offset: number
): { start: Date; end: Date } {
  const base = startOfDay(anchor);
  const y = base.getFullYear();
  const m = base.getMonth();

  switch (period) {
    case "semaine": {
      const start = startOfWeek(base);
      start.setDate(start.getDate() + offset * 7);
      const end = new Date(start);
      end.setDate(end.getDate() + 7);
      return { start, end };
    }
    case "mensuel":
      return {
        start: new Date(y, m + offset, 1),
        end: new Date(y, m + 1 + offset, 1),
      };
    case "trimestriel": {
      const q = Math.floor(m / 3); // 0..3
      return {
        start: new Date(y, q * 3 + offset * 3, 1),
        end: new Date(y, q * 3 + 3 + offset * 3, 1),
      };
    }
    case "semestriel": {
      const s = Math.floor(m / 6); // 0 ou 1
      return {
        start: new Date(y, s * 6 + offset * 6, 1),
        end: new Date(y, s * 6 + 6 + offset * 6, 1),
      };
    }
    case "annuel":
      return {
        start: new Date(y + offset, 0, 1),
        end: new Date(y + offset + 1, 0, 1),
      };
  }
}

const dayFmt = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

function formatDay(d: Date): string {
  return dayFmt.format(d);
}

function periodLabel(period: PeriodType, start: Date, end: Date): string {
  const y = start.getFullYear();
  switch (period) {
    case "semaine": {
      const last = new Date(end);
      last.setDate(last.getDate() - 1);
      return `Semaine du ${formatDay(start)} au ${formatDay(last)}`;
    }
    case "mensuel":
      return new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" })
        .format(start)
        .replace(/^./, (c) => c.toUpperCase()); // "Novembre 2026"
    case "trimestriel": {
      const q = Math.floor(start.getMonth() / 3) + 1;
      return `${q}${q === 1 ? "er" : "e"} trimestre ${y}`;
    }
    case "semestriel": {
      const s = Math.floor(start.getMonth() / 6) + 1;
      return `${s}${s === 1 ? "er" : "e"} semestre ${y}`;
    }
    case "annuel":
      return `Année ${y}`;
  }
}

// ─── Arrondi ────────────────────────────────────────────────────────────────

const r2 = (n: number): number => Math.round(n * 100) / 100;

// ─── GET /api/inventory ─────────────────────────────────────────────────────
// Params : period (semaine|mensuel|trimestriel|semestriel|annuel),
//          offset (décalage de période, 0 = période courante),
//          date (ancre ISO yyyy-MM-dd, défaut aujourd'hui)

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;

    const periodRaw = params.get("period") ?? "mensuel";
    const period: PeriodType = isPeriodType(periodRaw) ? periodRaw : "mensuel";

    const offsetRaw = Number.parseInt(params.get("offset") ?? "0", 10);
    const offset = Number.isFinite(offsetRaw) ? offsetRaw : 0;

    const dateParam = params.get("date");
    let anchor = new Date();
    if (dateParam) {
      const parsed = new Date(`${dateParam}T12:00:00`);
      if (!Number.isNaN(parsed.getTime())) anchor = parsed;
    }

    const { start, end } = computeRange(period, anchor, offset);

    const [products, categoryRowsDb, movements] = await Promise.all([
      db.product.findMany({ orderBy: [{ name: "asc" }] }),
      db.category.findMany({ orderBy: { label: "asc" } }),
      db.stockMovement.findMany({
        where: { createdAt: { lt: end } },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      }),
    ]);

    const categoryLabelMap = new Map<string, string>();
    for (const c of categoryRowsDb) categoryLabelMap.set(c.code, c.label);
    const pretty = (code: string): string => {
      const lower = code.toLowerCase().replace(/_/g, " ");
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    };
    const labelOf = (code: string): string =>
      categoryLabelMap.get(code) ?? CATEGORY_LABELS[code] ?? pretty(code);

    // ─── Rejoue le journal des mouvements par produit ──────────────────────
    interface Bucket {
      stockInitial: number;
      achats: number;
      ventes: number;
      retoursAjustements: number;
    }
    const movementsByProduct = new Map<string, typeof movements>();
    for (const mv of movements) {
      let list = movementsByProduct.get(mv.productId);
      if (!list) {
        list = [];
        movementsByProduct.set(mv.productId, list);
      }
      list.push(mv);
    }

    const buckets = new Map<string, Bucket>();
    for (const [productId, list] of movementsByProduct) {
      const bucket: Bucket = {
        stockInitial: 0,
        achats: 0,
        ventes: 0,
        retoursAjustements: 0,
      };
      let running = 0;
      let initialCaptured = false;
      for (const mv of list) {
        const inPeriod = mv.createdAt >= start; // fin exclusive garantie par le where
        if (inPeriod && !initialCaptured) {
          bucket.stockInitial = running;
          initialCaptured = true;
        }
        const delta =
          mv.type === "SORTIE"
            ? -mv.quantity
            : mv.type === "ENTREE"
              ? mv.quantity
              : mv.stockAfter - mv.stockBefore; // AJUSTEMENT : delta réel
        running += delta;
        if (inPeriod) {
          if (mv.type === "ENTREE" && mv.refType === "ACHAT") {
            bucket.achats += mv.quantity;
          } else if (mv.type === "SORTIE" && mv.refType === "VENTE") {
            bucket.ventes += mv.quantity;
          } else {
            // MANUEL, INITIAL, autres : regroupés dans « Retours & ajustements »
            bucket.retoursAjustements += delta;
          }
        }
      }
      if (!initialCaptured) bucket.stockInitial = running;
      buckets.set(productId, bucket);
    }

    // ─── Lignes par produit ─────────────────────────────────────────────────
    const rows: InventoryProductRow[] = products.map((p) => {
      const b = buckets.get(p.id) ?? {
        stockInitial: 0,
        achats: 0,
        ventes: 0,
        retoursAjustements: 0,
      };
      const stockFinal = b.stockInitial + b.achats - b.ventes + b.retoursAjustements;
      return {
        productId: p.id,
        name: p.name,
        reference: p.reference,
        category: p.category,
        categoryLabel: labelOf(p.category),
        unit: p.unit,
        minStock: p.minStock,
        purchasePrice: p.purchasePrice,
        salePrice: p.salePrice,
        stockInitial: r2(b.stockInitial),
        achats: r2(b.achats),
        ventes: r2(b.ventes),
        retoursAjustements: r2(b.retoursAjustements),
        stockFinal: r2(stockFinal),
        currentStock: p.stock,
        valeurStockAchat: r2(stockFinal * p.purchasePrice),
        valeurStockVente: r2(stockFinal * p.salePrice),
        ventesValeur: r2(b.ventes * p.salePrice),
        marge: r2(b.ventes * (p.salePrice - p.purchasePrice)),
      };
    });

    // ─── Agrégation par catégorie ───────────────────────────────────────────
    const catMap = new Map<string, InventoryCategoryRow>();
    for (const row of rows) {
      const code = row.category || "AUTRES";
      let agg = catMap.get(code);
      if (!agg) {
        agg = {
          category: code,
          label: labelOf(code),
          productCount: 0,
          stockInitial: 0,
          achats: 0,
          ventes: 0,
          retoursAjustements: 0,
          stockFinal: 0,
          valeurStockAchat: 0,
          valeurStockVente: 0,
          ventesValeur: 0,
          marge: 0,
          products: [],
        };
        catMap.set(code, agg);
      }
      agg.productCount += 1;
      agg.stockInitial += row.stockInitial;
      agg.achats += row.achats;
      agg.ventes += row.ventes;
      agg.retoursAjustements += row.retoursAjustements;
      agg.stockFinal += row.stockFinal;
      agg.valeurStockAchat += row.valeurStockAchat;
      agg.valeurStockVente += row.valeurStockVente;
      agg.ventesValeur += row.ventesValeur;
      agg.marge += row.marge;
      agg.products.push(row);
    }
    const categoryRows = Array.from(catMap.values()).map((agg) => ({
      ...agg,
      stockInitial: r2(agg.stockInitial),
      achats: r2(agg.achats),
      ventes: r2(agg.ventes),
      retoursAjustements: r2(agg.retoursAjustements),
      stockFinal: r2(agg.stockFinal),
      valeurStockAchat: r2(agg.valeurStockAchat),
      valeurStockVente: r2(agg.valeurStockVente),
      ventesValeur: r2(agg.ventesValeur),
      marge: r2(agg.marge),
    }));

    // ─── Totaux généraux ────────────────────────────────────────────────────
    const totals = rows.reduce(
      (acc, row) => ({
        productCount: acc.productCount + 1,
        stockInitial: acc.stockInitial + row.stockInitial,
        achats: acc.achats + row.achats,
        ventes: acc.ventes + row.ventes,
        retoursAjustements: acc.retoursAjustements + row.retoursAjustements,
        stockFinal: acc.stockFinal + row.stockFinal,
        valeurStockAchat: acc.valeurStockAchat + row.valeurStockAchat,
        valeurStockVente: acc.valeurStockVente + row.valeurStockVente,
        ventesValeur: acc.ventesValeur + row.ventesValeur,
        marge: acc.marge + row.marge,
      }),
      {
        productCount: 0,
        stockInitial: 0,
        achats: 0,
        ventes: 0,
        retoursAjustements: 0,
        stockFinal: 0,
        valeurStockAchat: 0,
        valeurStockVente: 0,
        ventesValeur: 0,
        marge: 0,
      }
    );
    for (const key of Object.keys(totals) as (keyof typeof totals)[]) {
      totals[key] = key === "productCount" ? totals[key] : r2(totals[key]);
    }

    const endInclusive = new Date(end);
    endInclusive.setDate(endInclusive.getDate() - 1);

    return NextResponse.json({
      period: {
        type: period,
        label: periodLabel(period, start, end),
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        startLabel: formatDay(start),
        endLabel: formatDay(endInclusive),
      },
      products: rows,
      categories: categoryRows,
      totals,
    });
  } catch (error) {
    console.error("GET /api/inventory", error);
    return NextResponse.json(
      { error: "Erreur lors du calcul de l'inventaire" },
      { status: 500 }
    );
  }
}
