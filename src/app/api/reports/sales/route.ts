import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { CATEGORY_LABELS, monthLabel } from "@/lib/constants";

/**
 * GET /api/reports/sales?from=AAAA-MM-JJ&to=AAAA-MM-JJ
 * Rapport de ventes sur une période : synthèse, évolution mensuelle,
 * top clients, ventes par catégorie, top produits et détail des factures.
 */
export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    const iso = /^\d{4}-\d{2}-\d{2}$/;
    const fromParam = sp.get("from")?.trim() ?? "";
    const toParam = sp.get("to")?.trim() ?? "";
    const now = new Date();
    const from = iso.test(fromParam) ? fromParam : `${now.getFullYear()}-01-01`;
    const to = iso.test(toParam) ? toParam : `${now.getFullYear()}-12-31`;

    const invoices = await db.invoice.findMany({
      where: {
        type: "VENTE",
        date: {
          gte: new Date(`${from}T00:00:00.000Z`),
          lte: new Date(`${to}T23:59:59.999Z`),
        },
      },
      include: { items: true },
      orderBy: { date: "desc" },
    });

    // ─── Synthèse ────────────────────────────────────────────────────────────
    let totalHT = 0;
    let totalTTC = 0;
    let paidTotal = 0;
    let itemsCount = 0;
    let paidCount = 0;
    let partialCount = 0;
    let unpaidCount = 0;
    let deliveredCount = 0;
    let notDeliveredCount = 0;

    for (const f of invoices) {
      totalHT += f.totalHT;
      totalTTC += f.totalTTC;
      paidTotal += f.amountPaid;
      for (const item of f.items) itemsCount += item.quantity;
      if (f.paymentStatus === "PAYE") paidCount += 1;
      else if (f.paymentStatus === "PARTIEL") partialCount += 1;
      else unpaidCount += 1;
      if (f.deliveryStatus === "LIVRE") deliveredCount += 1;
      else notDeliveredCount += 1;
    }

    const summary = {
      count: invoices.length,
      totalHT,
      totalTTC,
      vatTotal: Math.max(0, totalTTC - totalHT),
      paidTotal,
      unpaidTotal: totalTTC - paidTotal,
      avgTicket: invoices.length > 0 ? Math.round(totalTTC / invoices.length) : 0,
      paidCount,
      partialCount,
      unpaidCount,
      deliveredCount,
      notDeliveredCount,
      itemsCount,
    };

    // ─── Évolution mensuelle ─────────────────────────────────────────────────
    const monthMap = new Map<string, { total: number; paid: number }>();
    for (const f of invoices) {
      const d = new Date(f.date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const entry = monthMap.get(key) ?? { total: 0, paid: 0 };
      entry.total += f.totalTTC;
      entry.paid += f.amountPaid;
      monthMap.set(key, entry);
    }
    const monthly = [...monthMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([monthKey, v]) => ({ monthKey, label: monthLabel(monthKey), total: v.total, paid: v.paid }));

    // ─── Top clients ─────────────────────────────────────────────────────────
    const clientMap = new Map<string, { name: string; count: number; total: number }>();
    for (const f of invoices) {
      const key = f.clientId ?? "comptoir";
      const entry = clientMap.get(key) ?? { name: f.clientName || "Client comptoir", count: 0, total: 0 };
      entry.count += 1;
      entry.total += f.totalTTC;
      clientMap.set(key, entry);
    }
    const topClients = [...clientMap.values()].sort((a, b) => b.total - a.total).slice(0, 10);

    // ─── Ventes par catégorie ────────────────────────────────────────────────
    const catMap = new Map<string, { total: number; quantity: number }>();
    for (const f of invoices) {
      for (const item of f.items) {
        const cat = item.category ?? "AUTRE";
        const entry = catMap.get(cat) ?? { total: 0, quantity: 0 };
        entry.total += item.total;
        entry.quantity += item.quantity;
        catMap.set(cat, entry);
      }
    }
    const byCategory = [...catMap.entries()]
      .map(([category, v]) => ({
        category,
        label: category === "AUTRE" ? "Autres articles" : (CATEGORY_LABELS[category] ?? category),
        total: v.total,
        quantity: v.quantity,
      }))
      .sort((a, b) => b.total - a.total);

    // ─── Top produits ────────────────────────────────────────────────────────
    const productMap = new Map<string, { quantity: number; total: number }>();
    for (const f of invoices) {
      for (const item of f.items) {
        const key = item.productName.trim() || "Article";
        const entry = productMap.get(key) ?? { quantity: 0, total: 0 };
        entry.quantity += item.quantity;
        entry.total += item.total;
        productMap.set(key, entry);
      }
    }
    const topProducts = [...productMap.entries()]
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);

    return NextResponse.json({
      from,
      to,
      summary,
      monthly,
      topClients,
      byCategory,
      topProducts,
      invoices,
    });
  } catch (error) {
    console.error("GET /api/reports/sales", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
