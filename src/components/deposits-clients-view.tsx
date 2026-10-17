"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  CalendarDays,
  Download,
  Loader2,
  Minus,
  Plus,
  Scale,
  Trash2,
  Wallet,
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
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useFetch } from "@/hooks/use-fetch";
import { authFetch } from "@/lib/auth-client";
import { formatDate, formatMoney, PAYMENT_METHOD_LABELS } from "@/lib/constants";
import type { ClientDeposit, ClientWithdrawal } from "@/lib/types";

const PAYMENT_METHODS = Object.keys(PAYMENT_METHOD_LABELS);

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

/* ─── Formulaire de nouveau dépôt ────────────────────────────────────────── */

function NewDepositForm({ onCreated }: { onCreated: () => void }) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("ESPECES");
  const [date, setDate] = useState(todayISO());

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const n = Number(amount);
    if (!firstName.trim() || !lastName.trim()) {
      toast({ title: "Prénom et nom requis", variant: "destructive" });
      return;
    }
    if (!Number.isFinite(n) || n <= 0) {
      toast({ title: "Montant invalide", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const res = await authFetch("/api/client-deposits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          phone: phone.trim(),
          amount: n,
          method,
          date,
        }),
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error ?? "Erreur");
      }
      toast({ title: "Dépôt enregistré" });
      setFirstName("");
      setLastName("");
      setPhone("");
      setAmount("");
      setMethod("ESPECES");
      setDate(todayISO());
      onCreated();
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
    <Card className="border-green-600/20">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Plus className="h-4 w-4 text-green-600" />
          Nouveau dépôt
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="dep-firstName">Prénom</Label>
            <Input
              id="dep-firstName"
              placeholder="Moussa"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="dep-lastName">Nom</Label>
            <Input
              id="dep-lastName"
              placeholder="Diop"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="dep-phone">Téléphone</Label>
            <Input
              id="dep-phone"
              placeholder="77 000 00 00"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="dep-date">Date</Label>
            <Input
              id="dep-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="dep-amount">Somme (FCFA)</Label>
            <Input
              id="dep-amount"
              type="number"
              min={1}
              step={1}
              placeholder="250 000"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="dep-method">Mode de paiement</Label>
            <Select value={method} onValueChange={setMethod}>
              <SelectTrigger id="dep-method">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_METHODS.map((m) => (
                  <SelectItem key={m} value={m}>
                    {PAYMENT_METHOD_LABELS[m]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="sm:col-span-2 lg:col-span-3 flex justify-end pt-1">
            <Button
              type="submit"
              disabled={saving || !firstName.trim() || !lastName.trim() || !amount}
              className="min-w-40 bg-green-600 hover:bg-green-700"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <Wallet className="h-4 w-4" aria-hidden />
              )}
              Enregistrer le dépôt
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

/* ─── Formulaire d'ajout de retrait ──────────────────────────────────────── */

function AddWithdrawalForm({
  depositId,
  maxAmount,
  onDone,
}: {
  depositId: string;
  maxAmount: number;
  onDone: () => void;
}) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayISO());
  const [note, setNote] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const n = Number(amount);
    if (!Number.isFinite(n) || n <= 0) {
      toast({ title: "Montant invalide", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const res = await authFetch(`/api/client-deposits/${depositId}/withdrawals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: n, date, note: note.trim() }),
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error ?? "Erreur");
      }
      toast({ title: "Retrait enregistré" });
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
    <form onSubmit={submit} className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-end">
      <div className="space-y-1.5">
        <Label className="text-xs">Date</Label>
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required className="h-8 text-sm" />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Montant retiré</Label>
        <Input
          type="number"
          min={1}
          max={Math.round(maxAmount)}
          step={1}
          placeholder={`max ${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(maxAmount)}`}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          required
          className="h-8 text-sm"
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Note</Label>
        <div className="flex gap-1.5">
          <Input
            placeholder="Motif du retrait"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="h-8 text-sm"
          />
          <Button
            type="submit"
            size="sm"
            disabled={saving || !amount}
            className="h-8 bg-amber-600 hover:bg-amber-700 shrink-0"
          >
            {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Minus className="h-3 w-3" />}
          </Button>
        </div>
      </div>
    </form>
  );
}

/* ─── Carte d'un dépôt ────────────────────────────────────────────────────── */

function DepositCard({
  deposit,
  onRefresh,
}: {
  deposit: ClientDeposit;
  onRefresh: () => void;
}) {
  const { toast } = useToast();
  const [showWithdrawals, setShowWithdrawals] = useState(true);
  const status = getDepositStatus(deposit);
  const remaining = getRemaining(deposit);
  const totalWithdrawn = deposit.withdrawals
    ? deposit.withdrawals.reduce((sum, w) => sum + w.amount, 0)
    : 0;

  const handleDelete = async () => {
    if (!confirm("Supprimer ce dépôt et tous ses retraits ?")) return;
    try {
      const res = await authFetch(`/api/client-deposits/${deposit.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Erreur");
      toast({ title: "Dépôt supprimé" });
      onRefresh();
    } catch {
      toast({ title: "Erreur de suppression", variant: "destructive" });
    }
  };

  const statusBadge =
    status === "SOLDE" ? (
      <Badge className="bg-green-600 text-white hover:bg-green-700">Soldé</Badge>
    ) : status === "RETRAIT_PARTIEL" ? (
      <Badge className="bg-amber-500 text-white hover:bg-amber-600">Retrait partiel</Badge>
    ) : (
      <Badge variant="outline" className="border-muted-foreground/30 text-muted-foreground">
        Non retiré
      </Badge>
    );

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4 space-y-3">
        {/* En-tête du dépôt */}
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-green-600/10 text-green-600">
              <ArrowDownToLine className="h-4 w-4" />
            </div>
            <div>
              <p className="font-semibold text-sm">
                {deposit.firstName} {deposit.lastName}
              </p>
              <p className="text-xs text-muted-foreground">
                {deposit.phone && <span>{deposit.phone} · </span>}
                {formatDate(deposit.date)} · {PAYMENT_METHOD_LABELS[deposit.method] ?? deposit.method} · déposé{" "}
                <span className="font-medium text-foreground">{formatMoney(deposit.amount)}</span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {statusBadge}
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-destructive"
              onClick={handleDelete}
              aria-label="Supprimer"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* Solde restant */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-amber-600">{formatMoney(remaining)}</span>
          {status !== "SOLDE" && (
            <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-amber-500 rounded-full transition-all"
                style={{ width: `${Math.min(100, (totalWithdrawn / deposit.amount) * 100)}%` }}
              />
            </div>
          )}
        </div>

        {/* Section retraits */}
        <div>
          <button
            type="button"
            onClick={() => setShowWithdrawals(!showWithdrawals)}
            className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowUpFromLine className="h-3 w-3" />
            Retraits
            <span className="text-[10px] font-normal">
              ({deposit.withdrawals?.length ?? 0})
            </span>
          </button>

          {showWithdrawals && (
            <div className="mt-2 space-y-2">
              {/* Liste des retraits existants */}
              {deposit.withdrawals && deposit.withdrawals.length > 0 ? (
                <div className="space-y-1">
                  {deposit.withdrawals.map((w) => (
                    <div
                      key={w.id}
                      className="flex items-center justify-between gap-2 rounded-md bg-muted/50 px-3 py-1.5 text-xs"
                    >
                      <span className="text-muted-foreground">{formatDate(w.date)}</span>
                      <span className="font-semibold text-amber-600">{formatMoney(w.amount)}</span>
                      <span className="text-muted-foreground truncate max-w-32">
                        {w.note || "—"}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground italic">Aucun retrait</p>
              )}

              {/* Formulaire d'ajout de retrait */}
              {status !== "SOLDE" && (
                <div className="pt-1">
                  <AddWithdrawalForm
                    depositId={deposit.id}
                    maxAmount={remaining}
                    onDone={onRefresh}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/* ─── Vue principale ──────────────────────────────────────────────────────── */

export function DepositsClientsView() {
  const [year, setYear] = useState(new Date().getFullYear().toString());
  const [filter, setFilter] = useState<"ALL" | "SOLDE" | "PARTIEL" | "NON_RETIREE">("ALL");

  const { data: deposits, loading, error, refetch } = useFetch<ClientDeposit[]>(
    `/api/client-deposits?year=${year}`
  );

  // Calculer les statistiques
  const stats = useMemo(() => {
    if (!deposits) return { totalDeposed: 0, totalWithdrawn: 0, balance: 0 };
    let totalDeposed = 0;
    let totalWithdrawn = 0;
    for (const d of deposits) {
      totalDeposed += d.amount;
      if (d.withdrawals) {
        for (const w of d.withdrawals) {
          totalWithdrawn += w.amount;
        }
      }
    }
    return {
      totalDeposed,
      totalWithdrawn,
      balance: totalDeposed - totalWithdrawn,
    };
  }, [deposits]);

  // Filtrer les dépôts
  const filtered = useMemo(() => {
    if (!deposits) return [];
    if (filter === "ALL") return deposits;
    return deposits.filter((d) => {
      const status = getDepositStatus(d);
      if (filter === "SOLDE") return status === "SOLDE";
      if (filter === "PARTIEL") return status === "RETRAIT_PARTIEL";
      if (filter === "NON_RETIREE") return status === "NON_RETIREE";
      return true;
    });
  }, [deposits, filter]);

  // Export Excel
  const exportExcel = async () => {
    try {
      const XLSX = await import("xlsx");
      const rows = (filtered || []).map((d) => {
        const totalW = d.withdrawals?.reduce((s, w) => s + w.amount, 0) ?? 0;
        return {
          Prénom: d.firstName,
          Nom: d.lastName,
          Téléphone: d.phone || "",
          "Date dépôt": formatDate(d.date),
          "Montant déposé": d.amount,
          "Mode paiement": PAYMENT_METHOD_LABELS[d.method] ?? d.method,
          "Total retiré": totalW,
          "Solde restant": d.amount - totalW,
          Statut:
            getDepositStatus(d) === "SOLDE"
              ? "Soldé"
              : getDepositStatus(d) === "RETRAIT_PARTIEL"
              ? "Retrait partiel"
              : "Non retirée",
        };
      });
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Dépôts clients");
      XLSX.writeFile(wb, `depots-clients-${year}.xlsx`);
    } catch {
      /* silencieux */
    }
  };

  // Années disponibles
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => String(currentYear - i));

  return (
    <div className="space-y-5">
      {/* Titre */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <Wallet className="h-5 w-5 text-green-600" aria-hidden />
            Dépôts clients — {year}
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

      {/* Statistiques */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card className="bg-green-600/5 border-green-600/20">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-600/10 text-green-600">
              <ArrowDownToLine className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">Total déposé</p>
              <p className="text-lg font-bold text-green-600">{formatMoney(stats.totalDeposed)}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-amber-500/5 border-amber-500/20">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500">
              <ArrowUpFromLine className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">Total retiré</p>
              <p className="text-lg font-bold text-amber-600">{formatMoney(stats.totalWithdrawn)}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-emerald-600/5 border-emerald-600/20">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600/10 text-emerald-600">
              <Scale className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">Solde à rendre aux clients</p>
              <p className="text-lg font-bold text-emerald-600">{formatMoney(stats.balance)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Formulaire nouveau dépôt */}
      <NewDepositForm onCreated={refetch} />

      {/* Filtres + export */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          {(["ALL", "NON_RETIREE", "PARTIEL", "SOLDE"] as const).map((f) => {
            const label =
              f === "ALL"
                ? "Tous"
                : f === "SOLDE"
                ? "Soldés"
                : f === "PARTIEL"
                ? "Retrait partiel"
                : "Non retirés";
            return (
              <Button
                key={f}
                variant={filter === f ? "default" : "outline"}
                size="sm"
                onClick={() => setFilter(f)}
                className={filter === f ? "bg-green-600 hover:bg-green-700" : ""}
              >
                {label}
              </Button>
            );
          })}
        </div>
        <Button variant="outline" size="sm" onClick={exportExcel} disabled={!filtered?.length}>
          <Download className="h-4 w-4 mr-1.5" />
          Exporter Excel
        </Button>
      </div>

      {/* Liste des dépôts */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}
      {error && (
        <p className="text-center text-destructive py-8">{error}</p>
      )}
      {!loading && !error && filtered?.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <Wallet className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p>Aucun dépôt client pour {year}</p>
        </div>
      )}
      {!loading && !error && filtered && filtered.length > 0 && (
        <div className="space-y-3">
          {filtered.map((d) => (
            <DepositCard key={d.id} deposit={d} onRefresh={refetch} />
          ))}
        </div>
      )}
    </div>
  );
}
