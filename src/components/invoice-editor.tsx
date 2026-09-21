"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  CreditCard,
  Loader2,
  Save,
  Store,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { formatMoney, toISODate } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { Client, Invoice, Product } from "@/lib/types";
import {
  DraftItem,
  ItemsEditor,
  emptyItem,
  itemToApi,
} from "@/components/items-editor";

type Destination = "NONE" | "COMMERCANT" | "IMMO";

interface InvoiceEditorProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  type: "VENTE" | "PROFORMA";
  invoice: Invoice | null; // null = création
  clients: Client[];
  products: Product[];
  /** La facture en cours d'édition est déjà classée à crédit (destination). */
  alreadyTransferred?: "COMMERCANT" | "IMMO" | null;
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

/**
 * Éditeur de facture / proforma en PAGE PLEIN ÉCRAN (pas une modale).
 * Propose directement le classement en achat à crédit (Commerçant ou Immo)
 * dès la création : la facture est transférée automatiquement à l'enregistrement.
 */
export function InvoiceEditor({
  open,
  onClose,
  onSaved,
  type,
  invoice,
  clients,
  products,
  alreadyTransferred = null,
}: InvoiceEditorProps) {
  const { toast } = useToast();
  const [form, setForm] = useState<FormState>(defaultForm);
  const [saving, setSaving] = useState(false);
  const isEdit = invoice !== null;
  const isProforma = type === "PROFORMA";

  // Classement crédit (à la création uniquement)
  const [destination, setDestination] = useState<Destination>("NONE");
  const [creditTier, setCreditTier] = useState("");
  const [creditDueDate, setCreditDueDate] = useState("");
  const [creditNote, setCreditNote] = useState("");

  useEffect(() => {
    if (open) {
      setForm(invoice ? fromInvoice(invoice) : defaultForm());
      setDestination("NONE");
      setCreditTier("");
      setCreditDueDate("");
      setCreditNote("");
    }
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

      // Classement direct en achat à crédit (création uniquement)
      if (!isEdit && destination !== "NONE") {
        const transferRes = await fetch("/api/credit-purchases", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sourceId: json.id,
            destination,
            tier: creditTier.trim() || form.clientName.trim() || "Client comptoir",
            dueDate: creditDueDate || form.dueDate || undefined,
            note: creditNote.trim() || undefined,
          }),
        });
        const transferJson = await transferRes.json();
        if (!transferRes.ok) {
          toast({
            title: "Facture créée, classement refusé",
            description: transferJson.error ?? "Le transfert en achat à crédit a échoué.",
            variant: "destructive",
          });
        }
      }

      toast({
        title: isEdit ? "Document modifié" : "Document enregistré",
        description: `N° ${json.number} — ${formatMoney(json.totalTTC)}${
          !isEdit && destination !== "NONE"
            ? ` — classé à crédit dans ${destination === "COMMERCANT" ? "Commerçant" : "Immo"}`
            : ""
        }`,
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

  if (!open) return null;

  const destinationOptions: {
    value: Destination;
    label: string;
    hint: string;
    icon: typeof Store;
  }[] = [
    {
      value: "NONE",
      label: "Vente normale",
      hint: "Aucun classement crédit",
      icon: CheckCircle2,
    },
    {
      value: "COMMERCANT",
      label: "Commerçant",
      hint: "Achat à crédit — onglet Commerçant",
      icon: Store,
    },
    {
      value: "IMMO",
      label: "Immo",
      hint: "Achat à crédit — onglet Immo",
      icon: Building2,
    },
  ];

  const docLabel = isProforma ? "proforma" : "facture";

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-background" role="dialog" aria-modal="true" aria-label={isEdit ? `Modifier le ${docLabel} ${invoice!.number}` : `Nouveau ${docLabel}`}>
      {/* Barre supérieure collante */}
      <header className="sticky top-0 z-10 border-b border-border/70 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <Button
              variant="outline"
              size="icon"
              onClick={onClose}
              aria-label="Retour à la liste"
              className="shrink-0"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="min-w-0">
              <h1 className="truncate text-base font-bold sm:text-lg">
                {isEdit
                  ? `Modifier ${isProforma ? "le proforma" : "la facture"} ${invoice!.number}`
                  : isProforma
                    ? "Nouvelle facture proforma"
                    : "Nouvelle facture de vente"}
              </h1>
              <p className="text-xs text-muted-foreground">
                {isProforma
                  ? "Devis prévisionnel — convertissable en facture définitive."
                  : "Client, articles, paiement et classement crédit."}
              </p>
            </div>
          </div>
          <Button onClick={submit} disabled={saving} className="shrink-0 min-w-32">
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Save className="h-4 w-4" aria-hidden />
            )}
            {isEdit ? "Enregistrer" : "Créer"}
          </Button>
        </div>
      </header>

      <div className="mx-auto max-w-4xl space-y-4 px-4 py-5 pb-16">
        {/* ─── Client ─── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Client</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
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
          </CardContent>
        </Card>

        {/* ─── Dates & statuts ─── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Dates &amp; statuts</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
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
          </CardContent>
        </Card>

        {/* ─── Classement du crédit ─── */}
        {!isEdit && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <CreditCard className="h-4 w-4 text-primary" aria-hidden />
                Classement du crédit
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Optionnel : classez directement ce document comme achat à crédit dans l&apos;onglet
                Commerçant ou Immo.
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Classement du crédit">
                {destinationOptions.map((opt) => {
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
                      <Icon
                        className={cn("h-5 w-5", active ? "text-primary" : "text-muted-foreground")}
                        aria-hidden
                      />
                      <span className="text-sm font-bold">{opt.label}</span>
                      <span className="text-[11px] leading-snug text-muted-foreground">{opt.hint}</span>
                    </button>
                  );
                })}
              </div>

              {destination !== "NONE" && (
                <div className="grid gap-3 rounded-xl border border-primary/30 bg-primary/5 p-3 sm:grid-cols-2">
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="credit-tier">
                      {destination === "COMMERCANT" ? "Commerçant / fournisseur" : "Bailleur / entreprise"}
                    </Label>
                    <Input
                      id="credit-tier"
                      value={creditTier}
                      onChange={(e) => setCreditTier(e.target.value)}
                      placeholder={form.clientName || "Ex : SENELEC, quincaillerie Ndiaye…"}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="credit-due">Échéance (optionnel)</Label>
                    <Input
                      id="credit-due"
                      type="date"
                      value={creditDueDate}
                      onChange={(e) => setCreditDueDate(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="credit-note">Note (optionnel)</Label>
                    <Input
                      id="credit-note"
                      value={creditNote}
                      onChange={(e) => setCreditNote(e.target.value)}
                      placeholder="Ex : achat à crédit"
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Document déjà classé à crédit */}
        {isEdit && alreadyTransferred && (
          <div className="flex items-center gap-2 rounded-xl border border-gold/50 bg-gold-soft/40 px-4 py-3 text-sm">
            <CreditCard className="h-4 w-4 text-gold" aria-hidden />
            <span>
              Ce document est déjà classé à crédit dans l&apos;onglet{" "}
              <strong>{alreadyTransferred === "COMMERCANT" ? "Commerçant" : "Immo"}</strong>.
            </span>
          </div>
        )}

        {/* ─── Articles ─── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Articles</CardTitle>
          </CardHeader>
          <CardContent>
            <ItemsEditor
              items={form.items}
              onChange={(items) => set({ items })}
              products={products}
              priceField="salePrice"
            />
          </CardContent>
        </Card>

        {/* ─── Totaux ─── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Totaux</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 sm:grid-cols-3">
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
              <p className="font-bold tabular-nums text-primary text-lg">{formatMoney(totals.ttc)}</p>
            </div>
          </CardContent>
        </Card>

        {/* ─── Options & notes ─── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Options &amp; notes</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
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
          </CardContent>
        </Card>

        {/* Actions bas de page */}
        <div className="flex items-center justify-between gap-3 pt-1">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Retour à la liste
          </Button>
          <Button onClick={submit} disabled={saving} className="min-w-40">
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Save className="h-4 w-4" aria-hidden />
            )}
            {isEdit ? "Enregistrer" : "Créer le document"}
          </Button>
        </div>
      </div>
    </div>
  );
}
