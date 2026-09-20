"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertTriangle,
  ArrowRight,
  ClipboardList,
  FileText,
  Package,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import { useFetch } from "@/hooks/use-fetch";
import { formatMoney } from "@/lib/constants";
import type { DashboardStats } from "@/lib/types";
import { PaymentBadge } from "@/components/status-badges";
import { saveOrOpenInvoicePDF } from "@/lib/pdf";
import { useToast } from "@/hooks/use-toast";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Download } from "lucide-react";

function StatCard({
  title,
  value,
  icon: Icon,
  tone = "default",
}: {
  title: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  tone?: "default" | "green" | "red" | "amber";
}) {
  const toneClasses = {
    default: "bg-muted text-foreground",
    green: "bg-green-100 text-green-700",
    red: "bg-red-100 text-red-600",
    amber: "bg-amber-100 text-amber-700",
  }[tone];

  return (
    <Card>
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">{title}</p>
            <p className="mt-1 text-base font-bold tabular-nums sm:text-lg" title={value}>
              {value}
            </p>
          </div>
          <div className={`rounded-lg p-2 shrink-0 ${toneClasses}`}>
            <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function DashboardView() {
  const { data: stats, loading } = useFetch<DashboardStats>("/api/dashboard");
  const { toast } = useToast();

  if (loading || !stats) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  const maxMonthly = Math.max(1, ...stats.monthlyRevenue.map((m) => m.total));
  const maxCategory = Math.max(1, ...stats.topCategories.map((c) => c.total));

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold">Tableau de bord</h2>
        <p className="text-sm text-muted-foreground">
          Vue d&apos;ensemble de l&apos;activité commerciale d&apos;ETS LAMP FALL.
        </p>
      </div>

      {/* Statistiques principales */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Chiffre d'affaires"
          value={formatMoney(stats.revenueTotal)}
          icon={TrendingUp}
          tone="green"
        />
        <StatCard title="Encaissé" value={formatMoney(stats.paidTotal)} icon={Wallet} />
        <StatCard
          title="Impayés"
          value={formatMoney(stats.unpaidTotal)}
          icon={AlertTriangle}
          tone={stats.unpaidTotal > 0 ? "red" : "default"}
        />
        <StatCard
          title="Achats fournisseurs"
          value={formatMoney(stats.purchaseTotal)}
          icon={Package}
        />
        <StatCard title="Factures de vente" value={String(stats.invoiceCount)} icon={FileText} />
        <StatCard title="Proformas" value={String(stats.proformaCount)} icon={ClipboardList} />
        <StatCard title="Clients" value={String(stats.clientCount)} icon={Users} />
        <StatCard
          title="Commandes en cours"
          value={String(stats.pendingOrders)}
          icon={ClipboardList}
          tone={stats.pendingOrders > 0 ? "amber" : "default"}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Chiffre d'affaires mensuel */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Chiffre d&apos;affaires — 6 derniers mois</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end justify-between gap-2 sm:gap-3">
              {stats.monthlyRevenue.map((m) => (
                <div key={m.month} className="flex-1 flex flex-col items-center gap-1.5">
                  <span className="text-[10px] sm:text-xs font-medium tabular-nums text-muted-foreground">
                    {m.total > 0 ? `${Math.round(m.total / 1000)}k` : ""}
                  </span>
                  <div className="relative w-full max-w-14 h-28 sm:h-32 rounded-t-md bg-muted overflow-hidden">
                    <div
                      className="absolute bottom-0 w-full rounded-t-md bg-primary/85 transition-all"
                      style={{ height: `${Math.max(2, (m.total / maxMonthly) * 100)}%` }}
                      title={`Total : ${formatMoney(m.total)} — Encaissé : ${formatMoney(m.paid)}`}
                    />
                    <div
                      className="absolute bottom-0 w-full bg-green-400/70"
                      style={{ height: `${Math.max(1, (m.paid / maxMonthly) * 100)}%` }}
                    />
                  </div>
                  <span className="text-xs font-medium">{m.month}</span>
                </div>
              ))}
            </div>
            <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm bg-primary/85" /> Facturé
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm bg-green-400/70" /> Encaissé
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Top catégories */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Catégories les plus vendues</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {stats.topCategories.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">
                Aucune vente enregistrée.
              </p>
            ) : (
              stats.topCategories.map((c) => (
                <div key={c.category}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium">{c.label}</span>
                    <span className="tabular-nums text-muted-foreground">
                      {formatMoney(c.total)}
                    </span>
                  </div>
                  <div className="h-2.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary/80"
                      style={{ width: `${Math.max(3, (c.total / maxCategory) * 100)}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Alertes stock */}
        <Card className="min-w-0 overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Alertes de stock
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats.lowStock.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                Tous les stocks sont au niveau. 👍
              </p>
            ) : (
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {stats.lowStock.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between gap-3 rounded-lg border p-2.5"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{p.name}</p>
                      <p className="text-xs text-muted-foreground">
                        Seuil : {p.minStock} {p.unit}
                      </p>
                    </div>
                    <span className="rounded-md bg-red-100 px-2 py-1 text-xs font-bold text-red-700 whitespace-nowrap">
                      {p.stock} {p.unit}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Dernières factures */}
        <Card className="min-w-0 overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center justify-between">
              Dernières factures
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats.recentInvoices.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                Aucune facture.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>N°</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Paiement</TableHead>
                    <TableHead className="text-right">Montant</TableHead>
                    <TableHead className="w-10" aria-label="PDF" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stats.recentInvoices.map((f) => (
                    <TableRow key={f.id}>
                      <TableCell className="font-medium text-xs whitespace-nowrap">{f.number}</TableCell>
                      <TableCell className="max-w-24 truncate text-xs" title={f.clientName}>
                        {f.clientName || "Comptoir"}
                      </TableCell>
                      <TableCell>
                        <PaymentBadge status={f.paymentStatus} />
                      </TableCell>
                      <TableCell className="text-right tabular-nums whitespace-nowrap text-xs">
                        {formatMoney(f.totalTTC)}
                      </TableCell>
                      <TableCell>
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              await saveOrOpenInvoicePDF(f, "download");
                            } catch {
                              toast({ title: "Erreur PDF", variant: "destructive" });
                            }
                          }}
                          className="text-muted-foreground hover:text-primary"
                          aria-label={`Télécharger ${f.number}`}
                        >
                          <Download className="h-4 w-4" />
                        </button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
