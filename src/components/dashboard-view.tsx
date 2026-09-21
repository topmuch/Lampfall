"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertTriangle,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Download,
  FileText,
  Package,
  TrendingDown,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import { useFetch } from "@/hooks/use-fetch";
import { formatMoney, formatMoneyCompact } from "@/lib/constants";
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
import { cn } from "@/lib/utils";

const MONTH_TABS = ["JAN", "FÉV", "MAR", "AVR", "MAI", "JUIN", "JUIL", "AOÛT", "SEP", "OCT", "NOV", "DÉC"];
const WEEKDAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

// Couleurs des pastilles KPI (façon dashboard premium)
const TONES = {
  violet: "bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-violet-500/30",
  rose: "bg-gradient-to-br from-rose-500 to-pink-600 text-white shadow-rose-500/30",
  amber: "bg-gradient-to-br from-amber-500 to-orange-500 text-white shadow-amber-500/30",
  teal: "bg-gradient-to-br from-teal-500 to-emerald-600 text-white shadow-teal-500/30",
} as const;

type Tone = keyof typeof TONES;

function KpiCard({
  title,
  value,
  icon: Icon,
  tone,
}: {
  title: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: Tone;
}) {
  return (
    <Card className="shadow-luxe card-luxe">
      <CardContent className="flex items-center gap-3.5 p-4 sm:p-5">
        <div className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-xl shadow-lg", TONES[tone])}>
          <Icon className="h-5 w-5" aria-hidden />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground leading-tight">{title}</p>
          <p className="mt-0.5 truncate text-lg font-extrabold tabular-nums sm:text-xl" title={value}>
            {value}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function MiniStat({ title, value, alert }: { title: string; value: string; alert?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-xl border bg-card px-3.5 py-2.5">
      <span className="text-xs text-muted-foreground">{title}</span>
      <span
        className={cn(
          "text-sm font-bold tabular-nums truncate",
          alert ? "text-destructive" : "text-foreground"
        )}
        title={value}
      >
        {value}
      </span>
    </div>
  );
}

function DetailsPill({ label = "Détails", onClick }: { label?: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full border border-primary/40 px-3.5 py-1 text-xs font-semibold text-primary transition-colors hover:bg-primary hover:text-primary-foreground"
    >
      {label}
    </button>
  );
}

function VBar({
  label,
  value,
  max,
  display,
  colorClass,
}: {
  label: string;
  value: number;
  max: number;
  display: string;
  colorClass: string;
}) {
  const h = Math.max(4, (value / max) * 100);
  return (
    <div className="flex min-w-0 flex-1 flex-col items-center gap-1.5" title={`${label} : ${display}`}>
      <span className="text-[10px] font-semibold tabular-nums text-muted-foreground">{display}</span>
      <div className="flex h-24 w-full max-w-16 items-end overflow-hidden rounded-t-lg bg-muted/70 sm:h-28">
        <div
          className={cn("w-full rounded-t-lg transition-all", colorClass)}
          style={{ height: `${h}%` }}
        />
      </div>
      <span className="w-full truncate text-center text-[10px] sm:text-[11px] font-medium" title={label}>
        {label}
      </span>
    </div>
  );
}

// Intensité de couleur du calendrier selon le CA du jour
function calendarCellClass(total: number, max: number): string {
  if (total <= 0) return "bg-muted/50 text-muted-foreground";
  const ratio = total / max;
  if (ratio > 0.75) return "bg-violet-600 text-white font-bold shadow-violet-600/40 shadow-md";
  if (ratio > 0.5) return "bg-violet-500/85 text-white";
  if (ratio > 0.25) return "bg-violet-400/70 text-white";
  if (ratio > 0.1) return "bg-violet-300/60 text-violet-950";
  return "bg-gold-soft text-foreground";
}

export function DashboardView({ onNavigate }: { onNavigate: (view: string) => void }) {
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(() => new Date().getMonth() + 1);
  const { data: stats, loading } = useFetch<DashboardStats>(
    `/api/dashboard?year=${year}&month=${year}-${String(month).padStart(2, "0")}`
  );
  const { toast } = useToast();

  // Grille du calendrier : lundi en premier
  const calendar = useMemo(() => {
    if (!stats) return [];
    const first = new Date(year, month - 1, 1);
    const offset = (first.getDay() + 6) % 7; // lundi = 0
    const cells: (number | null)[] = Array.from({ length: offset }, () => null);
    for (const d of stats.dailyRevenue) cells.push(d.day);
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [stats, year, month]);

  if (loading || !stats) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-full" />
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          <Skeleton className="h-80 w-full lg:col-span-2" />
          <Skeleton className="h-80 w-full" />
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  const maxDaily = Math.max(1, ...stats.dailyRevenue.map((d) => d.total));
  const maxClient = Math.max(1, ...stats.topClients.map((c) => c.total));
  const maxCategory = Math.max(1, ...stats.topCategories.map((c) => c.total));
  const maxTranche = Math.max(1, ...stats.tranches.map((t) => t.count));

  // Évolution du CA vs année précédente
  const prevYear = stats.year - 1;
  const yearDelta =
    stats.prevYearRevenue > 0
      ? ((stats.revenueTotal - stats.prevYearRevenue) / stats.prevYearRevenue) * 100
      : null;
  const yearDeltaFmt =
    yearDelta !== null
      ? Math.abs(yearDelta).toLocaleString("fr-FR", {
          minimumFractionDigits: 1,
          maximumFractionDigits: 1,
        })
      : "";

  const trancheColors = [
    "bg-gradient-to-r from-violet-600 to-violet-400",
    "bg-gradient-to-r from-purple-600 to-purple-400",
    "bg-gradient-to-r from-fuchsia-600 to-fuchsia-400",
    "bg-gradient-to-r from-pink-600 to-pink-400",
    "bg-gradient-to-r from-rose-600 to-rose-400",
  ];

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* Bandeau titre façon dashboard premium */}
      <div className="card-luxe rounded-xl border bg-card shadow-luxe">
        <div className="flex items-center justify-between gap-3 px-4 py-3.5">
          <div className="flex w-24 items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setYear((y) => y - 1)}
              aria-label="Année précédente"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-xs font-semibold tabular-nums text-muted-foreground">{year}</span>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setYear((y) => y + 1)}
              aria-label="Année suivante"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex flex-col items-center gap-1">
            <h1 className="text-center text-base font-extrabold sm:text-xl">
              <span className="text-luxe-gradient">
                Tableau de bord des ventes — Année {stats.year}
              </span>
            </h1>
            {yearDelta !== null ? (
              <Badge
                variant="outline"
                className={cn(
                  "gap-1 border-gold/60 bg-gold-soft/50 text-[11px] font-semibold",
                  yearDelta >= 0
                    ? "text-emerald-700 dark:text-emerald-400"
                    : "text-red-600 dark:text-red-400"
                )}
                title={`CA ${stats.year} : ${formatMoney(stats.revenueTotal)} — CA ${prevYear} : ${formatMoney(stats.prevYearRevenue)}`}
              >
                {yearDelta >= 0 ? (
                  <TrendingUp className="h-3 w-3" aria-hidden />
                ) : (
                  <TrendingDown className="h-3 w-3" aria-hidden />
                )}
                vs {prevYear} : {yearDelta >= 0 ? "+" : "−"}
                {yearDeltaFmt} %
              </Badge>
            ) : (
              <Badge
                variant="outline"
                className="gap-1 border-gold/60 bg-gold-soft/50 text-[11px] font-semibold text-muted-foreground"
                title={`Aucun CA enregistré en ${prevYear}`}
              >
                vs {prevYear} : —
              </Badge>
            )}
          </div>
          <div className="flex w-24 justify-end">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-violet-600 to-fuchsia-600 text-white shadow-lg shadow-violet-600/30">
              <TrendingUp className="h-4.5 w-4.5" aria-hidden />
            </div>
          </div>
        </div>
      </div>

      {/* Cartes KPI principales */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard title="Total Revenu" value={formatMoneyCompact(stats.revenueTotal)} icon={Wallet} tone="violet" />
        <KpiCard title="Nombre Factures" value={String(stats.invoiceCount)} icon={FileText} tone="rose" />
        <KpiCard title="Nombre Clients" value={String(stats.clientCount)} icon={Users} tone="amber" />
        <KpiCard
          title="Commandes en cours"
          value={String(stats.pendingOrders)}
          icon={ClipboardList}
          tone="teal"
        />
      </div>

      {/* Mini indicateurs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MiniStat title="Encaissé" value={formatMoneyCompact(stats.paidTotal)} />
        <MiniStat title="Impayés" value={formatMoneyCompact(stats.unpaidTotal)} alert={stats.unpaidTotal > 0} />
        <MiniStat title="Proformas" value={String(stats.proformaCount)} />
        <MiniStat title="Achats fournisseurs" value={formatMoneyCompact(stats.purchaseTotal)} />
      </div>

      {/* Calendrier + Tranches */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Période calendaire */}
        <Card className="card-luxe shadow-luxe lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarDays className="h-4 w-4 text-primary" aria-hidden />
              Période Calendaire — CA par jour
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Onglets des mois */}
            <div className="flex gap-1 overflow-x-auto pb-1" role="tablist" aria-label="Choisir le mois">
              {MONTH_TABS.map((label, idx) => {
                const active = idx + 1 === month;
                return (
                  <button
                    key={label}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setMonth(idx + 1)}
                    className={cn(
                      "shrink-0 rounded-md px-2.5 py-1.5 text-[11px] font-bold tracking-wide transition-colors",
                      active
                        ? "theme-toggle-luxe text-white"
                        : "bg-muted/70 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                    )}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            {/* Grille du mois */}
            <div className="grid grid-cols-7 gap-1.5">
              {WEEKDAYS.map((d) => (
                <div key={d} className="text-center text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {d}
                </div>
              ))}
              {calendar.map((day, i) =>
                day === null ? (
                  <div key={`e-${i}`} />
                ) : (
                  (() => {
                    const info = stats.dailyRevenue[day - 1];
                    return (
                      <div
                        key={day}
                        title={
                          info && info.total > 0
                            ? `${day} ${MONTH_TABS[month - 1]} : ${formatMoney(info.total)} (${info.count} facture${info.count > 1 ? "s" : ""})`
                            : `${day} ${MONTH_TABS[month - 1]} : aucun CA`
                        }
                        className={cn(
                          "flex aspect-square items-center justify-center rounded-md text-[11px] sm:text-xs transition-transform hover:scale-105",
                          calendarCellClass(info?.total ?? 0, maxDaily)
                        )}
                      >
                        {day}
                      </div>
                    );
                  })()
                )
              )}
            </div>
            {/* Légende */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm bg-muted/60 border" /> Aucun CA
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm bg-violet-300/60" /> Faible
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm bg-violet-500/85" /> Moyen
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm bg-violet-600" /> Élevé
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Tranches de facturation */}
        <Card className="card-luxe shadow-luxe">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Montant par tranche de facturation</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3.5">
            {stats.tranches.every((t) => t.count === 0) ? (
              <p className="py-10 text-center text-sm text-muted-foreground">Aucune facture enregistrée.</p>
            ) : (
              stats.tranches.map((t, i) => (
                <div key={t.label} title={`${t.label} : ${t.count} facture(s) — ${formatMoney(t.total)}`}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="font-medium">{t.label}</span>
                    <span className="tabular-nums text-muted-foreground">
                      {t.count} · {formatMoney(t.total)}
                    </span>
                  </div>
                  <div className="h-3 overflow-hidden rounded-full bg-muted/70">
                    <div
                      className={cn("h-full rounded-full transition-all", trancheColors[i])}
                      style={{ width: `${Math.max(2, (t.count / maxTranche) * 100)}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top clients + Catégories */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="card-luxe shadow-luxe">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between gap-2 text-base">
              <span>Top 5 — Revenu par client</span>
              <DetailsPill onClick={() => onNavigate("clients")} />
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats.topClients.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">Aucune vente enregistrée.</p>
            ) : (
              <div className="flex items-end gap-2 sm:gap-4">
                {stats.topClients.map((c, i) => (
                  <VBar
                    key={c.name}
                    label={c.name}
                    value={c.total}
                    max={maxClient}
                    display={`${Math.round(c.total / 1000)}k`}
                    colorClass={
                      i === 0
                        ? "bg-gradient-to-t from-amber-600 to-amber-400"
                        : i === 1
                          ? "bg-gradient-to-t from-amber-500/90 to-orange-400/90"
                          : "bg-gradient-to-t from-amber-400/80 to-amber-300/70"
                    }
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="card-luxe shadow-luxe">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between gap-2 text-base">
              <span>Total Revenu par catégorie</span>
              <DetailsPill onClick={() => onNavigate("produits")} />
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats.topCategories.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">Aucune vente enregistrée.</p>
            ) : (
              <div className="flex items-end gap-2 sm:gap-3">
                {stats.topCategories.slice(0, 6).map((c, i) => (
                  <VBar
                    key={c.category}
                    label={c.label}
                    value={c.total}
                    max={maxCategory}
                    display={`${Math.round(c.total / 1000)}k`}
                    colorClass={
                      i === 0
                        ? "bg-gradient-to-t from-teal-600 to-teal-400"
                        : i === 1
                          ? "bg-gradient-to-t from-teal-500/90 to-emerald-400/90"
                          : "bg-gradient-to-t from-teal-400/80 to-teal-300/70"
                    }
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Dernières factures + Alertes stock */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="min-w-0 overflow-hidden shadow-luxe">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center justify-between">
              Dernières factures
              <DetailsPill label="Voir tout" onClick={() => onNavigate("factures")} />
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats.recentInvoices.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Aucune facture.</p>
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

        <Card className="min-w-0 overflow-hidden shadow-luxe">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" aria-hidden />
              Alertes de stock
              <span className="ml-auto">
                <DetailsPill label="Produits" onClick={() => onNavigate("produits")} />
              </span>
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
                    <div className="min-w-0 flex items-center gap-2.5">
                      {p.image ? (
                         
                        <img src={p.image} alt="" className="h-8 w-8 rounded-md object-cover shrink-0" />
                      ) : (
                        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted shrink-0">
                          <Package className="h-4 w-4 text-muted-foreground" aria-hidden />
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{p.name}</p>
                        <p className="text-xs text-muted-foreground">
                          Seuil : {p.minStock} {p.unit}
                        </p>
                      </div>
                    </div>
                    <span className="rounded-md bg-red-100 px-2 py-1 text-xs font-bold text-red-700 whitespace-nowrap dark:bg-red-950 dark:text-red-300">
                      {p.stock} {p.unit}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
