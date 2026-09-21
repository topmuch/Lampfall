"use client";

import { useEffect, useState } from "react";
import { Building2, Loader2, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { authFetch } from "@/lib/auth-client";
import { formatMoney } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { Invoice } from "@/lib/types";

type Destination = "COMMERCANT" | "IMMO";

/**
 * Transfère une facture / proforma existante en achat à crédit :
 * elle apparaîtra dans l'onglet Commerçant ou Immobilier avec suivi des versements.
 */
export function TransferCreditDialog({
  invoice,
  open,
  onOpenChange,
  onTransferred,
}: {
  invoice: Invoice | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTransferred: () => void;
}) {
  const { toast } = useToast();
  const [destination, setDestination] = useState<Destination>("COMMERCANT");
  const [tier, setTier] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  // Réinitialisation à chaque ouverture
  useEffect(() => {
    if (open && invoice) {
      setDestination("COMMERCANT");
      setTier(invoice.clientName ?? "");
      setDueDate(invoice.dueDate ? invoice.dueDate.slice(0, 10) : "");
      setNote("");
    }
  }, [open, invoice?.id]);

  const submit = async () => {
    if (!invoice) return;
    setSaving(true);
    try {
      const res = await authFetch("/api/credit-purchases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceId: invoice.id,
          destination,
          tier: tier.trim(),
          dueDate: dueDate || undefined,
          note: note.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Transfert impossible");
      toast({
        title: "Transfert effectué",
        description: `${invoice.number} figure désormais dans les achats à crédit ${
          destination === "COMMERCANT" ? "Commerçant" : "Immo"
        }.`,
      });
      onOpenChange(false);
      onTransferred();
    } catch (e) {
      toast({
        title: "Erreur",
        description: e instanceof Error ? e.message : "Erreur inconnue",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const options: { value: Destination; label: string; hint: string; icon: typeof Store }[] = [
    {
      value: "COMMERCANT",
      label: "Commerçant",
      hint: "Dettes envers les commerçants / fournisseurs",
      icon: Store,
    },
    {
      value: "IMMO",
      label: "Immobilier",
      hint: "Dettes liées à l'immobilier (bailleurs, travaux)",
      icon: Building2,
    },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Transférer en achat à crédit</DialogTitle>
          <DialogDescription>
            {invoice && (
              <>
                Document <strong>{invoice.number}</strong> — {formatMoney(invoice.totalTTC)} (
                {invoice.clientName || "Client comptoir"}).
              </>
            )}{" "}
            Choisissez le registre de destination.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Destination */}
          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Destination du transfert">
            {options.map((opt) => {
              const Icon = opt.icon;
              const active = destination === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setDestination(opt.value)}
                  className={cn(
                    "flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    active
                      ? "border-primary bg-primary/10 ring-1 ring-primary"
                      : "bg-card hover:bg-accent"
                  )}
                >
                  <Icon className={cn("h-5 w-5", active ? "text-primary" : "text-muted-foreground")} aria-hidden />
                  <span className="text-sm font-bold">{opt.label}</span>
                  <span className="text-[11px] leading-snug text-muted-foreground">{opt.hint}</span>
                </button>
              );
            })}
          </div>

          {/* Détails */}
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="transfer-tier">Commerçant / tiers</Label>
              <Input
                id="transfer-tier"
                value={tier}
                onChange={(e) => setTier(e.target.value)}
                placeholder="Ex : SENELEC, quincaillerie Ndiaye…"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="transfer-due">Échéance (optionnel)</Label>
                <Input id="transfer-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="transfer-note">Note (optionnel)</Label>
                <Input
                  id="transfer-note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Ex : achat de ciment à crédit"
                />
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Annuler
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Store className="h-4 w-4" aria-hidden />}
            Transférer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
