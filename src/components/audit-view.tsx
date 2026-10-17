"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { History, Loader2, RefreshCw, Search, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { authFetch } from "@/lib/auth-client";
import { AUDIT_ACTION_LABELS, AUDIT_ENTITY_LABELS } from "@/lib/constants";
import type { AuditLogEntry } from "@/lib/types";

type ActionFilter = "all" | "CREATE" | "UPDATE" | "DELETE";

const ACTION_FILTERS: { id: ActionFilter; label: string }[] = [
  { id: "all", label: "Tous" },
  { id: "CREATE", label: "Création" },
  { id: "UPDATE", label: "Modification" },
  { id: "DELETE", label: "Suppression" },
];

const ACTION_BADGE: Record<string, string> = {
  CREATE: "bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border-emerald-200",
  UPDATE: "bg-amber-100 text-amber-800 hover:bg-amber-100 border-amber-200",
  DELETE: "bg-red-100 text-red-700 hover:bg-red-100 border-red-200",
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

export function AuditView() {
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [action, setAction] = useState<ActionFilter>("all");
  const [q, setQ] = useState("");

  // L'audit exige le rôle ADMIN : authFetch ajoute le jeton Authorization
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch("/api/audit?take=200");
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error ?? "Impossible de charger le journal d'audit");
      setEntries(Array.isArray(json) ? (json as AuditLogEntry[]) : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return entries.filter((entry) => {
      if (action !== "all" && entry.action !== action) return false;
      if (!needle) return true;
      const haystack = [
        entry.userName ?? "",
        AUDIT_ENTITY_LABELS[entry.entity] ?? entry.entity,
        entry.details ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(needle);
    });
  }, [entries, action, q]);

  return (
    <div className="space-y-4">
      {/* En-tête */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold">Journal d&apos;audit</h2>
          <p className="text-sm text-muted-foreground">
            Traçabilité des créations, modifications et suppressions (200 dernières entrées).
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={load} disabled={loading} className="min-h-11 sm:min-h-0">
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          Actualiser
        </Button>
      </div>

      {/* Filtres */}
      <Card>
        <CardContent className="p-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filtrer par action">
            {ACTION_FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setAction(f.id)}
                className={cn(
                  "rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors",
                  action === f.id
                    ? "border-transparent bg-primary text-primary-foreground shadow-md"
                    : "border-border text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
                aria-pressed={action === f.id}
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
                placeholder="Utilisateur, entité, détails…"
                className="pl-8"
                aria-label="Rechercher dans le journal d'audit"
              />
            </div>
            <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
              {filtered.length} entrée{filtered.length > 1 ? "s" : ""}
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
            <div className="flex flex-col items-center gap-3 p-10 text-center">
              <ShieldAlert className="h-10 w-10 text-destructive/60" aria-hidden />
              <p className="text-sm text-destructive">{error}</p>
              <Button size="sm" variant="outline" onClick={load}>
                Réessayer
              </Button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-2 p-10 text-center">
              <History className="h-10 w-10 text-muted-foreground/50" aria-hidden />
              <p className="text-sm text-muted-foreground">
                {entries.length > 0
                  ? "Aucune entrée ne correspond aux filtres."
                  : "Aucune activité enregistrée pour le moment."}
              </p>
            </div>
          ) : (
            <div className="max-h-96 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Utilisateur</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Entité</TableHead>
                    <TableHead>Détails</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((entry) => {
                    const dt = formatDateTime(entry.createdAt);
                    return (
                      <TableRow key={entry.id}>
                        <TableCell className="whitespace-nowrap">
                          <div className="text-sm">{dt?.date ?? "—"}</div>
                          {dt?.time && (
                            <div className="text-xs text-muted-foreground tabular-nums">{dt.time}</div>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className="text-sm font-medium">{entry.userName ?? "—"}</span>
                        </TableCell>
                        <TableCell>
                          <Badge className={cn("font-semibold", ACTION_BADGE[entry.action])}>
                            {AUDIT_ACTION_LABELS[entry.action] ?? entry.action}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">{AUDIT_ENTITY_LABELS[entry.entity] ?? entry.entity}</div>
                          {entry.entityId && (
                            <div className="text-xs text-muted-foreground max-w-28 truncate" title={entry.entityId}>
                              {entry.entityId}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          {entry.details ? (
                            <span
                              className="block max-w-64 truncate text-sm text-muted-foreground"
                              title={entry.details}
                            >
                              {entry.details}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
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
