"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertCircle,
  BarChart3,
  CalendarRange,
  FileDown,
  FileSpreadsheet,
  FileText,
  Package,
  RefreshCw,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import { useFetch } from "@/hooks/use-fetch";
import { formatDate, formatMoney, formatMoneyCompact } from "@/lib/constants";
import type { SalesReport } from "@/lib/types";
import { DeliveryBadge, PaymentBadge } from "@/components/status-badges";
import { buildSalesReportPDF, downloadPDF, openPDF, saveOrOpenInvoicePDF } from "@/lib/pdf";
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

// ─── Périodes ───────────────────────────────────────────────────────────────

const pad = (n: number) => String(n).padStart(2, "0");
const toLocalISO = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

type Preset = "today" | "7d" | "month" | "lastMonth" | "year" | "lastYear" | "custom";

const PRESETS: { id: Preset; label: string }[] = [
  { id: "today", label: "Aujourd'hui" },
  { id: "7d", label: "7 derniers jours" },
  { id: "month", label: "Ce mois" },
  { id: "lastMonth", label: "Mois dernier" },
  { id: "year", label: "Cette année" },
  { id: "lastYear", label: "Année dernière" },
];

function rangeFor(preset: Preset): { from: string; to: string } | null {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  switch (preset) {
    case "today":
      return { from: toLocalISO(now), to: toLocalISO(now) };
    case "7d": {
      const from = new Date(now);
      from.setDate(from.getDate() - 6);
      return { from: toLocalISO(from), to: toLocalISO(now) };
    }
    case "month":
      return { from: toLocalISO(new Date(y, m, 1)), to: toLocalISO(new Date(y, m + 1, 0)) };
    case "lastMonth":
      return { from: toLocalISO(new Date(y, m - 1, 1)), to: toLocalISO(new Date(y, m, 0)) };
    case "year":
      return { from: `${y}-01-01`, to: `${y}-12-31` };
    case "lastYear":
      return { from: `${y - 1}-01-01`, to: `${y - 1}-12-31` };
    default:
      return null;
  }
}

// ─── Composants graphiques ──────────────────────────────────────────────────

const BAR_TONES = {
  violet: "bg-gradient-to-t from-violet-600 to-fuchsia-400",
  amber: "bg-gradient-to-t from-amber-500 to-orange-400",
  teal: "bg-gradient-to-t from-teal-500 to-emerald-400",
} as const;

function VBar({
  label,
  title,
  value,
  max,
  display,
  tone,
}: {
  label: string;
  title: string;
  value: number;
  max: number;
  display: string;
  tone: keyof typeof BAR_TONES;
}) {
  const h = max > 0 ? Math.max(4, (value / max) * 100) : 0;
  return (
    <div className="flex min-w-0 flex-1 flex-col items-center gap-1.5" title={title}>
      <span className="text-[10px] font-semibold tabular-nums text-muted-foreground">{display}</span>
      <div className="flex h-28 w-full max-w-14 items-end overflow-hidden rounded-t-lg bg-muted/70">
        <div className={cn("w-full rounded-t-lg transition-all", BAR_TONES[tone])} style={{ height: `${h}%` }} />
      </div>
      <span className="w-full truncate text-center text-[10px] font-medium sm:text-[11px]" title={label}>
        {label}
      </span>
    </div>
  );
}

function HBar({
  label,
  value,
  max,
  display,
  tone,
}: {
  label: string;
  value: number;
  max: number;
  display: string;
  tone: "violet" | "amber" | "teal";
}) {
  const w = max > 0 ? Math.max(2, (value / max) * 100) : 0;
  const gradients = {
    violet: "bg-gradient-to-r from-violet-500 to-fuchsia-500",
    amber: "bg-gradient-to-r from-amber-500 to-orange-500",
    teal: "bg-gradient-to-r from-teal-500 to-emerald-500",
  };
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="truncate font-medium" title={label}>
          {label}
        </span>
        <span className="shrink-0 font-bold tabular-nums text-muted-foreground">{display}</span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-muted">
        <div className={cn("h-full rounded-full transition-all", gradients[tone])} style={{ width: `${w}%` }} />
      </div>
    </div>
  );
}

function MiniStat({ title, value, alert }: { title: string; value: string; alert?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-xl border bg-card px-3 py-2">
      <span className="text-[11px] text-muted-foreground leading-tight">{title}</span>
      <span
        className={cn("text-sm font-bold tabular-nums truncate", alert ? "text-destructive" : "text-foreground")}
        title={value}
      >
        {value}
      </span>
    </div>
  );
}

const KPI_TONES = {
  violet: "bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-violet-500/30",
  teal: "bg-gradient-to-br from-teal-500 to-emerald-600 text-white shadow-teal-500/30",
  rose: "bg-gradient-to-br from-rose-500 to-pink-600 text-white shadow-rose-500/30",
  amber: "bg-gradient-to-br from-amber-500 to-orange-500 text-white shadow-amber-500/30",
} as const;

function KpiCard({
  title,
  value,
  icon: Icon,
  tone,
}: {
  title: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: keyof typeof KPI_TONES;
}) {
  return (
    <Card className="shadow-luxe card-luxe">
      <CardContent className="flex items-center gap-3.5 p-4 sm:p-5">
        <div className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-xl shadow-lg", KPI_TONES[tone])}>
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

// ─── Vue principale ─────────────────────────────────────────────────────────

export function ReportsView() {
  const { toast } = useToast();
  const [preset, setPreset] = useState<Preset>("year");
  const initial = rangeFor("year")!;
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);

  const url = useMemo(() => `/api/reports/sales?from=${from}&to=${to}`, [from, to]);
  const { data: report, loading, error, refetch } = useFetch<SalesReport>(url);

  const applyPreset = (id: Preset) => {
    const range = rangeFor(id);
    setPreset(id);
    if (range) {
      setFrom(range.from);
      setTo(range.to);
    }
  };

  const periodLabel = `Du ${formatDate(from)} au ${formatDate(to)}`;

  const summary = report?.summary;

  const handleReportPDF = async (action: "download" | "open") => {
    if (!report) return;
    try {
      const doc = await buildSalesReportPDF(report, periodLabel);
      if (action === "download") {
        downloadPDF(doc, `Rapport-Ventes-${from}_${to}.pdf`);
        toast({ title: "Export PDF", description: `${report.summary.count} facture(s) — ${periodLabel}.` });
      } else {
        openPDF(doc);
      }
    } catch {
      toast({ title: "Erreur PDF", description: "Génération du rapport impossible.", variant: "destructive" });
    }
  };

  const handleInvoicePDF = async (num: string, action: "download" | "open") => {
    const inv = report?.invoices.find((f) => f.number === num);
    if (!inv) return;
    try {
      await saveOrOpenInvoicePDF(inv, action);
    } catch {
      toast({ title: "Erreur PDF", description: "Génération du PDF impossible.", variant: "destructive" });
    }
  };

  const exportCSV = () => {
    if (!report || report.invoices.length === 0) return;
    const rows: (string | number)[][] = [
      ["Numéro", "Date", "Client", "Paiement", "Livraison", "Total HT", "TVA", "Total TTC", "Payé", "Reste"],
      ...report.invoices.map((f) => [
        f.number,
        formatDate(f.date),
        f.clientName || "Client comptoir",
        f.paymentStatus,
        f.deliveryStatus,
        f.totalHT,
        f.totalTTC - f.totalHT,
        f.totalTTC,
        f.amountPaid,
        f.totalTTC - f.amountPaid,
      ]),
    ];
    const csv =
      "\uFEFF" +
      rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(";")).join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `rapport-ventes-${from}_${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Export CSV", description: `${report.invoices.length} ligne(s) exportée(s).` });
  };

  const maxMonthly = useMemo(() => Math.max(0, ...(report?.monthly ?? []).map((m) => m.total)), [report]);
  const maxClient = useMemo(() => Math.max(0, ...(report?.topClients ?? []).map((c) => c.total)), [report]);
  const maxCategory = useMemo(() => Math.max(0, ...(report?.byCategory ?? []).map((c) => c.total)), [report]);

  return (
    <div className="space-y-4">
      {/* En-tête */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold">Rapports de vente</h2>
          <p className="text-sm text-muted-foreground">
            Analyse du chiffre d&apos;affaires sur la période choisie, exportable en PDF et CSV.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={refetch} aria-label="Actualiser">
            <RefreshCw className="h-4 w-4" />
            <span className="hidden sm:inline">Actualiser</span>
          </Button>
          <Button variant="outline" size="sm" onClick={exportCSV} disabled={!report || (summary?.count ?? 0) === 0}>
            <FileSpreadsheet className="h-4 w-4" />
            Export CSV
          </Button>
          <Button size="sm" onClick={() => handleReportPDF("download")} disabled={!report || (summary?.count ?? 0) === 0}>
            <FileDown className="h-4 w-4" />
            Exporter le rapport PDF
          </Button>
        </div>
      </div>

      {/* Sélection de période */}
      <Card className="shadow-luxe card-luxe">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarRange className="h-4 w-4 text-primary" aria-hidden />
            Période d&apos;analyse
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2" role="group" aria-label="Périodes prédéfinies">
            {PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => applyPreset(p.id)}
                className={cn(
                  "rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors",
                  preset === p.id
                    ? "border-transparent bg-primary text-primary-foreground shadow-md"
                    : "border-border text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
                aria-pressed={preset === p.id}
              >
                {p.label}
              </button>
            ))}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="space-y-1.5">
              <Label htmlFor="report-from" className="text-xs">
                Du
              </Label>
              <Input
                id="report-from"
                type="date"
                value={from}
                onChange={(e) => {
                  setFrom(e.target.value);
                  setPreset("custom");
                }}
                className="w-full sm:w-44"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="report-to" className="text-xs">
                Au
              </Label>
              <Input
                id="report-to"
                type="date"
                value={to}
                onChange={(e) => {
                  setTo(e.target.value);
                  setPreset("custom");
                }}
                className="w-full sm:w-44"
              />
            </div>
            <p className="pb-2 text-xs font-medium text-muted-foreground sm:ml-auto sm:pb-3">{periodLabel}</p>
          </div>
        </CardContent>
      </Card>

      {/* Chargement */}
      {loading && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-20" />
            ))}
          </div>
          <Skeleton className="h-52" />
          <div className="grid gap-3 lg:grid-cols-2">
            <Skeleton className="h-48" />
            <Skeleton className="h-48" />
          </div>
        </div>
      )}

      {/* Erreur */}
      {error && !loading && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="flex items-center gap-3 p-4 text-sm text-destructive">
            <AlertCircle className="h-5 w-5 shrink-0" aria-hidden />
            <span>{error}</span>
          </CardContent>
        </Card>
      )}

      {/* Rapport vide */}
      {report && !loading && summary?.count === 0 && (
        <Card className="shadow-luxe">
          <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
            <BarChart3 className="h-10 w-10 text-muted-foreground/40" aria-hidden />
            <p className="font-semibold">Aucune vente sur cette période</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Aucune facture de vente n&apos;a été enregistrée entre le {formatDate(from)} et le {formatDate(to)}.
              Choisissez une autre période ou créez une nouvelle facture.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Contenu du rapport */}
      {report && !loading && summary && summary.count > 0 && (
        <>
          {/* KPI */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <KpiCard title="CA TTC" value={formatMoneyCompact(summary.totalTTC)} icon={TrendingUp} tone="violet" />
            <KpiCard title="Encaissé" value={formatMoneyCompact(summary.paidTotal)} icon={Wallet} tone="teal" />
            <KpiCard title="Reste à payer" value={formatMoneyCompact(summary.unpaidTotal)} icon={FileText} tone="rose" />
            <KpiCard title="Factures" value={String(summary.count)} icon={Users} tone="amber" />
          </div>

          {/* Mini indicateurs */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <MiniStat title="Panier moyen" value={formatMoneyCompact(summary.avgTicket)} />
            <MiniStat title="CA HT" value={formatMoneyCompact(summary.totalHT)} />
            <MiniStat title="TVA collectée" value={formatMoneyCompact(summary.vatTotal)} />
            <MiniStat title="Articles vendus" value={String(summary.itemsCount)} />
            <MiniStat title="Payées" value={String(summary.paidCount)} />
            <MiniStat title="Partielles" value={String(summary.partialCount)} />
            <MiniStat title="Impayées" value={String(summary.unpaidCount)} alert={summary.unpaidCount > 0} />
            <MiniStat title="Non livrées" value={String(summary.notDeliveredCount)} alert={summary.notDeliveredCount > 0} />
          </div>

          {/* Évolution mensuelle */}
          {report.monthly.length > 0 && (
            <Card className="shadow-luxe card-luxe">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Évolution mensuelle du chiffre d&apos;affaires</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-end gap-2 overflow-x-auto pb-1 sm:gap-3">
                  {report.monthly.map((m) => (
                    <VBar
                      key={m.monthKey}
                      label={`${pad(Number(m.monthKey.slice(5)))}/${m.monthKey.slice(2, 4)}`}
                      title={`${m.label} : ${formatMoney(m.total)}`}
                      value={m.total}
                      max={maxMonthly}
                      display={formatMoneyCompact(m.total)}
                      tone="violet"
                    />
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Top clients + Catégories */}
          <div className="grid gap-3 lg:grid-cols-2">
            <Card className="shadow-luxe">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Top clients</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {report.topClients.map((c) => (
                  <HBar
                    key={c.name}
                    label={`${c.name} (${c.count})`}
                    value={c.total}
                    max={maxClient}
                    display={formatMoneyCompact(c.total)}
                    tone="violet"
                  />
                ))}
              </CardContent>
            </Card>
            <Card className="shadow-luxe">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Ventes par catégorie</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {report.byCategory.slice(0, 8).map((c) => (
                  <HBar
                    key={c.category}
                    label={c.label}
                    value={c.total}
                    max={maxCategory}
                    display={formatMoneyCompact(c.total)}
                    tone="amber"
                  />
                ))}
              </CardContent>
            </Card>
          </div>

          {/* Top produits */}
          {report.topProducts.length > 0 && (
            <Card className="shadow-luxe">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Package className="h-4 w-4 text-primary" aria-hidden />
                  Top produits
                </CardTitle>
              </CardHeader>
              <CardContent className="max-h-96 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Produit</TableHead>
                      <TableHead className="text-center">Quantité</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {report.topProducts.map((p) => (
                      <TableRow key={p.name}>
                        <TableCell className="font-medium">{p.name}</TableCell>
                        <TableCell className="text-center tabular-nums">{p.quantity}</TableCell>
                        <TableCell className="text-right font-bold tabular-nums">{formatMoney(p.total)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* Détail des factures */}
          <Card className="shadow-luxe">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center justify-between gap-2 text-base">
                <span>Détail des factures ({summary.count})</span>
                <Button variant="outline" size="sm" onClick={() => handleReportPDF("open")}>
                  <FileText className="h-4 w-4" />
                  <span className="hidden sm:inline">Aperçu du rapport</span>
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="max-h-96 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>N°</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Paiement</TableHead>
                    <TableHead>Livraison</TableHead>
                    <TableHead className="text-right">Total TTC</TableHead>
                    <TableHead className="text-right">PDF</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.invoices.map((f) => (
                    <TableRow key={f.id}>
                      <TableCell className="font-semibold">{f.number}</TableCell>
                      <TableCell className="whitespace-nowrap tabular-nums">{formatDate(f.date)}</TableCell>
                      <TableCell className="max-w-40 truncate" title={f.clientName}>
                        {f.clientName || "Client comptoir"}
                      </TableCell>
                      <TableCell>
                        <PaymentBadge status={f.paymentStatus} />
                      </TableCell>
                      <TableCell>
                        <DeliveryBadge status={f.deliveryStatus} />
                      </TableCell>
                      <TableCell className="text-right font-bold tabular-nums">{formatMoney(f.totalTTC)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleInvoicePDF(f.number, "download")}
                            aria-label={`Télécharger le PDF de ${f.number}`}
                            title="Télécharger"
                          >
                            <FileDown className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleInvoicePDF(f.number, "open")}
                            aria-label={`Afficher le PDF de ${f.number}`}
                            title="Afficher"
                          >
                            <FileText className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
