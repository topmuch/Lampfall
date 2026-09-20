"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { formatMoney, toISODate } from "@/lib/constants";
import type { Client, Invoice, Product } from "@/lib/types";
import {
  DraftItem,
  ItemsEditor,
  emptyItem,
  itemToApi,
} from "@/components/items-editor";

interface InvoiceDialogProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  type: "VENTE" | "PROFORMA";
  invoice: Invoice | null; // null = création
  clients: Client[];
  products: Product[];
}

interface FormState {
  clientId: string;
  clientName: string;
  clientPhone: string;
  clientAddress: string;
  date: string;
  dueDate: string;
  deliveryStatus: "LIVRE" | "NON_LIVRE";
  paymentStatus: "PAYE" | "PARTIEL" | "NON_PAYE";
  amountPaid: string;
  taxRate: string;
  updateStock: boolean;
  notes: string;
  items: DraftItem[];
}

function defaultForm(): FormState {
  const today = toISODate(new Date());
  return {
    clientId: "",
    clientName: "",
    clientPhone: "",
    clientAddress: "",
    date: today,
    dueDate: "",
    deliveryStatus: "NON_LIVRE",
    paymentStatus: "NON_PAYE",
    amountPaid: "0",
    taxRate: "18",
    updateStock: true,
    notes: "",
    items: [emptyItem()],
  };
}

function fromInvoice(invoice: Invoice): FormState {
  return {
    clientId: invoice.clientId ?? "",
    clientName: invoice.clientName ?? "",
    clientPhone: invoice.clientPhone ?? "",
    clientAddress: invoice.clientAddress ?? "",
    date: toISODate(invoice.date),
    dueDate: toISODate(invoice.dueDate),
    deliveryStatus: invoice.deliveryStatus,
    paymentStatus: invoice.paymentStatus,
    amountPaid: String(invoice.amountPaid ?? 0),
    taxRate: String(invoice.taxRate ?? 18),
    updateStock: true,
    notes: invoice.notes ?? "",
    items: invoice.items.map((it) => ({
      productId: it.productId ?? null,
      productName: it.productName,
      category: it.category ?? null,
      unit: it.unit,
      quantity: String(it.quantity),
      unitPrice: String(it.unitPrice),
    })),
  };
}

export function InvoiceDialog({
  open,
  onClose,
  onSaved,
  type,
  invoice,
  clients,
  products,
}: InvoiceDialogProps) {
  const { toast } = useToast();
  const [form, setForm] = useState<FormState>(defaultForm);
  const [saving, setSaving] = useState(false);
  const isEdit = invoice !== null;

  useEffect(() => {
    if (open) setForm(invoice ? fromInvoice(invoice) : defaultForm());
  }, [open, invoice]);

  const set = (patch: Partial<FormState>) => setForm((f) => ({ ...f, ...patch }));

  const totals = useMemo(() => {
    const ht = form.items.reduce(
      (s, it) => s + (Number(it.quantity) || 0) * (Number(it.unitPrice) || 0),
      0
    );
    const rate = Number(form.taxRate) || 0;
    const ttc = Math.round(ht * (1 + rate / 100));
    return { ht, tva: ttc - ht, ttc };
  }, [form.items, form.taxRate]);

  const onClientChange = (clientId: string) => {
    if (!clientId) {
      set({ clientId: "", clientName: "", clientPhone: "", clientAddress: "" });
      return;
    }
    const client = clients.find((c) => c.id === clientId);
    if (!client) return;
    set({
      clientId,
      clientName: client.name,
      clientPhone: client.phone ?? "",
      clientAddress: client.address ?? "",
    });
  };

  const submit = async () => {
    const items = form.items.filter(
      (it) => it.productName.trim() && (Number(it.quantity) || 0) > 0
    );
    if (items.length === 0) {
      toast({
        title: "Articles manquants",
        description: "Ajoutez au moins un article avec un nom et une quantité.",
        variant: "destructive",
      });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        type,
        clientId: form.clientId || null,
        clientName: form.clientName.trim() || "Client comptoir",
        clientPhone: form.clientPhone.trim(),
        clientAddress: form.clientAddress.trim(),
        date: form.date ? new Date(`${form.date}T12:00:00`) : new Date(),
        dueDate: form.dueDate ? new Date(`${form.dueDate}T12:00:00`) : null,
        deliveryStatus: form.deliveryStatus,
        paymentStatus: form.paymentStatus,
        amountPaid: form.paymentStatus === "PARTIEL" ? Number(form.amountPaid) || 0 : 0,
        taxRate: Number(form.taxRate) || 0,
        updateStock: form.updateStock,
        notes: form.notes,
        items: items.map(itemToApi),
      };
      const res = await fetch(
        isEdit ? `/api/invoices/${invoice!.id}` : "/api/invoices",
        {
          method: isEdit ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Erreur d'enregistrement");
      toast({
        title: isEdit ? "Facture modifiée" : "Facture enregistrée",
        description: `N° ${json.number} — ${formatMoney(json.totalTTC)}`,
      });
      onSaved();
      onClose();
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

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEdit
              ? `Modifier ${type === "PROFORMA" ? "le proforma" : "la facture"} ${invoice!.number}`
              : type === "PROFORMA"
                ? "Nouvelle facture proforma"
                : "Nouvelle facture de vente"}
          </DialogTitle>
          <DialogDescription>
            {type === "PROFORMA"
              ? "Devis prévisionnel — convertissable en facture définitive."
              : "Renseignez le client, les articles et les statuts de livraison et de paiement."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          {/* Client */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Client existant</Label>
              <Select value={form.clientId} onValueChange={onClientChange}>
                <SelectTrigger aria-label="Choisir un client existant">
                  <SelectValue placeholder="— Client libre / comptoir —" />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="inv-name">Nom du client</Label>
              <Input
                id="inv-name"
                value={form.clientName}
                onChange={(e) => set({ clientName: e.target.value, clientId: "" })}
                placeholder="Ex : M. Abdoulaye Diop"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="inv-phone">Téléphone</Label>
              <Input
                id="inv-phone"
                value={form.clientPhone}
                onChange={(e) => set({ clientPhone: e.target.value })}
                placeholder="+221 …"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="inv-address">Adresse</Label>
              <Input
                id="inv-address"
                value={form.clientAddress}
                onChange={(e) => set({ clientAddress: e.target.value })}
                placeholder="Quartier, ville"
              />
            </div>
          </div>

          {/* Dates + statuts */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1.5">
              <Label htmlFor="inv-date">Date</Label>
              <Input
                id="inv-date"
                type="date"
                value={form.date}
                onChange={(e) => set({ date: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="inv-due">Échéance (optionnel)</Label>
              <Input
                id="inv-due"
                type="date"
                value={form.dueDate}
                onChange={(e) => set({ dueDate: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Livraison</Label>
              <Select
                value={form.deliveryStatus}
                onValueChange={(v) => set({ deliveryStatus: v as FormState["deliveryStatus"] })}
              >
                <SelectTrigger aria-label="Statut de livraison">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NON_LIVRE">Non livré</SelectItem>
                  <SelectItem value="LIVRE">Livré</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Paiement</Label>
              <Select
                value={form.paymentStatus}
                onValueChange={(v) => set({ paymentStatus: v as FormState["paymentStatus"] })}
              >
                <SelectTrigger aria-label="Statut de paiement">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NON_PAYE">Non payé</SelectItem>
                  <SelectItem value="PARTIEL">Partiel</SelectItem>
                  <SelectItem value="PAYE">Payé</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {form.paymentStatus === "PARTIEL" && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="inv-paid">Montant payé (FCFA)</Label>
                <Input
                  id="inv-paid"
                  type="number"
                  min="0"
                  value={form.amountPaid}
                  onChange={(e) => set({ amountPaid: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  Total TTC : {formatMoney(totals.ttc)}
                </p>
              </div>
            </div>
          )}

          {/* Articles */}
          <div className="space-y-2">
            <Label>Articles</Label>
            <ItemsEditor
              items={form.items}
              onChange={(items) => set({ items })}
              products={products}
              priceField="salePrice"
            />
          </div>

          {/* Totaux */}
          <div className="rounded-lg bg-muted/60 p-4 grid gap-2 sm:grid-cols-3">
            <div className="flex justify-between sm:block">
              <span className="text-sm text-muted-foreground">Total HT</span>
              <p className="font-semibold tabular-nums">{formatMoney(totals.ht)}</p>
            </div>
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <Label htmlFor="inv-tva" className="text-muted-foreground text-sm">
                  TVA (%)
                </Label>
                <Input
                  id="inv-tva"
                  type="number"
                  min="0"
                  max="100"
                  value={form.taxRate}
                  onChange={(e) => set({ taxRate: e.target.value })}
                  className="h-8"
                />
              </div>
              <div className="text-right">
                <span className="text-sm text-muted-foreground">Montant</span>
                <p className="font-semibold tabular-nums text-sm">{formatMoney(totals.tva)}</p>
              </div>
            </div>
            <div className="flex justify-between sm:block">
              <span className="text-sm text-muted-foreground">Total TTC</span>
              <p className="font-bold tabular-nums text-primary text-lg">
                {formatMoney(totals.ttc)}
              </p>
            </div>
          </div>

          {/* Options + notes */}
          <div className="grid gap-3">
            {type === "VENTE" && !isEdit && (
              <div className="flex items-center gap-2">
                <Checkbox
                  id="inv-stock"
                  checked={form.updateStock}
                  onCheckedChange={(v) => set({ updateStock: v === true })}
                />
                <Label htmlFor="inv-stock" className="font-normal text-sm">
                  Décrémenter le stock des produits du catalogue
                </Label>
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="inv-notes">Notes</Label>
              <Textarea
                id="inv-notes"
                value={form.notes}
                onChange={(e) => set({ notes: e.target.value })}
                placeholder="Conditions, remarques…"
                rows={2}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Annuler
          </Button>
          <Button onClick={submit} disabled={saving} className="min-w-32">
            {saving ? "Enregistrement…" : isEdit ? "Enregistrer" : "Créer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
