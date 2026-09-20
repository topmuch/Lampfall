"use client";

import { useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Download,
  Eye,
  FileText,
  MoreHorizontal,
  Paperclip,
  Plus,
  Search,
  ShoppingBag,
  Trash2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useDebouncedValue, useFetch } from "@/hooks/use-fetch";
import { formatDate, formatMoney, toISODate } from "@/lib/constants";
import type { Product, Purchase } from "@/lib/types";
import {
  DraftItem,
  ItemsEditor,
  emptyItem,
  itemToApi,
} from "@/components/items-editor";
import { buildPurchasePDF, openPDF } from "@/lib/pdf";

interface FormState {
  supplier: string;
  date: string;
  notes: string;
  updateStock: boolean;
  items: DraftItem[];
}

export function PurchasesView() {
  const { toast } = useToast();
  const [q, setQ] = useState("");
  const debouncedQ = useDebouncedValue(q);
  const { data: purchases, loading, refetch } = useFetch<Purchase[]>(
    `/api/purchases${debouncedQ ? `?q=${encodeURIComponent(debouncedQ)}` : ""}`
  );
  const { data: products } = useFetch<Product[]>("/api/products");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<FormState>({
    supplier: "",
    date: toISODate(new Date()),
    notes: "",
    updateStock: true,
    items: [emptyItem()],
  });
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<Purchase | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const totals = useMemo(() => {
    const list = purchases ?? [];
    return {
      count: list.length,
      amount: list.reduce((s, p) => s + p.total, 0),
      withFile: list.filter((p) => p.fileStored).length,
    };
  }, [purchases]);

  const submit = async () => {
    if (!form.supplier.trim()) {
      toast({ title: "Fournisseur obligatoire", variant: "destructive" });
      return;
    }
    const items = form.items.filter(
      (it) => it.productName.trim() && (Number(it.quantity) || 0) > 0
    );
    if (items.length === 0 && !file) {
      toast({
        title: "Contenu manquant",
        description: "Ajoutez des articles ou joignez le scan de la facture.",
        variant: "destructive",
      });
      return;
    }
    if (file && file.size > 5 * 1024 * 1024) {
      toast({ title: "Fichier trop volumineux", description: "Maximum 5 Mo.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const formData = new FormData();
      formData.set("supplier", form.supplier);
      formData.set("date", form.date ? new Date(`${form.date}T12:00:00`).toISOString() : "");
      formData.set("notes", form.notes);
      formData.set("updateStock", String(form.updateStock));
      formData.set("items", JSON.stringify(items.map(itemToApi)));
      if (file) formData.set("file", file);

      const res = await fetch("/api/purchases", { method: "POST", body: formData });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Erreur d'enregistrement");
      toast({
        title: "Facture d'achat enregistrée",
        description: `${json.number} — ${formatMoney(json.total)}`,
      });
      setDialogOpen(false);
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setForm({
        supplier: "",
        date: toISODate(new Date()),
        notes: "",
        updateStock: true,
        items: [emptyItem()],
      });
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
      const res = await fetch(`/api/purchases/${deleting.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Suppression impossible");
      toast({ title: "Facture d'achat supprimée", description: deleting.number });
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

  const handlePDF = async (purchase: Purchase) => {
    try {
      const doc = await buildPurchasePDF(purchase);
      openPDF(doc);
    } catch {
      toast({ title: "Erreur PDF", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold">Factures d&apos;achat</h2>
          <p className="text-sm text-muted-foreground">
            Archivage des achats fournisseurs avec pièce jointe scannée.
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => {
            setForm({
              supplier: "",
              date: toISODate(new Date()),
              notes: "",
              updateStock: true,
              items: [emptyItem()],
            });
            setFile(null);
            setDialogOpen(true);
          }}
        >
          <Plus className="h-4 w-4" /> Nouvel achat
        </Button>
      </div>

      {/* Résumé */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <ShoppingBag className="h-5 w-5 text-primary" />
            <div>
              <p className="text-xs text-muted-foreground">Achats</p>
              <p className="text-lg font-bold tabular-nums">{totals.count}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total achats</p>
            <p className="text-lg font-bold tabular-nums">{formatMoney(totals.amount)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Paperclip className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Avec pièce jointe</p>
              <p className="text-lg font-bold tabular-nums">{totals.withFile}</p>
            </div>
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
              placeholder="Rechercher par numéro ou fournisseur…"
              className="pl-8"
              aria-label="Rechercher une facture d'achat"
            />
          </div>
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
          ) : !purchases || purchases.length === 0 ? (
            <div className="p-10 text-center text-sm text-muted-foreground">
              Aucune facture d&apos;achat enregistrée.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>N°</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Fournisseur</TableHead>
                  <TableHead className="text-center">Articles</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Pièce jointe</TableHead>
                  <TableHead className="w-12" aria-label="Actions" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {purchases.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.number}</TableCell>
                    <TableCell className="whitespace-nowrap">{formatDate(p.date)}</TableCell>
                    <TableCell className="max-w-40 truncate" title={p.supplier}>
                      {p.supplier}
                    </TableCell>
                    <TableCell className="text-center tabular-nums">{p.items.length}</TableCell>
                    <TableCell className="text-right font-semibold tabular-nums whitespace-nowrap">
                      {formatMoney(p.total)}
                    </TableCell>
                    <TableCell>
                      {p.fileStored ? (
                        <a
                          href={`/api/purchases/${p.id}/file`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
                        >
                          <FileText className="h-4 w-4" />
                          <span className="max-w-28 truncate">{p.fileName}</span>
                        </a>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Actions pour ${p.number}`}>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handlePDF(p)}>
                            <Eye className="h-4 w-4" /> Voir le bon d&apos;achat PDF
                          </DropdownMenuItem>
                          {p.fileStored && (
                            <DropdownMenuItem
                              onClick={() => window.open(`/api/purchases/${p.id}/file`, "_blank")}
                            >
                              <Download className="h-4 w-4" /> Ouvrir la pièce jointe
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem
                            onClick={() => setDeleting(p)}
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

      {/* Dialog nouvel achat */}
      <Dialog open={dialogOpen} onOpenChange={(v) => !v && setDialogOpen(false)}>
        <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nouvelle facture d&apos;achat</DialogTitle>
            <DialogDescription>
              Enregistrez l&apos;achat et joignez éventuellement le scan de la facture (PDF ou image).
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="pu-supplier">Fournisseur *</Label>
                <Input
                  id="pu-supplier"
                  value={form.supplier}
                  onChange={(e) => setForm({ ...form, supplier: e.target.value })}
                  placeholder="Ex : SOTRA Import"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pu-date">Date d&apos;achat</Label>
                <Input
                  id="pu-date"
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Articles achetés</Label>
              <ItemsEditor
                items={form.items}
                onChange={(items) => setForm({ ...form, items })}
                products={products ?? []}
                priceField="purchasePrice"
              />
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="pu-stock"
                checked={form.updateStock}
                onCheckedChange={(v) => setForm({ ...form, updateStock: v === true })}
              />
              <Label htmlFor="pu-stock" className="font-normal text-sm">
                Incrémenter le stock des produits du catalogue
              </Label>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="pu-file">Pièce jointe (facture scannée — PDF, image — max 5 Mo)</Label>
              <Input
                id="pu-file"
                ref={fileInputRef}
                type="file"
                accept="application/pdf,image/*"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-1 file:text-sm file:text-secondary-foreground"
              />
              {file && (
                <p className="text-xs text-muted-foreground">
                  {file.name} — {(file.size / 1024).toFixed(0)} Ko
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="pu-notes">Notes</Label>
              <Textarea
                id="pu-notes"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={2}
                placeholder="Conditions de règlement, livraison…"
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
            <DialogTitle>Supprimer la facture d&apos;achat ?</DialogTitle>
            <DialogDescription>
              {deleting &&
                `L'achat ${deleting.number} (${formatMoney(deleting.total)}) et sa pièce jointe seront définitivement supprimés.`}
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
    </div>
  );
}
