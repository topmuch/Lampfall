"use client";

import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { CategoryBadge } from "@/components/status-badges";
import {
  Boxes,
  ChevronLeft,
  ChevronRight,
  Coins,
  PackageSearch,
  Scale,
  Search,
  TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useFetch, useDebouncedValue } from "@/hooks/use-fetch";
import { useCategories } from "@/components/categories-provider";
import { formatMoney } from "@/lib/constants";
import type { InventoryProductRow, InventoryResponse } from "@/lib/types";

// ─── Types de période ───────────────────────────────────────────────────────

type PeriodType = InventoryResponse["period"]["type"];

const PERIOD_OPTIONS: { id: PeriodType; label: string }[] = [
  { id: "semaine", label: "Semaine" },
  { id: "mensuel", label: "Mensuel" },
  { id: "trimestriel", label: "Trimestriel" },
  { id: "semestriel", label: "Semestriel" },
  { id: "annuel", label: "Annuel" },
];

// ─── Formatage ──────────────────────────────────────────────────────────────

function fmtQty(n: number): string {
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 }).format(n);
}

function signedQty(n: number): string {
  if (n > 0) return `+${fmtQty(n)}`;
  return fmtQty(n); // inclut le signe −
}

// ─── Vue État du stock ──────────────────────────────────────────────────────

export function StockView() {
  const [period, setPeriod] = useState<PeriodType>("mensuel");
  const [offset, setOffset] = useState(0);
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("all");
  const debouncedQ = useDebouncedValue(q);
  const { categories } = useCategories();

  const query = useMemo(() => {
    const params = new URLSearchParams();
    params.set("period", period);
    params.set("offset", String(offset));
    return params.toString();
  }, [period, offset]);

  const { data, loading, error, refetch } = useFetch<InventoryResponse>(
    `/api/inventory?${query}`
  );

  const rows = useMemo(() => {
    const list = data?.products ?? [];
    const needle = debouncedQ.trim().toLowerCase();
    return list.filter((r) => {
      if (category !== "all" && r.category !== category) return false;
      if (!needle) return true;
      return (
        r.name.toLowerCase().includes(needle) ||
        (r.reference ?? "").toLowerCase().includes(needle)
      );
    });
  }, [data, debouncedQ, category]);

  const totals = useMemo(() => {
    return rows.reduce(
      (acc, r: InventoryProductRow) => ({
        stockInitial: acc.stockInitial + r.stockInitial,
        achats: acc.achats + r.achats,
        ventes: acc.ventes + r.ventes,
        retoursAjustements: acc.retoursAjustements + r.retoursAjustements,
        stockFinal: acc.stockFinal + r.stockFinal,
        valeurStockAchat: acc.valeurStockAchat + r.valeurStockAchat,
        valeurStockVente: acc.valeurStockVente + r.valeurStockVente,
        ventesValeur: acc.ventesValeur + r.ventesValeur,
        marge: acc.marge + r.marge,
      }),
      {
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
  }, [rows]);

  const selectPeriod = (p: PeriodType) => {
    setPeriod(p);
    setOffset(0);
  };

  const periodLabel = data?.period.label ?? "…";
  const rangeLabel = data ? `${data.period.startLabel} — ${data.period.endLabel}` : "";
  const isCurrentPeriod = offset === 0;

  return (
    <div className="space-y-4">
      {/* En-tête */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold">État du stock</h2>
          <p className="text-sm text-muted-foreground">
            Stock initial, achats, ventes, retours &amp; ajustements et stock final par
            produit, valorisés aux prix d&apos;achat et de vente.
          </p>
        </div>
        <button
          type="button"
          onClick={refetch}
          className="self-start rounded-full border px-3.5 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          Actualiser
        </button>
      </div>

      {/* Sélection de période */}
      <Card>
        <CardContent className="p-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Type de période">
            {PERIOD_OPTIONS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => selectPeriod(p.id)}
                className={cn(
                  "rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors",
                  period === p.id
                    ? "border-transparent bg-primary text-primary-foreground shadow-md"
                    : "border-border text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
                aria-pressed={period === p.id}
              >
                {p.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setOffset((o) => o - 1)}
              className="rounded-full border p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="Période précédente"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="min-w-44 text-center">
              <p className="text-sm font-semibold leading-tight">{periodLabel}</p>
              <p className="text-xs text-muted-foreground tabular-nums">{rangeLabel}</p>
            </div>
            <button
              type="button"
              onClick={() => setOffset((o) => o + 1)}
              disabled={isCurrentPeriod}
              className="rounded-full border p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Période suivante"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            {!isCurrentPeriod && (
              <button
                type="button"
                onClick={() => setOffset(0)}
                className="rounded-full border px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                Aujourd&apos;hui
              </button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Statistiques */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Coins className="h-5 w-5 text-primary" />
            <div>
              <p className="text-xs text-muted-foreground">Valeur stock final (achat)</p>
              <p className="text-base font-bold tabular-nums">{formatMoney(totals.valeurStockAchat)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Scale className="h-5 w-5 text-emerald-600" />
            <div>
              <p className="text-xs text-muted-foreground">CA des ventes (période)</p>
              <p className="text-base font-bold tabular-nums">{formatMoney(totals.ventesValeur)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <TrendingUp className="h-5 w-5 text-emerald-600" />
            <div>
              <p className="text-xs text-muted-foreground">Marge estimée</p>
              <p className="text-base font-bold tabular-nums">{formatMoney(totals.marge)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Boxes className="h-5 w-5 text-amber-500" />
            <div>
              <p className="text-xs text-muted-foreground">Stock final (unités)</p>
              <p className="text-base font-bold tabular-nums">{fmtQty(totals.stockFinal)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtres */}
      <Card>
        <CardContent className="p-4 flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Rechercher par nom ou référence…"
              className="pl-8"
              aria-label="Rechercher un produit dans l'état du stock"
            />
          </div>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="w-full sm:w-56" aria-label="Filtrer par catégorie">
              <SelectValue placeholder="Toutes les catégories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes les catégories</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c.code} value={c.code}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Tableau */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4 space-y-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : error ? (
            <div className="p-10 text-center text-sm text-destructive">{error}</div>
          ) : rows.length === 0 ? (
            <div className="flex flex-col items-center gap-2 p-10 text-center">
              <PackageSearch className="h-10 w-10 text-muted-foreground/50" aria-hidden />
              <p className="text-sm text-muted-foreground">
                Aucun produit ne correspond aux filtres sur cette période.
              </p>
            </div>
          ) : (
            <div className="max-h-[32rem] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Produit</TableHead>
                    <TableHead>Catégorie</TableHead>
                    <TableHead className="text-right">Stock initial</TableHead>
                    <TableHead className="text-right">Achats</TableHead>
                    <TableHead className="text-right">Ventes</TableHead>
                    <TableHead className="text-right">Retours / Ajust.</TableHead>
                    <TableHead className="text-right">Stock final</TableHead>
                    <TableHead className="text-right">Prix d&apos;achat</TableHead>
                    <TableHead className="text-right">Prix de vente</TableHead>
                    <TableHead className="text-right">Valeur stock</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => {
                    const low = r.minStock > 0 && r.stockFinal <= r.minStock;
                    return (
                      <TableRow key={r.productId}>
                        <TableCell>
                          <span
                            className="block max-w-44 truncate text-sm font-medium"
                            title={r.name}
                          >
                            {r.name}
                          </span>
                          {r.reference && (
                            <span className="text-xs text-muted-foreground">{r.reference}</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <CategoryBadge category={r.category} />
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {fmtQty(r.stockInitial)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-emerald-600">
                          {r.achats > 0 ? `+${fmtQty(r.achats)}` : "—"}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-red-600">
                          {r.ventes > 0 ? `−${fmtQty(r.ventes)}` : "—"}
                        </TableCell>
                        <TableCell
                          className={cn(
                            "text-right tabular-nums",
                            r.retoursAjustements > 0 && "text-amber-600",
                            r.retoursAjustements < 0 && "text-red-600"
                          )}
                        >
                          {r.retoursAjustements !== 0 ? signedQty(r.retoursAjustements) : "—"}
                        </TableCell>
                        <TableCell
                          className={cn(
                            "text-right font-semibold tabular-nums",
                            low && "text-red-600"
                          )}
                        >
                          {fmtQty(r.stockFinal)}
                          {low && <span className="ml-1 text-xs">(bas)</span>}
                        </TableCell>
                        <TableCell className="text-right tabular-nums whitespace-nowrap text-muted-foreground">
                          {formatMoney(r.purchasePrice)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums whitespace-nowrap text-muted-foreground">
                          {formatMoney(r.salePrice)}
                        </TableCell>
                        <TableCell className="text-right font-medium tabular-nums whitespace-nowrap">
                          {formatMoney(r.valeurStockAchat)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell colSpan={2} className="font-semibold">
                      Total ({rows.length} produit{rows.length > 1 ? "s" : ""})
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">
                      {fmtQty(totals.stockInitial)}
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums text-emerald-600">
                      {totals.achats > 0 ? `+${fmtQty(totals.achats)}` : "—"}
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums text-red-600">
                      {totals.ventes > 0 ? `−${fmtQty(totals.ventes)}` : "—"}
                    </TableCell>
                    <TableCell
                      className={cn(
                        "text-right font-semibold tabular-nums",
                        totals.retoursAjustements > 0 && "text-amber-600",
                        totals.retoursAjustements < 0 && "text-red-600"
                      )}
                    >
                      {totals.retoursAjustements !== 0
                        ? signedQty(totals.retoursAjustements)
                        : "—"}
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">
                      {fmtQty(totals.stockFinal)}
                    </TableCell>
                    <TableCell colSpan={2} />
                    <TableCell className="text-right font-semibold tabular-nums whitespace-nowrap">
                      {formatMoney(totals.valeurStockAchat)}
                    </TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Note de calcul */}
      <p className="text-xs text-muted-foreground">
        Calcul basé sur le journal des mouvements de stock. Stock final = Stock initial +
        Achats − Ventes + Retours &amp; ajustements. La « Valeur stock » est valorisée au
        prix d&apos;achat ; au prix de vente, le stock final s&apos;élève à{" "}
        <span className="font-semibold tabular-nums">{formatMoney(totals.valeurStockVente)}</span>.
      </p>
    </div>
  );
}
