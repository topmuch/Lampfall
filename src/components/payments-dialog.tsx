"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Plus, Receipt, Trash2, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageOverlay } from "@/components/page-overlay";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { authFetch } from "@/lib/auth-client";
import { TicketPreviewDialog } from "@/components/ticket-preview-dialog";
import { formatDate, formatMoney, PAYMENT_METHOD_LABELS } from "@/lib/constants";
import type { Invoice, Payment } from "@/lib/types";

/** Date du jour au format AAAA-MM-JJ local (sans décalage UTC). */
function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

interface PaymentsDialogProps {
  invoice: Invoice | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: () => void;
}

/**
 * Historique des versements d'une facture + ajout / suppression de versements.
 * Chaque mutation recalcule le montant payé et le statut côté serveur.
 */
export function PaymentsDialog({ invoice, open, onOpenChange, onUpdated }: PaymentsDialogProps) {
  const { toast } = useToast();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(false);
  const [current, setCurrent] = useState<Invoice | null>(null);

  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("ESPECES");
  const [date, setDate] = useState(todayISO());
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  // Aperçu du ticket 80 mm (s'affiche après chaque versement ou via le bouton)
  const [ticketPayment, setTicketPayment] = useState<Payment | null>(null);

  const totalTTC = current?.totalTTC ?? 0;
  const dejaPaye = current?.amountPaid ?? 0;
  const reste = Math.max(0, totalTTC - dejaPaye);

  const loadPayments = useCallback(async () => {
    if (!invoice) return;
    setLoading(true);
    try {
      const res = await authFetch(`/api/invoices/${invoice.id}/payments`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Chargement impossible");
      setPayments(Array.isArray(json) ? (json as Payment[]) : []);
    } catch (e) {
      toast({
        title: "Erreur",
        description: e instanceof Error ? e.message : "Chargement des versements impossible",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [invoice, toast]);

  // À l'ouverture : réinitialise le formulaire et charge l'historique
  useEffect(() => {
    if (open && invoice) {
      setCurrent(invoice);
      setAmount(String(Math.max(0, invoice.totalTTC - invoice.amountPaid)));
      setMethod("ESPECES");
      setDate(todayISO());
      setNote("");
      loadPayments();
    }
    if (!open) {
      setPayments([]);
      setCurrent(null);
    }
     
  }, [open, invoice?.id]);

  const addPayment = async () => {
    if (!invoice) return;
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
      const res = await authFetch(`/api/invoices/${invoice.id}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: value,
          method,
          paidAt: date || todayISO(),
          note: note.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Enregistrement impossible");
      const updated = json.invoice as Invoice | undefined;
      if (updated) {
        setCurrent(updated);
        setAmount(String(Math.max(0, updated.totalTTC - updated.amountPaid)));
      }
      setNote("");
      await loadPayments();
      onUpdated();
      toast({
        title: "Versement enregistré",
        description: `${formatMoney(value)} — ${PAYMENT_METHOD_LABELS[method] ?? method}`,
      });
      // Ouvre directement l'aperçu du ticket 80 mm du versement qui vient d'être enregistré
      const saved = json.payment as Payment | undefined;
      if (saved) setTicketPayment(saved);
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

  const removePayment = async (p: Payment) => {
    setDeletingId(p.id);
    try {
      const res = await authFetch(`/api/payments/${p.id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Suppression impossible");
      if (json.invoice) setCurrent(json.invoice as Invoice);
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

  // Document courant adapté à l'aperçu ticket (mise à jour après chaque versement)
  const ticketDoc = current
    ? {
        number: current.number,
        clientName: current.clientName,
        totalTTC: current.totalTTC,
        amountPaid: current.amountPaid,
      }
    : null;

  return (
    <>
      <PageOverlay
        open={open}
        onClose={() => onOpenChange(false)}
        title={
          <span className="flex items-center gap-2">
            <Wallet className="h-5 w-5 text-primary" aria-hidden />
            Versements {current ? `— ${current.number}` : ""}
          </span>
        }
        description="Encaissements partiels ou totaux : le statut de paiement est recalculé automatiquement."
        maxWidth="max-w-3xl"
      >

        {current ? (
          <div className="space-y-4">
            {/* En-tête : totaux */}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <div className="rounded-lg border bg-muted/40 px-3 py-2">
                <p className="text-[11px] text-muted-foreground">Facture</p>
                <p className="truncate text-sm font-semibold" title={current.number}>
                  {current.number}
                </p>
              </div>
              <div className="rounded-lg border bg-muted/40 px-3 py-2">
                <p className="text-[11px] text-muted-foreground">Total TTC</p>
                <p className="truncate text-sm font-semibold tabular-nums" title={formatMoney(totalTTC)}>
                  {formatMoney(totalTTC)}
                </p>
              </div>
              <div className="rounded-lg border bg-muted/40 px-3 py-2">
                <p className="text-[11px] text-muted-foreground">Déjà payé</p>
                <p className="truncate text-sm font-semibold tabular-nums text-green-700" title={formatMoney(dejaPaye)}>
                  {formatMoney(dejaPaye)}
                </p>
              </div>
              <div className="rounded-lg border bg-muted/40 px-3 py-2">
                <p className="text-[11px] text-muted-foreground">Reste</p>
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

            {/* Historique des versements */}
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
                  Aucun versement enregistré pour cette facture.
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
                        onClick={() => setTicketPayment(p)}
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

            {/* Formulaire d'ajout */}
            <div className="space-y-3 rounded-lg border bg-muted/30 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Nouveau versement
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="pay-amount">Montant (FCFA)</Label>
                  <Input
                    id="pay-amount"
                    type="number"
                    min={0}
                    step={100}
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pay-method">Méthode</Label>
                  <Select value={method} onValueChange={setMethod}>
                    <SelectTrigger id="pay-method" className="w-full">
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
                  <Label htmlFor="pay-date">Date</Label>
                  <Input id="pay-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pay-note">Note (optionnel)</Label>
                  <Input
                    id="pay-note"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Ex : acompte reçu en caisse"
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
      </PageOverlay>

      {/* Aperçu du reçu de versement — ticket 80 mm */}
      <TicketPreviewDialog
        open={ticketPayment !== null}
        onOpenChange={(v) => !v && setTicketPayment(null)}
        payment={ticketPayment}
        doc={ticketDoc}
      />
    </>
  );
}
