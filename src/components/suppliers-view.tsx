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
import { ConfirmPage, PageOverlay } from "@/components/page-overlay";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import {
  FileText,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  ShoppingBag,
  Trash2,
  Truck,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useDebouncedValue, useFetch } from "@/hooks/use-fetch";
import { authFetch } from "@/lib/auth-client";
import { formatDate, formatMoney } from "@/lib/constants";
import type { Purchase, Supplier } from "@/lib/types";

interface SupplierFormState {
  name: string;
  phone: string;
  email: string;
  address: string;
  notes: string;
}

const emptyForm: SupplierFormState = {
  name: "",
  phone: "",
  email: "",
  address: "",
  notes: "",
};

export function SuppliersView() {
  const { toast } = useToast();
  const [q, setQ] = useState("");
  const debouncedQ = useDebouncedValue(q);

  const query = useMemo(
    () => (debouncedQ ? `/api/suppliers?q=${encodeURIComponent(debouncedQ)}` : "/api/suppliers"),
    [debouncedQ]
  );
  const { data: suppliers, loading, error, refetch } = useFetch<Supplier[]>(query);

  // Dialog création / édition
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [form, setForm] = useState<SupplierFormState>(emptyForm);
  const [saving, setSaving] = useState(false);

  // Suppression
  const [deleting, setDeleting] = useState<Supplier | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  // Historique des achats
  const [historyFor, setHistoryFor] = useState<Supplier | null>(null);
  const { data: historyPurchases, loading: historyLoading } = useFetch<Purchase[]>(
    historyFor ? `/api/purchases?supplierId=${encodeURIComponent(historyFor.id)}` : null
  );

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (s: Supplier) => {
    setEditing(s);
    setForm({
      name: s.name,
      phone: s.phone ?? "",
      email: s.email ?? "",
      address: s.address ?? "",
      notes: s.notes ?? "",
    });
    setDialogOpen(true);
  };

  const submit = async () => {
    if (!form.name.trim()) {
      toast({
        title: "Nom obligatoire",
        description: "Saisissez le nom du fournisseur.",
        variant: "destructive",
      });
      return;
    }
    setSaving(true);
    try {
      const res = await authFetch(editing ? `/api/suppliers/${editing.id}` : "/api/suppliers", {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          phone: form.phone.trim() || null,
          email: form.email.trim() || null,
          address: form.address.trim() || null,
          notes: form.notes.trim() || null,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error ?? "Erreur d'enregistrement");
      toast({
        title: editing ? "Fournisseur modifié" : "Fournisseur créé",
        description: form.name.trim(),
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

  const openDelete = (s: Supplier) => {
    setDeleting(s);
    setDeleteError(null);
  };

  const doDelete = async () => {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      const res = await authFetch(`/api/suppliers/${deleting.id}`, { method: "DELETE" });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error ?? "Suppression impossible");
      toast({ title: "Fournisseur supprimé", description: deleting.name });
      setDeleting(null);
      refetch();
    } catch (e) {
      const message = e instanceof Error ? e.message : "Erreur inconnue";
      setDeleteError(message);
      toast({ title: "Suppression impossible", description: message, variant: "destructive" });
    } finally {
      setDeleteBusy(false);
    }
  };

  const historyTotal = (historyPurchases ?? []).reduce((s, p) => s + p.total, 0);

  return (
    <div className="space-y-4">
      {/* En-tête */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold">Fournisseurs</h2>
          <p className="text-sm text-muted-foreground">
            Répertoire des fournisseurs et suivi des achats.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative sm:w-64">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Rechercher un fournisseur…"
              className="pl-8"
              aria-label="Rechercher un fournisseur"
            />
          </div>
          <Button size="sm" onClick={openCreate} className="min-h-11 sm:min-h-0">
            <Plus className="h-4 w-4" /> Nouveau fournisseur
          </Button>
        </div>
      </div>

      {/* Liste */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4 space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : error ? (
            <div className="p-10 text-center text-sm text-destructive">{error}</div>
          ) : !suppliers || suppliers.length === 0 ? (
            <div className="flex flex-col items-center gap-2 p-10 text-center">
              <Truck className="h-10 w-10 text-muted-foreground/50" aria-hidden />
              <p className="text-sm text-muted-foreground">
                {q
                  ? "Aucun fournisseur ne correspond à votre recherche."
                  : "Aucun fournisseur enregistré. Créez votre premier fournisseur."}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fournisseur</TableHead>
                  <TableHead>Téléphone</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead className="text-center">Achats</TableHead>
                  <TableHead className="text-right">Total achats</TableHead>
                  <TableHead className="w-12" aria-label="Actions" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {suppliers.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell>
                      <div className="min-w-0">
                        <div className="font-medium truncate max-w-56" title={s.name}>
                          {s.name}
                        </div>
                        {s.address && (
                          <div className="text-xs text-muted-foreground truncate max-w-56" title={s.address}>
                            {s.address}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {s.phone ? (
                        <span className="tabular-nums">{s.phone}</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="max-w-44">
                      {s.email ? (
                        <span className="block truncate text-sm" title={s.email}>
                          {s.email}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center tabular-nums">
                      {s.purchaseCount ?? 0}
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums whitespace-nowrap">
                      {formatMoney(s.purchaseTotal ?? 0)}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9"
                            aria-label={`Actions pour ${s.name}`}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setHistoryFor(s)}>
                            <ShoppingBag className="h-4 w-4" /> Achats
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openEdit(s)}>
                            <Pencil className="h-4 w-4" /> Modifier
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => openDelete(s)}
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

      {/* Page création / édition */}
      <PageOverlay
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title={editing ? "Modifier le fournisseur" : "Nouveau fournisseur"}
        description={
          editing
            ? `Mettez à jour la fiche de « ${editing.name} ».`
            : "Ajoutez un fournisseur au répertoire pour le retrouver dans les achats."
        }
        actions={
          <>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              Annuler
            </Button>
            <Button onClick={submit} disabled={saving} className="min-w-28">
              {saving ? "Enregistrement…" : "Enregistrer"}
            </Button>
          </>
        }
        maxWidth="max-w-2xl"
      >
          <div className="grid gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="sup-name">Nom *</Label>
              <Input
                id="sup-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ex : SOTRA Import"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="sup-phone">Téléphone</Label>
                <Input
                  id="sup-phone"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="77 000 00 00"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sup-email">Email</Label>
                <Input
                  id="sup-email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="contact@fournisseur.sn"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sup-address">Adresse</Label>
              <Input
                id="sup-address"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                placeholder="Ex : Zone industrielle, Dakar"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sup-notes">Notes</Label>
              <Textarea
                id="sup-notes"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={2}
                placeholder="Conditions de règlement, délais de livraison…"
              />
            </div>
          </div>
      </PageOverlay>

      {/* Page confirmation de suppression */}
      <ConfirmPage
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        onConfirm={doDelete}
        title="Supprimer le fournisseur ?"
        description={deleting && `« ${deleting.name} » sera retiré du répertoire de façon définitive.`}
        confirmLabel="Supprimer"
        destructive
        busy={deleteBusy}
        busyLabel="Suppression…"
        error={deleting !== null ? deleteError : null}
        icon={<Trash2 className="h-6 w-6 text-destructive" aria-hidden />}
      />

      {/* Page historique des achats du fournisseur */}
      <PageOverlay
        open={historyFor !== null}
        onClose={() => setHistoryFor(null)}
        title={`Achats — ${historyFor?.name ?? ""}`}
        description="Historique des factures d'achat liées à ce fournisseur."
        maxWidth="max-w-2xl"
      >
          {historyLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : !historyPurchases || historyPurchases.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              Aucun achat enregistré pour ce fournisseur.
            </div>
          ) : (
            <div className="rounded-lg border max-h-80 overflow-y-auto divide-y">
              {historyPurchases.map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{p.number}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(p.date)}</p>
                  </div>
                  <div className="flex items-center gap-2.5 shrink-0">
                    <span className="text-sm font-semibold tabular-nums whitespace-nowrap">
                      {formatMoney(p.total)}
                    </span>
                    {p.fileName && (
                      <a
                        href={`/api/purchases/${p.id}/file`}
                        target="_blank"
                        rel="noreferrer"
                        title={`Ouvrir la pièce jointe : ${p.fileName}`}
                        aria-label={`Ouvrir la pièce jointe de ${p.number}`}
                        className="inline-flex h-11 w-11 items-center justify-center rounded-md border text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary"
                      >
                        <FileText className="h-4 w-4" aria-hidden />
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
          {!historyLoading && historyPurchases && historyPurchases.length > 0 && (
            <div className="flex items-center justify-between rounded-lg bg-muted/60 px-3 py-2 text-sm">
              <span className="text-muted-foreground">
                {historyPurchases.length} achat{historyPurchases.length > 1 ? "s" : ""}
              </span>
              <span className="font-bold tabular-nums">{formatMoney(historyTotal)}</span>
            </div>
          )}
      </PageOverlay>
    </div>
  );
}
