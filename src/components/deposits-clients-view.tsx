"use client";

import { useMemo, useState } from "react";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  CalendarDays,
  Download,
  FileText,
  Loader2,
  Minus,
  Plus,
  Search,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useFetch } from "@/hooks/use-fetch";
import { authFetch } from "@/lib/auth-client";
import { formatDate, formatMoney, PAYMENT_METHOD_LABELS, COMPANY } from "@/lib/constants";
import {
  generateDepositsPdf,
  generateDepositReceiptPdf,
  loadLogoAsDataUrl,
  getDefaultCompanyInfo,
  PERIOD_LABELS,
  type Period,
  type CompanyInfo,
} from "@/lib/pdf-reports";
import { useSettingsStore } from "@/lib/settings-store";
import type { ClientDeposit } from "@/lib/types";

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
    <Card className="border-green-600/30 shadow-sm">
      <CardHeader className="pb-3 bg-green-600/5 rounded-t-lg">
        <CardTitle className="flex items-center gap-2 text-base font-bold text-green-700">
          <Plus className="h-4 w-4" />
          Nouveau dépôt
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4">
        <form onSubmit={submit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="dep-firstName">Prénom</Label>
            <Input id="dep-firstName" placeholder="Moussa" value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="dep-lastName">Nom</Label>
            <Input id="dep-lastName" placeholder="Diop" value={lastName} onChange={(e) => setLastName(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="dep-phone">Téléphone</Label>
            <Input id="dep-phone" placeholder="77 000 00 00" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="dep-date">Date</Label>
            <Input id="dep-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="dep-amount">Somme (FCFA)</Label>
            <Input id="dep-amount" type="number" min={1} step={1} placeholder="250 000" value={amount} onChange={(e) => setAmount(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="dep-method">Mode de paiement</Label>
            <Select value={method} onValueChange={setMethod}>
              <SelectTrigger id="dep-method"><SelectValue /></SelectTrigger>
              <SelectContent>
                {PAYMENT_METHODS.map((m) => (
                  <SelectItem key={m} value={m}>{PAYMENT_METHOD_LABELS[m]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="sm:col-span-2 lg:col-span-3 flex justify-end pt-1">
            <Button type="submit" disabled={saving || !firstName.trim() || !lastName.trim() || !amount} className="min-w-40 bg-green-600 hover:bg-green-700 text-white font-bold">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Wallet className="h-4 w-4" aria-hidden />}
              Enregistrer le dépôt
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

/* ─── Formulaire d'ajout de retrait (inline) ────────────────────────────── */

function AddWithdrawalForm({ depositId, maxAmount, onDone }: { depositId: string; maxAmount: number; onDone: () => void }) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayISO());
  const [note, setNote] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const n = Number(amount);
    if (!Number.isFinite(n) || n <= 0) { toast({ title: "Montant invalide", variant: "destructive" }); return; }
    setSaving(true);
    try {
      const res = await authFetch(`/api/client-deposits/${depositId}/withdrawals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: n, date, note: note.trim() }),
      });
      if (!res.ok) { const json = await res.json(); throw new Error(json.error ?? "Erreur"); }
      toast({ title: "Retrait enregistré" });
      setAmount(""); setNote(""); setDate(todayISO());
      onDone();
    } catch (err) {
      toast({ title: "Erreur", description: err instanceof Error ? err.message : "Erreur inconnue", variant: "destructive" });
    } finally { setSaving(false); }
  };

  return (
    <form onSubmit={submit} className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-end">
      <div className="space-y-1.5"><Label className="text-xs">Date</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required className="h-8 text-sm" /></div>
      <div className="space-y-1.5"><Label className="text-xs">Montant retiré</Label><Input type="number" min={1} max={Math.round(maxAmount)} step={1} placeholder={`max ${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(maxAmount)}`} value={amount} onChange={(e) => setAmount(e.target.value)} required className="h-8 text-sm" /></div>
      <div className="space-y-1.5"><Label className="text-xs">Note</Label><div className="flex gap-1.5"><Input placeholder="Motif du retrait" value={note} onChange={(e) => setNote(e.target.value)} className="h-8 text-sm" /><Button type="submit" size="sm" disabled={saving || !amount} className="h-8 bg-amber-600 hover:bg-amber-700 shrink-0">{saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Minus className="h-3 w-3" />}</Button></div></div>
    </form>
  );
}

/* ─── Carte d'un dépôt ──────────────────────────────────────────────────── */

function DepositCard({ deposit, onRefresh, onDownloadReceipt }: { deposit: ClientDeposit; onRefresh: () => void; onDownloadReceipt: (deposit: ClientDeposit) => Promise<void> }) {
  const { toast } = useToast();
  const [showWithdrawals, setShowWithdrawals] = useState(true);
  const [receiptLoading, setReceiptLoading] = useState(false);
  const status = getDepositStatus(deposit);
  const remaining = getRemaining(deposit);
  const totalWithdrawn = deposit.withdrawals ? deposit.withdrawals.reduce((sum, w) => sum + w.amount, 0) : 0;

  const handleDelete = async () => {
    if (!confirm("Supprimer ce dépôt et tous ses retraits ?")) return;
    try {
      const res = await authFetch(`/api/client-deposits/${deposit.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Erreur");
      toast({ title: "Dépôt supprimé" }); onRefresh();
    } catch { toast({ title: "Erreur de suppression", variant: "destructive" }); }
  };

  const statusBadge = status === "SOLDE" ? <Badge className="bg-green-600 text-white hover:bg-green-700 font-bold">Soldé</Badge>
    : status === "RETRAIT_PARTIEL" ? <Badge className="bg-amber-500 text-white hover:bg-amber-600 font-bold">Retrait partiel</Badge>
    : <Badge variant="outline" className="border-green-600/40 text-green-700 font-bold">Non retiré</Badge>;

  return (
    <Card className="overflow-hidden border-green-600/15">
      <CardContent className="p-4 space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-600/10 text-green-600"><ArrowDownToLine className="h-5 w-5" /></div>
            <div>
              <p className="font-bold text-sm text-green-700">{deposit.firstName} {deposit.lastName}</p>
              <p className="text-xs text-muted-foreground">{deposit.phone && <span>{deposit.phone} · </span>}{formatDate(deposit.date)} · {PAYMENT_METHOD_LABELS[deposit.method] ?? deposit.method}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">{statusBadge}<Button
                variant="outline"
                size="sm"
                disabled={receiptLoading}
                className="h-7 gap-1.5 border-green-600/40 text-green-700 hover:bg-green-600/10 hover:text-green-800 font-bold text-xs px-2.5"
                onClick={async () => { setReceiptLoading(true); try { await onDownloadReceipt(deposit); } catch { toast({ title: "Erreur de génération", variant: "destructive" }); } finally { setReceiptLoading(false); } }}
              >
                {receiptLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
                Reçu
              </Button><Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={handleDelete} aria-label="Supprimer"><Trash2 className="h-3.5 w-3.5" /></Button></div>
        </div>
        <div className="flex items-center gap-2 bg-green-600/5 rounded-lg px-3 py-2">
          <span className="text-xs font-semibold text-green-700 uppercase tracking-wide">Déposé</span>
          <span className="text-base font-extrabold text-green-600 ml-auto">{formatMoney(deposit.amount)}</span>
        </div>
        {status !== "SOLDE" && (
          <div className="flex items-center gap-2 bg-amber-50 dark:bg-amber-900/10 rounded-lg px-3 py-2">
            <span className="text-xs font-semibold text-amber-700 uppercase tracking-wide">Restant</span>
            <span className="text-sm font-bold text-amber-600 ml-auto mr-2">{formatMoney(remaining)}</span>
            <div className="w-24 h-2 bg-muted rounded-full overflow-hidden shrink-0"><div className="h-full bg-amber-500 rounded-full transition-all" style={{ width: `${Math.min(100, (totalWithdrawn / deposit.amount) * 100)}%` }} /></div>
          </div>
        )}
        <div>
          <button type="button" onClick={() => setShowWithdrawals(!showWithdrawals)} className="flex items-center gap-1.5 text-xs font-bold text-amber-600 hover:text-amber-700 transition-colors">
            <ArrowUpFromLine className="h-3 w-3" />Historique des retraits<span className="text-[10px] font-normal text-muted-foreground">({deposit.withdrawals?.length ?? 0})</span>
          </button>
          {showWithdrawals && (
            <div className="mt-2 space-y-2">
              {deposit.withdrawals && deposit.withdrawals.length > 0 ? (
                <div className="space-y-1">{deposit.withdrawals.map((w) => (
                  <div key={w.id} className="flex items-center justify-between gap-2 rounded-md bg-amber-50 dark:bg-amber-900/10 px-3 py-2 text-xs">
                    <span className="text-muted-foreground">{formatDate(w.date)}</span>
                    <span className="font-bold text-amber-600">{formatMoney(w.amount)}</span>
                    <span className="text-muted-foreground truncate max-w-32">{w.note || "—"}</span>
                  </div>
                ))}</div>
              ) : <p className="text-xs text-muted-foreground italic">Aucun retrait</p>}
              {status !== "SOLDE" && <div className="pt-1"><AddWithdrawalForm depositId={deposit.id} maxAmount={remaining} onDone={onRefresh} /></div>}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/* ─── Vue principale Dépôts ─────────────────────────────────────────────── */

export function DepositsClientsView() {
  const [year, setYear] = useState(new Date().getFullYear().toString());
  const [filter, setFilter] = useState<"ALL" | "SOLDE" | "PARTIEL" | "NON_RETIREE">("ALL");
  const [search, setSearch] = useState("");
  const [searchDateFrom, setSearchDateFrom] = useState("");
  const [searchDateTo, setSearchDateTo] = useState("");
  const [pdfLoading, setPdfLoading] = useState(false);

  const { settings } = useSettingsStore();
  const { data: deposits, loading, error, refetch } = useFetch<ClientDeposit[]>(
    `/api/client-deposits?year=${year}`
  );

  const stats = useMemo(() => {
    if (!deposits) return { totalDeposed: 0, totalWithdrawn: 0, balance: 0 };
    let totalDeposed = 0; let totalWithdrawn = 0;
    for (const d of deposits) {
      totalDeposed += d.amount;
      if (d.withdrawals) { for (const w of d.withdrawals) { totalWithdrawn += w.amount; } }
    }
    return { totalDeposed, totalWithdrawn, balance: totalDeposed - totalWithdrawn };
  }, [deposits]);

  const filtered = useMemo(() => {
    if (!deposits) return [];
    let result = deposits;
    // Filtre statut
    if (filter !== "ALL") {
      result = result.filter((d) => {
        const status = getDepositStatus(d);
        if (filter === "SOLDE") return status === "SOLDE";
        if (filter === "PARTIEL") return status === "RETRAIT_PARTIEL";
        if (filter === "NON_RETIREE") return status === "NON_RETIREE";
        return true;
      });
    }
    // Filtre recherche texte
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((d) =>
        d.firstName.toLowerCase().includes(q) ||
        d.lastName.toLowerCase().includes(q) ||
        (d.phone && d.phone.includes(q)) ||
        (d.notes && d.notes.toLowerCase().includes(q))
      );
    }
    // Filtre dates
    if (searchDateFrom) {
      const from = new Date(`${searchDateFrom}T00:00:00`);
      result = result.filter((d) => new Date(d.date) >= from);
    }
    if (searchDateTo) {
      const to = new Date(`${searchDateTo}T23:59:59`);
      result = result.filter((d) => new Date(d.date) <= to);
    }
    return result;
  }, [deposits, filter, search, searchDateFrom, searchDateTo]);

  const exportExcel = async () => {
    try {
      const XLSX = await import("xlsx");
      const rows = (filtered || []).map((d) => {
        const totalW = d.withdrawals?.reduce((s, w) => s + w.amount, 0) ?? 0;
        return {
          Prénom: d.firstName, Nom: d.lastName, Téléphone: d.phone || "",
          "Date dépôt": formatDate(d.date), "Montant déposé": d.amount,
          "Mode paiement": PAYMENT_METHOD_LABELS[d.method] ?? d.method,
          "Total retiré": totalW, "Solde restant": d.amount - totalW,
          Statut: getDepositStatus(d) === "SOLDE" ? "Soldé" : getDepositStatus(d) === "RETRAIT_PARTIEL" ? "Retrait partiel" : "Non retirée",
        };
      });
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Dépôts clients");
      XLSX.writeFile(wb, `depots-clients-${year}.xlsx`);
    } catch { /* silencieux */ }
  };

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => String(currentYear - i));

  const handlePdfReport = async (period: Period) => {
    if (!deposits || deposits.length === 0) return;
    setPdfLoading(true);
    try {
      const logoDataUrl = await loadLogoAsDataUrl(settings?.logo);
      const companyInfo: CompanyInfo = settings
        ? {
            name: settings.nomSociete || COMPANY.name,
            tagline: settings.tagline || COMPANY.tagline,
            address: settings.adresse || COMPANY.address,
            phone: settings.telephone || COMPANY.phone,
            email: settings.email || COMPANY.email,
            rc: settings.rc || undefined,
            ninea: settings.ninea || undefined,
          }
        : getDefaultCompanyInfo();
      generateDepositsPdf(deposits, period, undefined, logoDataUrl, companyInfo);
    } finally {
      setPdfLoading(false);
    }
  };

  const handleDownloadReceipt = async (deposit: ClientDeposit) => {
    const logoDataUrl = await loadLogoAsDataUrl(settings?.logo);
    const companyInfo: CompanyInfo = settings
      ? {
          name: settings.nomSociete || COMPANY.name,
          tagline: settings.tagline || COMPANY.tagline,
          address: settings.adresse || COMPANY.address,
          phone: settings.telephone || COMPANY.phone,
          email: settings.email || COMPANY.email,
          rc: settings.rc || undefined,
          ninea: settings.ninea || undefined,
        }
      : getDefaultCompanyInfo();
    generateDepositReceiptPdf(deposit, logoDataUrl, companyInfo);
  };

  const clearSearch = () => { setSearch(""); setSearchDateFrom(""); setSearchDateTo(""); };

  return (
    <div className="space-y-5">
      {/* Titre */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight flex items-center gap-2 text-green-700">
            <Wallet className="h-5 w-5" aria-hidden />DÉPÔTS CLIENTS — {year}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date())}
          </p>
        </div>
        <Select value={year} onValueChange={setYear}>
          <SelectTrigger className="w-28"><CalendarDays className="h-4 w-4 mr-1.5 text-muted-foreground" /><SelectValue /></SelectTrigger>
          <SelectContent>{years.map((y) => (<SelectItem key={y} value={y}>{y}</SelectItem>))}</SelectContent>
        </Select>
      </div>

      {/* Formulaire nouveau dépôt */}
      <NewDepositForm onCreated={refetch} />

      {/* Recherche client / transaction */}
      <Card className="border-green-600/15 bg-green-600/[0.02]">
        <CardContent className="p-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 items-end">
            <div className="relative sm:col-span-2 lg:col-span-1">
              <Label className="text-xs font-bold text-green-700">Rechercher client</Label>
              <div className="relative mt-1">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-green-600/50" />
                <Input placeholder="Nom, prénom, tél…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8 h-8 text-sm border-green-600/20 focus:border-green-600" />
              </div>
            </div>
            <div>
              <Label className="text-xs font-bold text-green-700">Date début</Label>
              <Input type="date" value={searchDateFrom} onChange={(e) => setSearchDateFrom(e.target.value)} className="mt-1 h-8 text-sm border-green-600/20 focus:border-green-600" />
            </div>
            <div>
              <Label className="text-xs font-bold text-green-700">Date fin</Label>
              <Input type="date" value={searchDateTo} onChange={(e) => setSearchDateTo(e.target.value)} className="mt-1 h-8 text-sm border-green-600/20 focus:border-green-600" />
            </div>
            <div className="flex items-end gap-1.5">
              {(search || searchDateFrom || searchDateTo) && (
                <Button variant="ghost" size="sm" onClick={clearSearch} className="h-8 text-xs text-muted-foreground">Réinitialiser</Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Filtres + export + PDF */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          {(["ALL", "NON_RETIREE", "PARTIEL", "SOLDE"] as const).map((f) => {
            const label = f === "ALL" ? "Tous" : f === "SOLDE" ? "Soldés" : f === "PARTIEL" ? "Retrait partiel" : "Non retirés";
            return (
              <Button key={f} variant={filter === f ? "default" : "outline"} size="sm" onClick={() => setFilter(f)} className={filter === f ? "bg-green-600 hover:bg-green-700 text-white font-bold" : "font-semibold"}>
                {label}
              </Button>
            );
          })}
        </div>
        <div className="flex items-center gap-1.5">
          <Button variant="outline" size="sm" onClick={exportExcel} disabled={!filtered?.length}>
            <Download className="h-4 w-4 mr-1.5" />Excel
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" disabled={!deposits?.length || pdfLoading} className="border-green-600/30 text-green-700 hover:bg-green-600/5 font-bold">
                {pdfLoading ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <FileText className="h-4 w-4 mr-1.5" />}Rapport PDF
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {(["jour", "semaine", "mois", "annee"] as Period[]).map((p) => (
                <DropdownMenuItem key={p} onClick={() => handlePdfReport(p)} className="font-semibold cursor-pointer">
                  <FileText className="h-3.5 w-3.5 mr-2 text-green-600" />{PERIOD_LABELS[p]}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Liste des dépôts */}
      {loading && <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-green-600" /></div>}
      {error && <p className="text-center text-destructive py-8">{error}</p>}
      {!loading && !error && filtered?.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <Wallet className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="font-semibold">{search || searchDateFrom || searchDateTo ? "Aucun résultat" : `Aucun dépôt client pour ${year}`}</p>
        </div>
      )}
      {!loading && !error && filtered && filtered.length > 0 && (
        <div className="space-y-3">{filtered.map((d) => (<DepositCard key={d.id} deposit={d} onRefresh={refetch} onDownloadReceipt={handleDownloadReceipt} />))}</div>
      )}

      {/* Total déposé — en bas */}
      <Separator className="my-2" />
      <div className="sticky bottom-0 bg-background/95 backdrop-blur-sm border-t-2 border-green-600/30 rounded-xl px-4 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-600 text-white"><ArrowDownToLine className="h-5 w-5" /></div>
          <div>
            <p className="text-xs font-bold text-green-700 uppercase tracking-wide">Total déposé</p>
            <p className="text-[10px] text-muted-foreground">{filtered?.length ?? 0} dépôt(s) · {year}</p>
          </div>
        </div>
        <p className="text-xl font-extrabold text-green-600">{formatMoney(stats.totalDeposed)}</p>
      </div>
    </div>
  );
}
