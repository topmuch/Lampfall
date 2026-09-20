import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { CATEGORY_LABELS } from "@/lib/constants";

/** Tranches de facturation (FCFA) */
const TRANCHES = [
  { label: "< 50 000", min: 0, max: 50_000 },
  { label: "50k – 200k", min: 50_000, max: 200_000 },
  { label: "200k – 500k", min: 200_000, max: 500_000 },
  { label: "500k – 1M", min: 500_000, max: 1_000_000 },
  { label: "> 1M", min: 1_000_000, max: Infinity },
];

export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;

    // Année du tableau de bord (par défaut : année courante)
    const yearParam = Number(sp.get("year"));
    const year =
      Number.isInteger(yearParam) && yearParam >= 2000 && yearParam <= 2100
        ? yearParam
        : new Date().getFullYear();

    // Mois du calendrier au format AAAA-MM (par défaut : mois courant)
    const monthParam = sp.get("month");
    const monthMatch = /^(\d{4})-(\d{2})$/.exec(monthParam ?? "");
    const month =
      monthMatch && Number(monthMatch[2]) >= 1 && Number(monthMatch[2]) <= 12
        ? monthParam!
        : `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;

    const [ventes, proformaCount, clientCount, productCount, purchases, orders, products, recentRaw] =
      await Promise.all([
        db.invoice.findMany({
          where: { type: "VENTE" },
          select: {
            totalTTC: true,
            amountPaid: true,
            date: true,
            clientId: true,
            clientName: true,
            items: { select: { category: true, total: true } },
          },
        }),
        db.invoice.count({ where: { type: "PROFORMA" } }),
        db.client.count(),
        db.product.count(),
        db.purchase.aggregate({ _sum: { total: true } }),
        db.order.findMany({
          where: { status: { in: ["EN_COURS", "CONFIRMEE"] } },
          select: { id: true },
        }),
        db.product.findMany({ where: {}, orderBy: { stock: "asc" } }),
        db.invoice.findMany({
          where: { type: "VENTE" },
          orderBy: { date: "desc" },
          take: 6,
          include: { items: true },
        }),
      ]);

    const revenueTotal = ventes.reduce((s, f) => s + f.totalTTC, 0);
    const paidTotal = ventes.reduce((s, f) => s + f.amountPaid, 0);

    // CA des 12 mois de l'année sélectionnée
    const monthNames = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Août", "Sep", "Oct", "Nov", "Déc"];
    const monthlyRevenue = monthNames.map((label, idx) => {
      const start = new Date(year, idx, 1);
      const end = new Date(year, idx + 1, 1);
      const monthInvoices = ventes.filter((f) => {
        const fd = new Date(f.date);
        return fd >= start && fd < end;
      });
      return {
        month: label,
        monthKey: `${year}-${String(idx + 1).padStart(2, "0")}`,
        total: monthInvoices.reduce((s, f) => s + f.totalTTC, 0),
        paid: monthInvoices.reduce((s, f) => s + f.amountPaid, 0),
      };
    });

    // Calendrier : CA par jour du mois sélectionné
    const [my, mm] = month.split("-").map(Number);
    const monthStart = new Date(my, mm - 1, 1);
    const monthEnd = new Date(my, mm, 1);
    const daysInMonth = new Date(my, mm, 0).getDate();
    const dailyRevenue = Array.from({ length: daysInMonth }, (_, i) => ({ day: i + 1, total: 0, count: 0 }));
    for (const f of ventes) {
      const fd = new Date(f.date);
      if (fd >= monthStart && fd < monthEnd) {
        const d = dailyRevenue[fd.getDate() - 1];
        if (d) {
          d.total += f.totalTTC;
          d.count += 1;
        }
      }
    }

    // Tranches de facturation
    const tranches = TRANCHES.map((t) => {
      const list = ventes.filter((f) => f.totalTTC >= t.min && f.totalTTC < t.max);
      return { label: t.label, count: list.length, total: list.reduce((s, f) => s + f.totalTTC, 0) };
    });

    // Top 5 clients par revenu
    const clientTotals = new Map<string, { name: string; total: number }>();
    for (const f of ventes) {
      const key = f.clientId ?? "comptoir";
      const entry = clientTotals.get(key) ?? { name: f.clientName || "Client comptoir", total: 0 };
      entry.total += f.totalTTC;
      clientTotals.set(key, entry);
    }
    const topClients = [...clientTotals.values()].sort((a, b) => b.total - a.total).slice(0, 5);

    // Top catégories (par montant facturé)
    const catTotals = new Map<string, number>();
    for (const f of ventes) {
      for (const item of f.items) {
        if (!item.category) continue;
        catTotals.set(item.category, (catTotals.get(item.category) ?? 0) + item.total);
      }
    }
    const topCategories = [...catTotals.entries()]
      .map(([category, total]) => ({ category, label: CATEGORY_LABELS[category] ?? category, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 6);

    const lowStock = products
      .filter((p) => p.stock <= p.minStock)
      .sort((a, b) => a.stock - b.stock)
      .slice(0, 8);

    return NextResponse.json({
      year,
      month,
      invoiceCount: ventes.length,
      proformaCount,
      clientCount,
      productCount,
      revenueTotal,
      paidTotal,
      unpaidTotal: revenueTotal - paidTotal,
      purchaseTotal: purchases._sum.total ?? 0,
      pendingOrders: orders.length,
      lowStock,
      monthlyRevenue,
      dailyRevenue,
      tranches,
      topClients,
      recentInvoices: recentRaw,
      topCategories,
    });
  } catch (error) {
    console.error("GET /api/dashboard", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
