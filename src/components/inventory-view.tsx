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
import { useFetch, useDebouncedValue } from "@/hooks/use-fetch";
import { useCategories } from "@/components/categories-provider";
import { formatMoney } from "@/lib/constants";
import { cn } from "@/lib/utils";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Coins,
  Download,
  FileDown,
  ListTree,
  PackageSearch,
  Scale,
  Search,
  TrendingUp,
} from "lucide-react";
import type {
  InventoryCategoryRow,
  InventoryProductRow,
  InventoryResponse,
} from "@/lib/types";
import { generateInventoryPdf } from "@/lib/pdf-inventory";
import { companyInfoFromSettings, loadLogoAsDataUrl } from "@/lib/pdf-reports";
import { useSettingsStore } from "@/lib/settings-store";

// ─── Types & options ────────────────────────────────────────────────────────

type PeriodType = InventoryResponse["period"]["type"];
type GroupBy = "categorie" | "produit";

const PERIOD_OPTIONS: { id: PeriodType; label: string }[] = [
  { id: "semaine", label: "Semaine" },
  { id: "mensuel", label: "Mensuel" },
  { id: "trimestriel", label: "Trimestriel" },
  { id: "semestriel", label: "Semestriel" },
  { id: "annuel", label: "Annuel" },
];

const GROUP_OPTIONS: { id: GroupBy; label: string }[] = [
  { id: "categorie", label: "Par catégorie" },
  { id: "produit", label: "Par produit" },
];

// ─── Formatage ──────────────────────────────────────────────────────────────

function fmtQty(n: number): string {
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 }).format(n);
}

function signedQty(n: number): string {
  if (n > 0) return `+${fmtQty(n)}`;
  return fmtQty(n); // inclut le signe −
}

// ─── Export CSV ─────────────────────────────────────────────────────────────

function exportCsv(rows: InventoryProductRow[], period: InventoryResponse["period"]) {
  const header = [
    "Produit",
    "Référence",
    "Catégorie",
    "Stock initial",
    "Quantités achetées",
    "Quantités vendues",
    "Retours / Ajustements",
    "Stock final",
    "Prix d'achat",
    "Prix de vente",
    "Valeur stock (achat)",
    "CA ventes",
    "Marge",
  ];
  const lines = rows.map((r) =>
    [
      r.name,
      r.reference ?? "",
      r.categoryLabel,
      r.stockInitial,
      r.achats,
      r.ventes,
      r.retoursAjustements,
      r.stockFinal,
      r.purchasePrice,
      r.salePrice,
      r.valeurStockAchat,
      r.ventesValeur,
      r.marge,
    ]
      .map((v) => {
        const s = String(v).replace(/"/g, '""');
        return /[";\n]/.test(s) ? `"${s}"` : s;
      })
      .join(";")
  );
  const csv = `\uFEFF${header.join(";")}\n${lines.join("\n")}`;
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `inventaire-${period.type}-${period.startLabel.replace(/\//g, "-")}_${period.endLabel.replace(/\//g, "-")}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─── Vue Inventaire ─────────────────────────────────────────────────────────

export function InventoryView() {
  const [period, setPeriod] = useState<PeriodType>("mensuel");
  const [offset, setOffset] = useState(0);
  const [groupBy, setGroupBy] = useState<GroupBy>("categorie");
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("all");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [pdfLoading, setPdfLoading] = useState(false);
  const debouncedQ = useDebouncedValue(q);
  const { categories } = useCategories();
  const settings = useSettingsStore((s) => s.settings);

  const query = useMemo(() => {
    const params = new URLSearchParams();
    params.set("period", period);
    params.set("offset", String(offset));
    return params.toString();
  }, [period, offset]);

  const { data, loading, error, refetch } = useFetch<InventoryResponse>(
    `/api/inventory?${query}`
  );

  // Filtres texte + catégorie appliqués aux produits
  const matchProduct = useMemo(() => {
    const needle = debouncedQ.trim().toLowerCase();
    return (r: InventoryProductRow) => {
      if (category !== "all" && r.category !== category) return false;
      if (!needle) return true;
      return (
        r.name.toLowerCase().includes(needle) ||
        (r.reference ?? "").toLowerCase().includes(needle)
      );
    };
  }, [debouncedQ, category]);

  const filteredProducts = useMemo(
    () => (data?.products ?? []).filter(matchProduct),
    [data, matchProduct]
  );

  const filteredCategories = useMemo<InventoryCategoryRow[]>(() => {
    const all = data?.categories ?? [];
    return all
      .map((c) => ({ ...c, products: c.products.filter(matchProduct) }))
      .filter((c) => c.products.length > 0)
      .map((c) => {
        const sum = (fn: (r: InventoryProductRow) => number) =>
          c.products.reduce((acc, r) => acc + fn(r), 0);
        return {
          ...c,
          productCount: c.products.length,
          stockInitial: sum((r) => r.stockInitial),
          achats: sum((r) => r.achats),
          ventes: sum((r) => r.ventes),
          retoursAjustements: sum((r) => r.retoursAjustements),
          stockFinal: sum((r) => r.stockFinal),
          valeurStockAchat: sum((r) => r.valeurStockAchat),
          valeurStockVente: sum((r) => r.valeurStockVente),
          ventesValeur: sum((r) => r.ventesValeur),
          marge: sum((r) => r.marge),
        };
      });
  }, [data, matchProduct]);

  const totals = useMemo(() => {
    return filteredProducts.reduce(
      (acc, r) => ({
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
  }, [filteredProducts]);

  const toggleExpanded = (code: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  };

  const selectPeriod = (p: PeriodType) => {
    setPeriod(p);
    setOffset(0);
  };

  /** Export PDF de l'inventaire courant (période + filtres actifs). */
  const handleExportPdf = async () => {
    if (!data) return;
    setPdfLoading(true);
    try {
      const logoDataUrl = await loadLogoAsDataUrl(settings?.logo);
      const filterParts = [
        category !== "all"
          ? `Catégorie : ${categories.find((c) => c.code === category)?.label ?? category}`
          : null,
        debouncedQ.trim() ? `Recherche : « ${debouncedQ.trim()} »` : null,
      ].filter(Boolean) as string[];
      generateInventoryPdf({
        variant: "inventaire",
        period: data.period,
        rows: filteredProducts,
        categories: filteredCategories,
        groupBy,
        totals,
        productCount: filteredProducts.length,
        filterLabel: filterParts.length > 0 ? filterParts.join("  ·  ") : null,
        logoDataUrl,
        companyInfo: companyInfoFromSettings(settings),
      });
    } finally {
      setPdfLoading(false);
    }
  };

  const periodLabel = data?.period.label ?? "…";
  const rangeLabel = data ? `${data.period.startLabel} — ${data.period.endLabel}` : "";
  const isCurrentPeriod = offset === 0;
  const hasData = loading ? false : error ? false : filteredProducts.length > 0;

  return (
    <div className="space-y-4">
      {/* En-tête */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold">Inventaire</h2>
          <p className="text-sm text-muted-foreground">
            Inventaire périodique — hebdomadaire, mensuel, trimestriel, semestriel ou
            annuel — par catégorie ou par produit.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleExportPdf}
            disabled={!hasData || pdfLoading}
            className="inline-flex items-center gap-1.5 self-start rounded-full border px-3.5 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
          >
            <FileDown className="h-3.5 w-3.5" aria-hidden />
            {pdfLoading ? "Génération…" : "Exporter PDF"}
          </button>
          <button
            type="button"
            onClick={() => {
              if (data) exportCsv(filteredProducts, data.period);
            }}
            disabled={!hasData}
            className="inline-flex items-center gap-1.5 self-start rounded-full border px-3.5 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Download className="h-3.5 w-3.5" aria-hidden />
            Exporter CSV
          </button>
          <button
            type="button"
            onClick={refetch}
            className="self-start rounded-full border px-3.5 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            Actualiser
          </button>
        </div>
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
              <p className="text-xs text-muted-foreground">Valeur stock final (vente)</p>
              <p className="text-base font-bold tabular-nums">{formatMoney(totals.valeurStockVente)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <TrendingUp className="h-5 w-5 text-emerald-600" />
            <div>
              <p className="text-xs text-muted-foreground">CA des ventes (période)</p>
              <p className="text-base font-bold tabular-nums">{formatMoney(totals.ventesValeur)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <ClipboardCheck className="h-5 w-5 text-amber-500" />
            <div>
              <p className="text-xs text-muted-foreground">Marge estimée</p>
              <p className="text-base font-bold tabular-nums">{formatMoney(totals.marge)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtres */}
      <Card>
        <CardContent className="p-4 flex flex-col gap-2 sm:flex-row">
          <div
            className="flex flex-wrap items-center gap-2 sm:border-r sm:border-border sm:pr-3"
            role="group"
            aria-label="Groupement"
          >
            {GROUP_OPTIONS.map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => setGroupBy(g.id)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors",
                  groupBy === g.id
                    ? "border-transparent bg-primary text-primary-foreground shadow-md"
                    : "border-border text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
                aria-pressed={groupBy === g.id}
              >
                {g.id === "categorie" ? (
                  <ListTree className="h-3.5 w-3.5" aria-hidden />
                ) : (
                  <ClipboardCheck className="h-3.5 w-3.5" aria-hidden />
                )}
                {g.label}
              </button>
            ))}
          </div>
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Rechercher par nom ou référence…"
              className="pl-8"
              aria-label="Rechercher un produit dans l'inventaire"
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

      {/* Tableau inventaire */}
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
          ) : groupBy === "categorie" ? (
            filteredCategories.length === 0 ? (
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
                      <TableHead>Catégorie / Produit</TableHead>
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
                    {filteredCategories.map((c) => (
                      <CategoryBlock
                        key={c.category}
                        category={c}
                        expanded={expanded.has(c.category)}
                        onToggle={() => toggleExpanded(c.category)}
                      />
                    ))}
                  </TableBody>
                  <TableFooter>
                    <TableRow>
                      <TableCell className="font-semibold">
                        Total général ({filteredProducts.length} produit
                        {filteredProducts.length > 1 ? "s" : ""})
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
            )
          ) : filteredProducts.length === 0 ? (
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
                  {filteredProducts.map((r) => (
                    <ProductRow key={r.productId} row={r} indented={false} />
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell colSpan={2} className="font-semibold">
                      Total général ({filteredProducts.length} produit
                      {filteredProducts.length > 1 ? "s" : ""})
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
        Calcul basé sur le journal des mouvements de stock : Stock final = Stock initial +
        Achats − Ventes + Retours &amp; ajustements. Les quantités sont en unités produit ;
        la « Valeur stock » est valorisée au prix d&apos;achat.
      </p>
    </div>
  );
}

// ─── Bloc catégorie dépliable ───────────────────────────────────────────────

function CategoryBlock({
  category,
  expanded,
  onToggle,
}: {
  category: InventoryCategoryRow;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <>
      <TableRow
        className="cursor-pointer bg-muted/40 hover:bg-muted/60"
        onClick={onToggle}
        aria-expanded={expanded}
      >
        <TableCell>
          <div className="flex items-center gap-2">
            <ChevronDown
              className={cn(
                "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                !expanded && "-rotate-90"
              )}
              aria-hidden
            />
            <span className="text-sm font-semibold">{category.label}</span>
            <span className="text-xs text-muted-foreground">
              ({category.productCount} produit{category.productCount > 1 ? "s" : ""})
            </span>
          </div>
        </TableCell>
        <TableCell className="text-right tabular-nums">{fmtQty(category.stockInitial)}</TableCell>
        <TableCell className="text-right tabular-nums text-emerald-600">
          {category.achats > 0 ? `+${fmtQty(category.achats)}` : "—"}
        </TableCell>
        <TableCell className="text-right tabular-nums text-red-600">
          {category.ventes > 0 ? `−${fmtQty(category.ventes)}` : "—"}
        </TableCell>
        <TableCell
          className={cn(
            "text-right tabular-nums",
            category.retoursAjustements > 0 && "text-amber-600",
            category.retoursAjustements < 0 && "text-red-600"
          )}
        >
          {category.retoursAjustements !== 0 ? signedQty(category.retoursAjustements) : "—"}
        </TableCell>
        <TableCell className="text-right font-semibold tabular-nums">
          {fmtQty(category.stockFinal)}
        </TableCell>
        <TableCell colSpan={2} className="text-center text-xs text-muted-foreground">
          {category.productCount} réf.
        </TableCell>
        <TableCell className="text-right font-semibold tabular-nums whitespace-nowrap">
          {formatMoney(category.valeurStockAchat)}
        </TableCell>
      </TableRow>
      {expanded && category.products.map((r) => (
        <ProductRow key={r.productId} row={r} indented />
      ))}
    </>
  );
}

// ─── Ligne produit ──────────────────────────────────────────────────────────

function ProductRow({ row, indented }: { row: InventoryProductRow; indented: boolean }) {
  const low = row.minStock > 0 && row.stockFinal <= row.minStock;
  return (
    <TableRow className={indented ? "bg-background" : undefined}>
      <TableCell className={indented ? "pl-8" : undefined}>
        <span
          className={cn(
            "block max-w-44 truncate text-sm font-medium",
            indented && "font-normal"
          )}
          title={row.name}
        >
          {row.name}
        </span>
        {row.reference && (
          <span className="text-xs text-muted-foreground">{row.reference}</span>
        )}
      </TableCell>
      {!indented && <TableCell className="text-sm text-muted-foreground">{row.categoryLabel}</TableCell>}
      <TableCell className="text-right tabular-nums">{fmtQty(row.stockInitial)}</TableCell>
      <TableCell className="text-right tabular-nums text-emerald-600">
        {row.achats > 0 ? `+${fmtQty(row.achats)}` : "—"}
      </TableCell>
      <TableCell className="text-right tabular-nums text-red-600">
        {row.ventes > 0 ? `−${fmtQty(row.ventes)}` : "—"}
      </TableCell>
      <TableCell
        className={cn(
          "text-right tabular-nums",
          row.retoursAjustements > 0 && "text-amber-600",
          row.retoursAjustements < 0 && "text-red-600"
        )}
      >
        {row.retoursAjustements !== 0 ? signedQty(row.retoursAjustements) : "—"}
      </TableCell>
      <TableCell
        className={cn(
          "text-right font-semibold tabular-nums",
          low && "text-red-600"
        )}
      >
        {fmtQty(row.stockFinal)}
        {low && <span className="ml-1 text-xs">(bas)</span>}
      </TableCell>
      <TableCell className="text-right tabular-nums whitespace-nowrap text-muted-foreground">
        {formatMoney(row.purchasePrice)}
      </TableCell>
      <TableCell className="text-right tabular-nums whitespace-nowrap text-muted-foreground">
        {formatMoney(row.salePrice)}
      </TableCell>
      <TableCell className="text-right font-medium tabular-nums whitespace-nowrap">
        {formatMoney(row.valeurStockAchat)}
      </TableCell>
    </TableRow>
  );
}
