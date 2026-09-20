import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { CATEGORY_LABELS } from "@/lib/constants";

export async function GET() {
  try {
    const [ventes, proformaCount, clientCount, productCount, purchases, orders, products, recentRaw] =
      await Promise.all([
        db.invoice.findMany({
          where: { type: "VENTE" },
          select: {
            totalTTC: true,
            amountPaid: true,
            date: true,
            items: { select: { category: true, total: true } },
          },
        }),
        db.invoice.count({ where: { type: "PROFORMA" } }),
        db.client.count(),
        db.product.count(),
        db.purchase.aggregate({ _sum: { total: true } }),
        db.order.findMany({ where: { status: { in: ["EN_COURS", "CONFIRMEE"] } }, select: { id: true } }),
        db.product.findMany({
          where: {},
          orderBy: { stock: "asc" },
        }),
        db.invoice.findMany({
          where: { type: "VENTE" },
          orderBy: { date: "desc" },
          take: 6,
          include: { items: true },
        }),
      ]);

    const revenueTotal = ventes.reduce((s, f) => s + f.totalTTC, 0);
    const paidTotal = ventes.reduce((s, f) => s + f.amountPaid, 0);

    // Chiffre d'affaires des 6 derniers mois
    const now = new Date();
    const monthly: { month: string; total: number; paid: number }[] = [];
    const monthNames = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Août", "Sep", "Oct", "Nov", "Déc"];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const next = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
      const monthInvoices = ventes.filter((f) => {
        const fd = new Date(f.date);
        return fd >= d && fd < next;
      });
      monthly.push({
        month: monthNames[d.getMonth()],
        total: monthInvoices.reduce((s, f) => s + f.totalTTC, 0),
        paid: monthInvoices.reduce((s, f) => s + f.amountPaid, 0),
      });
    }

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
      .slice(0, 5);

    const lowStock = products
      .filter((p) => p.stock <= p.minStock)
      .sort((a, b) => a.stock - b.stock)
      .slice(0, 8);

    return NextResponse.json({
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
      monthlyRevenue: monthly,
      recentInvoices: recentRaw,
      topCategories,
    });
  } catch (error) {
    console.error("GET /api/dashboard", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
