"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Building2,
  Download,
  Loader2,
  Plus,
  Receipt,
  Store,
  Trash2,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useDebouncedValue, useFetch } from "@/hooks/use-fetch";
import { authFetch } from "@/lib/auth-client";
import { formatDate, formatMoney, PAYMENT_METHOD_LABELS } from "@/lib/constants";
import { Search } from "lucide-react";
import { PaymentBadge, DeliveryBadge } from "@/components/status-badges";
import { TicketPreviewDialog } from "@/components/ticket-preview-dialog";
import { saveOrOpenInvoicePDF } from "@/lib/pdf";
import type { CreditPayment, CreditPurchase, Invoice } from "@/lib/types";

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

function statusOf(p: CreditPurchase): "PAYE" | "PARTIEL" | "NON_PAYE" {
  if (p.total <= 0) return p.amountPaid > 0 ? "PARTIEL" : "NON_PAYE";
  if (p.amountPaid >= p.total - 0.009) return "PAYE";
  if (p.amountPaid > 0) return "PARTIEL";
  return "NON_PAYE";
}

const SOURCE_LABELS: Record<string, string> = {
  VENTE: "Facture",
  PROFORMA: "Proforma",
};

/* ─── Dialog versements d'un achat à crédit ──────────────────────────────── */

function CreditPaymentsDialog({
  purchase,
  open,
  onOpenChange,
  onUpdated,
}: {
  purchase: CreditPurchase | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: () => void;
}) {
  const { toast } = useToast();
  const [payments, setPayments] = useState<CreditPayment[]>([]);
  const [loading, setLoading] = useState(false);
  const [current, setCurrent] = useState<CreditPurchase | null>(null);

  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("ESPECES");
  const [date, setDate] = useState(todayISO());
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  // Aperçu du ticket 80 mm pour un règlement crédit
  const [ticket, setTicket] = useState<{ payment: CreditPayment; purchase: CreditPurchase } | null>(null);

  const total = current?.total ?? purchase?.total ?? 0;
  const paid = current?.amountPaid ?? purchase?.amountPaid ?? 0;
  const reste = Math.max(0, total - paid);

  const loadPayments = async () => {
    if (!purchase) return;
    setLoading(true);
    try {
      const res = await authFetch(`/api/credit-purchases/${purchase.id}/payments`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Chargement impossible");
      setPayments(Array.isArray(json) ? (json as CreditPayment[]) : []);
    } catch (e) {
      toast({
        title: "Erreur",
        description: e instanceof Error ? e.message : "Chargement des versements impossible",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && purchase) {
      setCurrent(purchase);
      setAmount(String(Math.max(0, purchase.total - purchase.amountPaid)));
      setMethod("ESPECES");
      setDate(todayISO());
      setNote("");
      loadPayments();
    }
    if (!open) {
      setPayments([]);
      setCurrent(null);
    }
  }, [open, purchase?.id]);

  const addPayment = async () => {
    if (!purchase) return;
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
      toast({
        title: "Montant invalide",
        description: "Saisissez un montant supérieur à 0 FCFA.",
        variant: "destructive",
      });
      return;
    }
    setSaving(true);
    try {
      const res = await authFetch(`/api/credit-purchases/${purchase.id}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: value, method, paidAt: date || todayISO(), note: note.trim() || undefined }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Enregistrement impossible");
      if (json.purchase) setCurrent(json.purchase as CreditPurchase);
      setAmount(String(Math.max(0, (json.purchase as CreditPurchase).total - (json.purchase as CreditPurchase).amountPaid)));
      setNote("");
      await loadPayments();
      onUpdated();
      toast({
        title: "Versement enregistré",
        description: `${formatMoney(value)} — ${PAYMENT_METHOD_LABELS[method] ?? method}`,
      });
      // Ouvre directement l'aperçu du ticket 80 mm du règlement enregistré
      const saved = json.payment as CreditPayment | undefined;
      if (saved) setTicket({ payment: saved, purchase: (json.purchase as CreditPurchase) ?? purchase });
    } catch (e) {
      toast({
        title: "Erreur",
        description: e instanceof Error ? e.message : "Enregistrement du versement impossible",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const removePayment = async (p: CreditPayment) => {
    setDeletingId(p.id);
    try {
      const res = await authFetch(`/api/credit-purchases/${purchase?.id}/payments/${p.id}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Suppression impossible");
      if (json.purchase) setCurrent(json.purchase as CreditPurchase);
      await loadPayments();
      onUpdated();
      toast({ title: "Versement supprimé", description: formatMoney(p.amount) });
    } catch (e) {
      toast({
        title: "Erreur",
        description: e instanceof Error ? e.message : "Suppression du versement impossible",
        variant: "destructive",
      });
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5 text-primary" aria-hidden />
            Versements {current ? `— ${current.number}` : ""}
          </DialogTitle>
          <DialogDescription>
            Règlements effectués au {current?.tier ?? "tiers"} : le solde est recalculé automatiquement.
          </DialogDescription>
        </DialogHeader>

        {current ? (
          <div className="space-y-4">
            {/* Totaux */}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <div className="rounded-lg border bg-muted/40 px-3 py-2">
                <p className="text-[11px] text-muted-foreground">Document</p>
                <p className="truncate text-sm font-semibold" title={current.number}>
                  {current.number}
                </p>
              </div>
              <div className="rounded-lg border bg-muted/40 px-3 py-2">
                <p className="text-[11px] text-muted-foreground">Total dû</p>
                <p className="truncate text-sm font-semibold tabular-nums" title={formatMoney(total)}>
                  {formatMoney(total)}
                </p>
              </div>
              <div className="rounded-lg border bg-muted/40 px-3 py-2">
                <p className="text-[11px] text-muted-foreground">Déjà réglé</p>
                <p className="truncate text-sm font-semibold tabular-nums text-green-700" title={formatMoney(paid)}>
                  {formatMoney(paid)}
                </p>
              </div>
              <div className="rounded-lg border bg-muted/40 px-3 py-2">
                <p className="text-[11px] text-muted-foreground">Reste à payer</p>
                <p
                  className={`truncate text-sm font-semibold tabular-nums ${
                    reste > 0 ? "text-red-600" : "text-green-700"
                  }`}
                  title={formatMoney(reste)}
                >
                  {formatMoney(reste)}
                </p>
              </div>
            </div>

            {/* Historique */}
            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Historique ({payments.length})
              </p>
              {loading ? (
                <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-11 w-full" />
                  ))}
                </div>
              ) : payments.length === 0 ? (
                <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                  Aucun versement enregistré pour cet achat à crédit.
                </div>
              ) : (
                <ul className="max-h-64 space-y-1.5 overflow-y-auto pr-1">
                  {payments.map((p) => (
                    <li
                      key={p.id}
                      className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2 text-sm"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-2">
                          <span className="font-semibold tabular-nums">{formatMoney(p.amount)}</span>
                          <span className="text-xs text-muted-foreground">
                            {PAYMENT_METHOD_LABELS[p.method] ?? p.method}
                          </span>
                          <span className="text-xs tabular-nums text-muted-foreground">
                            {formatDate(p.paidAt)}
                          </span>
                        </div>
                        {p.note && (
                          <p className="truncate text-xs text-muted-foreground" title={p.note}>
                            {p.note}
                          </p>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
                        onClick={() => setTicket({ payment: p, purchase: current ?? purchase! })}
                        disabled={deletingId === p.id}
                        aria-label={`Afficher le ticket 80 mm du versement du ${formatDate(p.paidAt)}`}
                        title="Aperçu du ticket 80 mm"
                      >
                        <Receipt className="h-4 w-4" aria-hidden />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                        onClick={() => removePayment(p)}
                        disabled={deletingId === p.id}
                        aria-label={`Supprimer le versement du ${formatDate(p.paidAt)}`}
                      >
                        {deletingId === p.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                        ) : (
                          <Trash2 className="h-4 w-4" aria-hidden />
                        )}
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Formulaire */}
            <div className="space-y-3 rounded-lg border bg-muted/30 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Nouveau versement
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="cp-amount">Montant (FCFA)</Label>
                  <Input
                    id="cp-amount"
                    type="number"
                    min={0}
                    step={100}
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cp-method">Méthode</Label>
                  <Select value={method} onValueChange={setMethod}>
                    <SelectTrigger id="cp-method" className="w-full">
                      <SelectValue placeholder="Choisir une méthode" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(PAYMENT_METHOD_LABELS).map(([key, label]) => (
                        <SelectItem key={key} value={key}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cp-date">Date</Label>
                  <Input id="cp-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cp-note">Note (optionnel)</Label>
                  <Input
                    id="cp-note"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Ex : acompte versé au fournisseur"
                  />
                </div>
              </div>
              <Button onClick={addPayment} disabled={saving} className="min-h-11 w-full font-semibold sm:w-auto">
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <Plus className="h-4 w-4" aria-hidden />
                )}
                Ajouter le versement
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        )}
      </DialogContent>

      {/* Aperçu du reçu de versement — ticket 80 mm (règlement crédit) */}
      <TicketPreviewDialog
        open={ticket !== null}
        onOpenChange={(v) => !v && setTicket(null)}
        payment={ticket?.payment ?? null}
        doc={
          ticket
            ? {
                number: ticket.purchase.number,
                clientName: ticket.purchase.tier,
                totalTTC: ticket.purchase.total,
                amountPaid: ticket.purchase.amountPaid,
              }
            : null
        }
      />
    </Dialog>
  );
}

/* ─── Vue principale ─────────────────────────────────────────────────────── */

export function CreditPurchasesView({ destination }: { destination: "COMMERCANT" | "IMMO" }) {
  const isCommercant = destination === "COMMERCANT";
  const { toast } = useToast();

  const [q, setQ] = useState("");
  const debouncedQ = useDebouncedValue(q);
  const { data: purchases, loading, refetch } = useFetch<CreditPurchase[]>(
    `/api/credit-purchases?destination=${destination}`
  );

  const [paymentsFor, setPaymentsFor] = useState<CreditPurchase | null>(null);
  const [deleting, setDeleting] = useState<CreditPurchase | null>(null);
  const [busy, setBusy] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  /** Télécharge la facture PDF d'origine une fois l'achat à crédit payé. */
  const downloadInvoicePDF = async (p: CreditPurchase) => {
    setDownloadingId(p.id);
    try {
      const res = await authFetch(`/api/invoices/${p.sourceId}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Facture introuvable");
      await saveOrOpenInvoicePDF(json as Invoice, "download");
      toast({
        title: "Facture téléchargée",
        description: `PDF de ${json.number} enregistré.`,
      });
    } catch (e) {
      toast({
        title: "Erreur PDF",
        description: e instanceof Error ? e.message : "Téléchargement de la facture impossible",
        variant: "destructive",
      });
    } finally {
      setDownloadingId(null);
    }
  };

  const filtered = useMemo(() => {
    const list = purchases ?? [];
    const needle = debouncedQ.trim().toLowerCase();
    if (!needle) return list;
    return list.filter(
      (p) =>
        p.number.toLowerCase().includes(needle) ||
        p.tier.toLowerCase().includes(needle) ||
        (p.note ?? "").toLowerCase().includes(needle)
    );
  }, [purchases, debouncedQ]);

  const stats = useMemo(() => {
    const list = purchases ?? [];
    const total = list.reduce((s, p) => s + p.total, 0);
    const paid = list.reduce((s, p) => s + p.amountPaid, 0);
    return { count: list.length, total, paid, reste: total - paid };
  }, [purchases]);

  const doDelete = async () => {
    if (!deleting) return;
    setBusy(true);
    try {
      const res = await authFetch(`/api/credit-purchases/${deleting.id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Suppression impossible");
      toast({
        title: "Transfert annulé",
        description: `${deleting.number} n'apparaît plus dans les achats à crédit.`,
      });
      setDeleting(null);
      refetch();
    } catch (e) {
      toast({
        title: "Erreur",
        description: e instanceof Error ? e.message : "Erreur inconnue",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  const Icon = isCommercant ? Store : Building2;
  const tierLabel = isCommercant ? "Commerçant / fournisseur" : "Bailleur / entreprise";

  return (
    <div className="space-y-4">
      {/* En-tête */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Icon className="h-5 w-5 text-primary" aria-hidden />
            {isCommercant ? "Commerçant — Achats à crédit" : "Immo — Achats à crédit"}
          </h2>
          <p className="text-sm text-muted-foreground">
            {isCommercant
              ? "Factures et proformas transférées : dettes envers les commerçants et fournisseurs."
              : "Factures et proformas transférées : dettes liées à l'immobilier."}
          </p>
        </div>
      </div>

      {/* Résumé */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Achats à crédit</p>
            <p className="text-lg font-bold tabular-nums">{stats.count}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total dû</p>
            <p className="text-lg font-bold tabular-nums">{formatMoney(stats.total)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Déjà réglé</p>
            <p className="text-lg font-bold tabular-nums text-green-700">{formatMoney(stats.paid)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Reste à payer</p>
            <p className="text-lg font-bold tabular-nums text-red-600">{formatMoney(stats.reste)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Recherche */}
      <Card>
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Rechercher par numéro, commerçant ou note…"
              className="pl-8"
              aria-label="Rechercher un achat à crédit"
            />
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-2 p-10 text-center">
              <Icon className="h-10 w-10 text-muted-foreground/40" aria-hidden />
              <p className="font-semibold">Aucun achat à crédit</p>
              <p className="max-w-md text-sm text-muted-foreground">
                Depuis l&apos;onglet <strong>Factures</strong> ou <strong>Proforma</strong>, ouvrez le menu
                d&apos;une ligne puis choisissez <strong>« Transférer en achat à crédit »</strong> pour
                l&apos;afficher ici.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Document</TableHead>
                    <TableHead>{tierLabel}</TableHead>
                    <TableHead>Échéance</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Réglé</TableHead>
                    <TableHead className="text-right">Reste</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((p) => {
                    const reste = Math.max(0, p.total - p.amountPaid);
                    return (
                      <TableRow key={p.id}>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <Badge
                              className="gap-0.5 border-gold/50 bg-gold-soft/60 px-1.5 py-0 text-[10px] font-bold text-amber-800 hover:bg-gold-soft/60 dark:text-amber-300"
                              title="Achat à crédit"
                            >
                              <Wallet className="h-3 w-3" aria-hidden /> Crédit
                            </Badge>
                          </div>
                          <p className="mt-1 font-semibold">{p.number}</p>
                          <p className="text-xs text-muted-foreground">
                            {SOURCE_LABELS[p.sourceType] ?? p.sourceType}
                            {p.note ? ` — ${p.note}` : ""}
                          </p>
                        </TableCell>
                        <TableCell className="max-w-44 truncate" title={p.tier}>
                          {p.tier}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-sm">
                          {p.dueDate ? formatDate(p.dueDate) : "—"}
                        </TableCell>
                        <TableCell className="text-right font-semibold tabular-nums whitespace-nowrap">
                          {formatMoney(p.total)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums whitespace-nowrap text-green-700">
                          {formatMoney(p.amountPaid)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums whitespace-nowrap text-red-600">
                          {formatMoney(reste)}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap items-center gap-1">
                            <PaymentBadge status={statusOf(p)} />
                            {p.sourceDeliveryStatus && (
                              <DeliveryBadge status={p.sourceDeliveryStatus} />
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-0.5">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => setPaymentsFor(p)}
                              aria-label={`Versements pour ${p.number}`}
                              title="Versements"
                            >
                              <Wallet className="h-4 w-4" />
                            </Button>
                            {statusOf(p) === "PAYE" && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-green-700 hover:text-green-800"
                                onClick={() => downloadInvoicePDF(p)}
                                disabled={downloadingId === p.id}
                                aria-label={`Télécharger la facture PDF de ${p.number}`}
                                title="Facture payée — télécharger le PDF"
                              >
                                {downloadingId === p.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                                ) : (
                                  <Download className="h-4 w-4" aria-hidden />
                                )}
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-destructive"
                              onClick={() => setDeleting(p)}
                              aria-label={`Annuler le transfert de ${p.number}`}
                              title="Annuler le transfert"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
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

      {/* Dialog versements */}
      <CreditPaymentsDialog
        purchase={paymentsFor}
        open={paymentsFor !== null}
        onOpenChange={(v) => !v && setPaymentsFor(null)}
        onUpdated={refetch}
      />

      {/* Confirmation annulation du transfert */}
      <Dialog open={deleting !== null} onOpenChange={(v) => !v && setDeleting(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Annuler le transfert ?</DialogTitle>
            <DialogDescription>
              {deleting && (
                <>
                  Le document <strong>{deleting.number}</strong> ({formatMoney(deleting.total)}) sera retiré
                  des achats à crédit. La facture d&apos;origine reste inchangée dans son onglet.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleting(null)} disabled={busy}>
              Retour
            </Button>
            <Button variant="destructive" onClick={doDelete} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Trash2 className="h-4 w-4" aria-hidden />}
              Annuler le transfert
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
