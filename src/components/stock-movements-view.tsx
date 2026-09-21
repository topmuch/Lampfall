"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeftRight, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { useFetch } from "@/hooks/use-fetch";
import { MOVEMENT_TYPE_LABELS } from "@/lib/constants";
import type { StockMovement } from "@/lib/types";

type TypeFilter = "all" | "ENTREE" | "SORTIE" | "AJUSTEMENT";

const TYPE_FILTERS: { id: TypeFilter; label: string }[] = [
  { id: "all", label: "Tous" },
  { id: "ENTREE", label: "Entrées" },
  { id: "SORTIE", label: "Sorties" },
  { id: "AJUSTEMENT", label: "Ajustements" },
];

const REF_LABELS: Record<string, string> = {
  ACHAT: "Achat",
  VENTE: "Vente",
  MANUEL: "Manuel",
  INITIAL: "Initial",
};

const TYPE_BADGE: Record<string, string> = {
  ENTREE: "bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border-emerald-200",
  SORTIE: "bg-red-100 text-red-700 hover:bg-red-100 border-red-200",
  AJUSTEMENT: "bg-amber-100 text-amber-800 hover:bg-amber-100 border-amber-200",
};

function formatDateTime(value: string | Date | null | undefined) {
  if (!value) return null;
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return null;
  return {
    date: new Intl.DateTimeFormat("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(d),
    time: new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" }).format(d),
  };
}

function quantityLabel(m: StockMovement): string {
  if (m.type === "ENTREE") return `+${Math.abs(m.quantity)}`;
  if (m.type === "SORTIE") return `-${Math.abs(m.quantity)}`;
  return m.quantity > 0 ? `+${m.quantity}` : `${m.quantity}`;
}

export function StockMovementsView() {
  const [type, setType] = useState<TypeFilter>("all");
  const [q, setQ] = useState("");

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (type !== "all") params.set("type", type);
    params.set("take", "200");
    return params.toString();
  }, [type]);

  const { data: movements, loading, error, refetch } = useFetch<StockMovement[]>(
    `/api/stock-movements?${query}`
  );

  const filtered = useMemo(() => {
    const list = movements ?? [];
    const needle = q.trim().toLowerCase();
    if (!needle) return list;
    return list.filter((m) => (m.productName ?? "").toLowerCase().includes(needle));
  }, [movements, q]);

  return (
    <div className="space-y-4">
      {/* En-tête */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold">Mouvements de stock</h2>
          <p className="text-sm text-muted-foreground">
            Journal des entrées, sorties et ajustements d&apos;inventaire (200 derniers).
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

      {/* Filtres */}
      <Card>
        <CardContent className="p-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filtrer par type">
            {TYPE_FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setType(f.id)}
                className={cn(
                  "rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors",
                  type === f.id
                    ? "border-transparent bg-primary text-primary-foreground shadow-md"
                    : "border-border text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
                aria-pressed={type === f.id}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <div className="relative flex-1 lg:w-64">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Rechercher un produit…"
                className="pl-8"
                aria-label="Rechercher un produit dans les mouvements"
              />
            </div>
            <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
              {filtered.length} mouvement{filtered.length > 1 ? "s" : ""}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Journal */}
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
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-2 p-10 text-center">
              <ArrowLeftRight className="h-10 w-10 text-muted-foreground/50" aria-hidden />
              <p className="text-sm text-muted-foreground">
                {movements && movements.length > 0
                  ? "Aucun mouvement ne correspond aux filtres."
                  : "Aucun mouvement de stock enregistré."}
              </p>
            </div>
          ) : (
            <div className="max-h-96 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Produit</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Quantité</TableHead>
                    <TableHead className="text-right">Avant → Après</TableHead>
                    <TableHead>Motif</TableHead>
                    <TableHead>Réf.</TableHead>
                    <TableHead>Utilisateur</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((m) => {
                    const dt = formatDateTime(m.createdAt);
                    return (
                      <TableRow key={m.id}>
                        <TableCell className="whitespace-nowrap">
                          <div className="text-sm">{dt?.date ?? "—"}</div>
                          {dt?.time && (
                            <div className="text-xs text-muted-foreground tabular-nums">{dt.time}</div>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className="block max-w-44 truncate text-sm font-medium" title={m.productName ?? undefined}>
                            {m.productName ?? "—"}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge className={cn("font-semibold", TYPE_BADGE[m.type])}>
                            {MOVEMENT_TYPE_LABELS[m.type] ?? m.type}
                          </Badge>
                        </TableCell>
                        <TableCell
                          className={cn(
                            "text-right font-semibold tabular-nums",
                            m.type === "ENTREE" && "text-emerald-600",
                            m.type === "SORTIE" && "text-red-600"
                          )}
                        >
                          {quantityLabel(m)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums whitespace-nowrap">
                          {m.stockBefore} → {m.stockAfter}
                        </TableCell>
                        <TableCell>
                          {m.reason ? (
                            <span className="block max-w-40 truncate text-sm text-muted-foreground" title={m.reason}>
                              {m.reason}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className="text-xs text-muted-foreground">
                            {m.refType ? (REF_LABELS[m.refType] ?? m.refType) : "—"}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground">{m.userName ?? "—"}</span>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
