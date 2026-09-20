"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CalendarClock,
  ClipboardList,
  Download,
  Eye,
  FileDown,
  MoreHorizontal,
  Pencil,
  Plus,
  Repeat1,
  Search,
  Trash2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useDebouncedValue, useFetch } from "@/hooks/use-fetch";
import {
  ORDER_STATUSES,
  ORDER_STATUS_LABELS,
  formatDate,
  formatMoney,
  toISODate,
} from "@/lib/constants";
import type { Client, Order, Product } from "@/lib/types";
import { OrderStatusBadge } from "@/components/status-badges";
import {
  DraftItem,
  ItemsEditor,
  emptyItem,
  itemToApi,
} from "@/components/items-editor";
import { buildOrderPDF, buildOrdersListPDF, openPDF } from "@/lib/pdf";

interface FormState {
  clientId: string;
  clientName: string;
  date: string;
  deliveryDate: string;
  status: string;
  notes: string;
  items: DraftItem[];
}

function emptyForm(): FormState {
  return {
    clientId: "",
    clientName: "",
    date: toISODate(new Date()),
    deliveryDate: "",
    status: "EN_COURS",
    notes: "",
    items: [emptyItem()],
  };
}

export function OrdersView() {
  const { toast } = useToast();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const debouncedQ = useDebouncedValue(q);

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (debouncedQ) params.set("q", debouncedQ);
    if (status) params.set("status", status);
    return params.toString();
  }, [debouncedQ, status]);

  const { data: orders, loading, refetch } = useFetch<Order[]>(`/api/orders?${query}`);
  const { data: clients } = useFetch<Client[]>("/api/clients");
  const { data: products } = useFetch<Product[]>("/api/products");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Order | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<Order | null>(null);
  const [convertTarget, setConvertTarget] = useState<Order | null>(null);
  const [busy, setBusy] = useState(false);

  const stats = useMemo(() => {
    const list = orders ?? [];
    const pending = list.filter((o) => o.status === "EN_COURS" || o.status === "CONFIRMEE");
    return {
      count: list.length,
      pending: pending.length,
      estimated: list.reduce((s, o) => s + o.items.reduce((a, i) => a + i.total, 0), 0),
    };
  }, [orders]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm());
    setDialogOpen(true);
  };

  const openEdit = (order: Order) => {
    setEditing(order);
    setForm({
      clientId: order.clientId ?? "",
      clientName: order.clientName ?? "",
      date: toISODate(order.date),
      deliveryDate: toISODate(order.deliveryDate),
      status: order.status,
      notes: order.notes ?? "",
      items: order.items.map((it) => ({
        productId: it.productId ?? null,
        productName: it.productName,
        category: it.category ?? null,
        unit: it.unit,
        quantity: String(it.quantity),
        unitPrice: String(it.unitPrice),
      })),
    });
    setDialogOpen(true);
  };

  const onClientChange = (clientId: string) => {
    if (!clientId) {
      setForm((f) => ({ ...f, clientId: "", clientName: "" }));
      return;
    }
    const client = clients?.find((c) => c.id === clientId);
    setForm((f) => ({
      ...f,
      clientId,
      clientName: client?.name ?? f.clientName,
    }));
  };

  const submit = async () => {
    const items = form.items.filter(
      (it) => it.productName.trim() && (Number(it.quantity) || 0) > 0
    );
    if (items.length === 0) {
      toast({
        title: "Articles manquants",
        description: "Ajoutez au moins un article.",
        variant: "destructive",
      });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        clientId: form.clientId || null,
        clientName: form.clientName.trim() || "Client comptoir",
        date: form.date ? new Date(`${form.date}T12:00:00`) : new Date(),
        deliveryDate: form.deliveryDate ? new Date(`${form.deliveryDate}T12:00:00`) : null,
        status: form.status,
        notes: form.notes,
        items: items.map(itemToApi),
      };
      const res = await fetch(editing ? `/api/orders/${editing.id}` : "/api/orders", {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Erreur d'enregistrement");
      toast({
        title: editing ? "Commande modifiée" : "Commande créée",
        description: `${json.number} — ${formatMoney(json.items.reduce((s: number, i: { total: number }) => s + i.total, 0))}`,
      });
      setDialogOpen(false);
      refetch();
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

  const doDelete = async () => {
    if (!deleting) return;
    try {
      const res = await fetch(`/api/orders/${deleting.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Suppression impossible");
      toast({ title: "Commande supprimée", description: deleting.number });
      setDeleting(null);
      refetch();
    } catch (e) {
      toast({
        title: "Erreur",
        description: e instanceof Error ? e.message : "Erreur inconnue",
        variant: "destructive",
      });
    }
  };

  const doConvert = async () => {
    if (!convertTarget) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/orders/${convertTarget.id}/convert`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Conversion impossible");
      toast({
        title: "Commande convertie",
        description: `Facture de vente ${json.number} créée.`,
      });
      setConvertTarget(null);
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

  const orderTotal = (o: Order) => o.items.reduce((s, i) => s + i.total, 0);

  const exportListPDF = async () => {
    if (!orders || orders.length === 0) {
      toast({ title: "Aucune commande", description: "Rien à exporter." });
      return;
    }
    try {
      const doc = await buildOrdersListPDF(orders);
      doc.save(`commandes-previsionnelles-${new Date().toISOString().slice(0, 10)}.pdf`);
      toast({ title: "Export PDF", description: `${orders.length} commande(s) exportée(s).` });
    } catch {
      toast({ title: "Erreur PDF", variant: "destructive" });
    }
  };

  const handleOrderPDF = async (order: Order) => {
    try {
      const doc = await buildOrderPDF(order);
      openPDF(doc);
    } catch {
      toast({ title: "Erreur PDF", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold">Commandes prévisionnelles</h2>
          <p className="text-sm text-muted-foreground">
            Anticipez les besoins clients — liste exportable en PDF.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={exportListPDF}>
            <FileDown className="h-4 w-4" /> Exporter la liste (PDF)
          </Button>
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4" /> Nouvelle commande
          </Button>
        </div>
      </div>

      {/* Statistiques */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <ClipboardList className="h-5 w-5 text-primary" />
            <div>
              <p className="text-xs text-muted-foreground">Commandes</p>
              <p className="text-lg font-bold tabular-nums">{stats.count}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <CalendarClock className="h-5 w-5 text-amber-500" />
            <div>
              <p className="text-xs text-muted-foreground">En cours / confirmées</p>
              <p className="text-lg font-bold tabular-nums">{stats.pending}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Montant estimé</p>
            <p className="text-lg font-bold tabular-nums">{formatMoney(stats.estimated)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filtres */}
      <Card>
        <CardContent className="p-4 flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Rechercher par numéro ou client…"
              className="pl-8"
              aria-label="Rechercher une commande"
            />
          </div>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-full sm:w-52" aria-label="Filtrer par statut">
              <SelectValue placeholder="Tous les statuts" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les statuts</SelectItem>
              {ORDER_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {ORDER_STATUS_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Liste */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4 space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : !orders || orders.length === 0 ? (
            <div className="p-10 text-center text-sm text-muted-foreground">
              Aucune commande prévisionnelle.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>N°</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Livraison prévue</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Montant estimé</TableHead>
                  <TableHead className="w-12" aria-label="Actions" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell className="font-medium">{o.number}</TableCell>
                    <TableCell className="max-w-36 truncate" title={o.clientName}>
                      {o.clientName || "Client comptoir"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{formatDate(o.date)}</TableCell>
                    <TableCell className="whitespace-nowrap">{formatDate(o.deliveryDate)}</TableCell>
                    <TableCell>
                      <OrderStatusBadge status={o.status} />
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums whitespace-nowrap">
                      {formatMoney(orderTotal(o))}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Actions pour ${o.number}`}>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleOrderPDF(o)}>
                            <Eye className="h-4 w-4" /> Voir le bon PDF
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openEdit(o)}>
                            <Pencil className="h-4 w-4" /> Modifier
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setConvertTarget(o)}>
                            <Repeat1 className="h-4 w-4" /> Convertir en facture
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => setDeleting(o)}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" /> Supprimer
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Dialog création / édition */}
      <Dialog open={dialogOpen} onOpenChange={(v) => !v && setDialogOpen(false)}>
        <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editing ? `Modifier la commande ${editing.number}` : "Nouvelle commande prévisionnelle"}
            </DialogTitle>
            <DialogDescription>
              Cette commande anticipe un besoin — convertissable en facture de vente.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Client existant</Label>
                <Select value={form.clientId} onValueChange={onClientChange}>
                  <SelectTrigger aria-label="Choisir un client">
                    <SelectValue placeholder="— Client libre —" />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {clients?.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="o-name">Nom du client</Label>
                <Input
                  id="o-name"
                  value={form.clientName}
                  onChange={(e) => setForm({ ...form, clientName: e.target.value, clientId: "" })}
                  placeholder="Ex : Promoteur Keur Dansa"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="o-date">Date de la commande</Label>
                <Input
                  id="o-date"
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="o-delivery">Livraison prévue</Label>
                <Input
                  id="o-delivery"
                  type="date"
                  value={form.deliveryDate}
                  onChange={(e) => setForm({ ...form, deliveryDate: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Articles commandés</Label>
              <ItemsEditor
                items={form.items}
                onChange={(items) => setForm({ ...form, items })}
                products={products ?? []}
                priceField="salePrice"
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Statut</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger aria-label="Statut de la commande">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ORDER_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {ORDER_STATUS_LABELS[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="rounded-lg bg-muted/60 p-3 flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Montant estimé</span>
                <span className="font-bold tabular-nums text-primary">
                  {formatMoney(
                    form.items.reduce(
                      (s, it) => s + (Number(it.quantity) || 0) * (Number(it.unitPrice) || 0),
                      0
                    )
                  )}
                </span>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="o-notes">Notes</Label>
              <Textarea
                id="o-notes"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              Annuler
            </Button>
            <Button onClick={submit} disabled={saving}>
              {saving ? "Enregistrement…" : "Enregistrer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmation suppression */}
      <Dialog open={deleting !== null} onOpenChange={(v) => !v && setDeleting(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Supprimer la commande ?</DialogTitle>
            <DialogDescription>
              {deleting && `La commande ${deleting.number} sera définitivement supprimée.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)}>
              Annuler
            </Button>
            <Button variant="destructive" onClick={doDelete}>
              Supprimer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmation conversion */}
      <Dialog open={convertTarget !== null} onOpenChange={(v) => !v && setConvertTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Convertir en facture de vente ?</DialogTitle>
            <DialogDescription>
              {convertTarget &&
                `Une facture sera créée depuis la commande ${convertTarget.number}, le stock sera décrémenté et la commande passera en « Confirmée ».`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConvertTarget(null)} disabled={busy}>
              Annuler
            </Button>
            <Button onClick={doConvert} disabled={busy}>
              {busy ? "Conversion…" : "Convertir"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
