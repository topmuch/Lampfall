"use client";

import { useMemo, useState } from "react";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  CalendarDays,
  Download,
  Loader2,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useFetch } from "@/hooks/use-fetch";
import { authFetch } from "@/lib/auth-client";
import { formatDate, formatMoney, PAYMENT_METHOD_LABELS } from "@/lib/constants";
import type { ClientDeposit, ClientWithdrawal } from "@/lib/types";

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getDepositStatus(
  deposit: ClientDeposit
): "SOLDE" | "RETRAIT_PARTIEL" | "NON_RETIREE" {
  if (!deposit.withdrawals || deposit.withdrawals.length === 0) return "NON_RETIREE";
  const totalWithdrawn = deposit.withdrawals.reduce((sum, w) => sum + w.amount, 0);
  if (totalWithdrawn >= deposit.amount - 0.009) return "SOLDE";
  return "RETRAIT_PARTIEL";
}

function getRemaining(deposit: ClientDeposit): number {
  if (!deposit.withdrawals) return deposit.amount;
  const totalWithdrawn = deposit.withdrawals.reduce((sum, w) => sum + w.amount, 0);
  return Math.max(0, deposit.amount - totalWithdrawn);
}

/* ─── Formulaire de nouveau retrait ──────────────────────────────────────── */

function WithdrawalDepositPicker({
  deposits,
  onDone,
}: {
  deposits: ClientDeposit[];
  onDone: () => void;
}) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [selectedId, setSelectedId] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayISO());
  const [note, setNote] = useState("");

  const eligible = deposits.filter((d) => getDepositStatus(d) !== "SOLDE");
  const selectedDeposit = deposits.find((d) => d.id === selectedId);
  const maxAmount = selectedDeposit ? getRemaining(selectedDeposit) : 0;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedId) {
      toast({ title: "Sélectionnez un dépôt", variant: "destructive" });
      return;
    }
    const n = Number(amount);
    if (!Number.isFinite(n) || n <= 0) {
      toast({ title: "Montant invalide", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const res = await authFetch(`/api/client-deposits/${selectedId}/withdrawals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: n, date, note: note.trim() }),
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error ?? "Erreur");
      }
      toast({ title: "Retrait enregistré" });
      setSelectedId("");
      setAmount("");
      setNote("");
      setDate(todayISO());
      onDone();
    } catch (err) {
      toast({
        title: "Erreur",
        description: err instanceof Error ? err.message : "Erreur inconnue",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="border-amber-500/30 shadow-sm">
      <CardHeader className="pb-3 bg-amber-500/5 rounded-t-lg">
        <CardTitle className="flex items-center gap-2 text-base font-bold text-amber-700">
          <ArrowUpFromLine className="h-4 w-4" />
          Nouveau retrait
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4">
        <form onSubmit={submit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="w-deposit">Dépôt (client)</Label>
            <Select value={selectedId} onValueChange={setSelectedId}>
              <SelectTrigger id="w-deposit">
                <SelectValue placeholder="Choisir un dépôt…" />
              </SelectTrigger>
              <SelectContent>
                {eligible.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.firstName} {d.lastName} — {formatMoney(getRemaining(d))} restant
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="w-date">Date</Label>
            <Input
              id="w-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="w-amount">Montant retiré (FCFA)</Label>
            <Input
              id="w-amount"
              type="number"
              min={1}
              max={maxAmount ? Math.round(maxAmount) : undefined}
              step={1}
              placeholder={maxAmount ? `max ${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(maxAmount)}` : "—"}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
              disabled={!selectedId}
            />
          </div>
          <div className="sm:col-span-2 lg:col-span-3 space-y-1.5">
            <Label htmlFor="w-note">Note</Label>
            <Input
              id="w-note"
              placeholder="Motif du retrait"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
          <div className="sm:col-span-2 lg:col-span-3 flex justify-end pt-1">
            <Button
              type="submit"
              disabled={saving || !selectedId || !amount}
              className="min-w-40 bg-amber-600 hover:bg-amber-700 text-white font-bold"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <ArrowUpFromLine className="h-4 w-4" aria-hidden />
              )}
              Enregistrer le retrait
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

/* ─── Vue principale Retraits ────────────────────────────────────────────── */

export function RetraitsClientsView() {
  const [year, setYear] = useState(new Date().getFullYear().toString());
  const [search, setSearch] = useState("");

  const { data: deposits, loading, error, refetch } = useFetch<ClientDeposit[]>(
    `/api/client-deposits?year=${year}`
  );

  // Aplatir tous les retraits avec les infos du dépôt parent
  const allWithdrawals = useMemo(() => {
    const list: (ClientWithdrawal & {
      depositFirstName: string;
      depositLastName: string;
      depositPhone: string | null;
      depositMethod: string;
      depositAmount: number;
      depositDate: string;
    })[] = [];
    if (!deposits) return list;
    for (const d of deposits) {
      if (d.withdrawals) {
        for (const w of d.withdrawals) {
          list.push({
            ...w,
            depositFirstName: d.firstName,
            depositLastName: d.lastName,
            depositPhone: d.phone ?? null,
            depositMethod: d.method,
            depositAmount: d.amount,
            depositDate: d.date,
          });
        }
      }
    }
    // Trier par date décroissante
    list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return list;
  }, [deposits]);

  // Filtrer par recherche
  const filtered = useMemo(() => {
    if (!search.trim()) return allWithdrawals;
    const q = search.toLowerCase();
    return allWithdrawals.filter(
      (w) =>
        w.depositFirstName.toLowerCase().includes(q) ||
        w.depositLastName.toLowerCase().includes(q) ||
        (w.depositPhone && w.depositPhone.includes(q)) ||
        (w.note && w.note.toLowerCase().includes(q))
    );
  }, [allWithdrawals, search]);

  // Total retiré
  const totalWithdrawn = useMemo(() => {
    return filtered.reduce((sum, w) => sum + w.amount, 0);
  }, [filtered]);

  // Total déposé (pour info)
  const totalDeposed = useMemo(() => {
    if (!deposits) return 0;
    return deposits.reduce((sum, d) => sum + d.amount, 0);
  }, [deposits]);

  // Export Excel retraits
  const exportExcel = async () => {
    try {
      const XLSX = await import("xlsx");
      const rows = filtered.map((w) => ({
        "Prénom client": w.depositFirstName,
        "Nom client": w.depositLastName,
        Téléphone: w.depositPhone || "",
        "Date dépôt": formatDate(w.depositDate),
        "Montant déposé": w.depositAmount,
        "Mode dépôt": PAYMENT_METHOD_LABELS[w.depositMethod] ?? w.depositMethod,
        "Date retrait": formatDate(w.date),
        "Montant retiré": w.amount,
        Note: w.note || "",
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Retraits");
      XLSX.writeFile(wb, `retraits-clients-${year}.xlsx`);
    } catch {
      /* silencieux */
    }
  };

  // Années disponibles
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => String(currentYear - i));

  return (
    <div className="space-y-5">
      {/* Titre — Ambre/Orange bien visible */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight flex items-center gap-2 text-amber-700">
            <ArrowUpFromLine className="h-5 w-5" aria-hidden />
            RETRAITS CLIENTS — {year}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {new Intl.DateTimeFormat("fr-FR", {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
            }).format(new Date())}
          </p>
        </div>
        <Select value={year} onValueChange={setYear}>
          <SelectTrigger className="w-28">
            <CalendarDays className="h-4 w-4 mr-1.5 text-muted-foreground" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {years.map((y) => (
              <SelectItem key={y} value={y}>
                {y}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Stats rapides */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Card className="bg-amber-500/5 border-amber-500/20">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600">
              <ArrowUpFromLine className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-bold uppercase tracking-wide">Total retiré</p>
              <p className="text-lg font-extrabold text-amber-600">{formatMoney(totalWithdrawn)}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-green-600/5 border-green-600/20">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-600/10 text-green-600">
              <ArrowDownToLine className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-bold uppercase tracking-wide">Total déposé</p>
              <p className="text-lg font-extrabold text-green-600">{formatMoney(totalDeposed)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Formulaire nouveau retrait */}
      {!loading && !error && deposits && (
        <WithdrawalDepositPicker deposits={deposits} onDone={refetch} />
      )}

      {/* Recherche + export */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Chercher par nom, téléphone…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-9"
          />
        </div>
        <Button variant="outline" size="sm" onClick={exportExcel} disabled={!filtered.length}>
          <Download className="h-4 w-4 mr-1.5" />
          Exporter Excel
        </Button>
      </div>

      {/* Liste des retraits */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-amber-600" />
        </div>
      )}
      {error && (
        <p className="text-center text-destructive py-8">{error}</p>
      )}
      {!loading && !error && filtered.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <ArrowUpFromLine className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="font-semibold">
            {search ? "Aucun retrait trouvé" : `Aucun retrait pour ${year}`}
          </p>
        </div>
      )}
      {!loading && !error && filtered.length > 0 && (
        <div className="space-y-2">
          {filtered.map((w) => (
            <Card key={w.id} className="overflow-hidden border-amber-500/15">
              <CardContent className="p-3.5 flex flex-wrap items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 shrink-0">
                  <ArrowUpFromLine className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-sm text-amber-700">
                    {w.depositFirstName} {w.depositLastName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {w.depositPhone && <span>{w.depositPhone} · </span>}
                    Retrait du <span className="font-semibold">{formatDate(w.date)}</span>
                    {w.note && <span> · {w.note}</span>}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-base font-extrabold text-amber-600">{formatMoney(w.amount)}</p>
                  <p className="text-[10px] text-muted-foreground">
                    dépôt {formatMoney(w.depositAmount)} · {PAYMENT_METHOD_LABELS[w.depositMethod] ?? w.depositMethod}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* ─── Total retiré — en bas bien visible ───────────────────────────── */}
      <Separator className="my-2" />
      <div className="sticky bottom-0 bg-background/95 backdrop-blur-sm border-t-2 border-amber-500/30 rounded-xl px-4 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-600 text-white">
            <ArrowUpFromLine className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-bold text-amber-700 uppercase tracking-wide">Total retiré</p>
            <p className="text-[10px] text-muted-foreground">{filtered.length} retrait(s) · {year}</p>
          </div>
        </div>
        <p className="text-xl font-extrabold text-amber-600">{formatMoney(totalWithdrawn)}</p>
      </div>
    </div>
  );
}
