"use client";

import { useEffect, useMemo, useState } from "react";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, MoreHorizontal, Package, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useDebouncedValue, useFetch } from "@/hooks/use-fetch";
import {
  CATEGORY_LABELS,
  PRODUCT_CATEGORIES,
  formatMoney,
} from "@/lib/constants";
import type { Product } from "@/lib/types";
import { CategoryBadge } from "@/components/status-badges";

const UNITS = ["pièce", "barre", "rouleau", "lot", "kit", "mètre", "carton", "sachet"];

interface FormState {
  name: string;
  reference: string;
  category: string;
  purchasePrice: string;
  salePrice: string;
  stock: string;
  unit: string;
  minStock: string;
}

const emptyForm: FormState = {
  name: "",
  reference: "",
  category: "",
  purchasePrice: "0",
  salePrice: "0",
  stock: "0",
  unit: "pièce",
  minStock: "0",
};

export function ProductsView() {
  const { toast } = useToast();
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const debouncedQ = useDebouncedValue(q);

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (debouncedQ) params.set("q", debouncedQ);
    if (category) params.set("category", category);
    return params.toString();
  }, [debouncedQ, category]);

  const { data: products, loading, refetch } = useFetch<Product[]>(`/api/products?${query}`);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<Product | null>(null);

  useEffect(() => {
    if (dialogOpen) {
      setForm(
        editing
          ? {
              name: editing.name,
              reference: editing.reference ?? "",
              category: editing.category,
              purchasePrice: String(editing.purchasePrice),
              salePrice: String(editing.salePrice),
              stock: String(editing.stock),
              unit: editing.unit,
              minStock: String(editing.minStock),
            }
          : emptyForm
      );
    }
  }, [dialogOpen, editing]);

  const stats = useMemo(() => {
    const list = products ?? [];
    const stockValue = list.reduce((s, p) => s + p.purchasePrice * p.stock, 0);
    const lowStock = list.filter((p) => p.stock <= p.minStock).length;
    return { count: list.length, stockValue, lowStock };
  }, [products]);

  const submit = async () => {
    if (!form.name.trim() || !form.category) {
      toast({
        title: "Champs manquants",
        description: "Le nom et la catégorie sont obligatoires.",
        variant: "destructive",
      });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(editing ? `/api/products/${editing.id}` : "/api/products", {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          purchasePrice: Number(form.purchasePrice) || 0,
          salePrice: Number(form.salePrice) || 0,
          stock: Number(form.stock) || 0,
          minStock: Number(form.minStock) || 0,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Erreur d'enregistrement");
      toast({
        title: editing ? "Produit modifié" : "Produit créé",
        description: form.name,
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
      const res = await fetch(`/api/products/${deleting.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Suppression impossible");
      toast({ title: "Produit supprimé", description: deleting.name });
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

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold">Produits & Stock</h2>
          <p className="text-sm text-muted-foreground">
            Catalogue : sanitaire, plomberie, luminaire, électricité, etc.
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => {
            setEditing(null);
            setDialogOpen(true);
          }}
        >
          <Plus className="h-4 w-4" /> Nouveau produit
        </Button>
      </div>

      {/* Statistiques */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Package className="h-5 w-5 text-primary" />
            <div>
              <p className="text-xs text-muted-foreground">Références</p>
              <p className="text-lg font-bold tabular-nums">{stats.count}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Valeur du stock</p>
            <p className="text-lg font-bold tabular-nums">{formatMoney(stats.stockValue)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <AlertTriangle
              className={`h-5 w-5 ${stats.lowStock > 0 ? "text-amber-500" : "text-muted-foreground"}`}
            />
            <div>
              <p className="text-xs text-muted-foreground">Stock bas</p>
              <p className="text-lg font-bold tabular-nums">{stats.lowStock}</p>
            </div>
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
              placeholder="Rechercher par nom ou référence…"
              className="pl-8"
              aria-label="Rechercher un produit"
            />
          </div>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="w-full sm:w-56" aria-label="Filtrer par catégorie">
              <SelectValue placeholder="Toutes les catégories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes les catégories</SelectItem>
              {PRODUCT_CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {CATEGORY_LABELS[c]}
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
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : !products || products.length === 0 ? (
            <div className="p-10 text-center text-sm text-muted-foreground">
              Aucun produit trouvé.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produit</TableHead>
                  <TableHead>Catégorie</TableHead>
                  <TableHead className="text-right">Prix achat</TableHead>
                  <TableHead className="text-right">Prix vente</TableHead>
                  <TableHead className="text-center">Stock</TableHead>
                  <TableHead className="w-12" aria-label="Actions" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      <div className="font-medium">{p.name}</div>
                      {p.reference && (
                        <div className="text-xs text-muted-foreground">{p.reference}</div>
                      )}
                    </TableCell>
                    <TableCell>
                      <CategoryBadge category={p.category} />
                    </TableCell>
                    <TableCell className="text-right tabular-nums whitespace-nowrap">
                      {formatMoney(p.purchasePrice)}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums whitespace-nowrap">
                      {formatMoney(p.salePrice)}
                    </TableCell>
                    <TableCell className="text-center">
                      <span
                        className={
                          p.stock <= p.minStock
                            ? "inline-flex items-center gap-1 rounded-md bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700"
                            : "inline-flex items-center rounded-md bg-green-50 px-2 py-0.5 text-xs font-semibold text-green-800"
                        }
                      >
                        {p.stock} {p.unit}
                      </span>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Actions pour ${p.name}`}>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => {
                              setEditing(p);
                              setDialogOpen(true);
                            }}
                          >
                            <Pencil className="h-4 w-4" /> Modifier
                          </DropdownMenuItem>
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

      {/* Dialog produit */}
      <Dialog open={dialogOpen} onOpenChange={(v) => !v && setDialogOpen(false)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Modifier le produit" : "Nouveau produit"}</DialogTitle>
            <DialogDescription>
              Produit du catalogue (sanitaire, plomberie, luminaire…).
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="p-name">Nom du produit *</Label>
              <Input
                id="p-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ex : Mitigeur lavabo chromé"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="p-ref">Référence</Label>
                <Input
                  id="p-ref"
                  value={form.reference}
                  onChange={(e) => setForm({ ...form, reference: e.target.value })}
                  placeholder="SAN-WC-001"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Catégorie *</Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                  <SelectTrigger aria-label="Choisir la catégorie">
                    <SelectValue placeholder="Choisir…" />
                  </SelectTrigger>
                  <SelectContent className="max-h-64">
                    {PRODUCT_CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {CATEGORY_LABELS[c]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="p-pp">Prix d&apos;achat (FCFA)</Label>
                <Input
                  id="p-pp"
                  type="number"
                  min="0"
                  value={form.purchasePrice}
                  onChange={(e) => setForm({ ...form, purchasePrice: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="p-sp">Prix de vente (FCFA)</Label>
                <Input
                  id="p-sp"
                  type="number"
                  min="0"
                  value={form.salePrice}
                  onChange={(e) => setForm({ ...form, salePrice: e.target.value })}
                />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="p-stock">Stock</Label>
                <Input
                  id="p-stock"
                  type="number"
                  min="0"
                  value={form.stock}
                  onChange={(e) => setForm({ ...form, stock: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Unité</Label>
                <Select value={form.unit} onValueChange={(v) => setForm({ ...form, unit: v })}>
                  <SelectTrigger aria-label="Unité">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {UNITS.map((u) => (
                      <SelectItem key={u} value={u}>
                        {u}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="p-min">Seuil alerte</Label>
                <Input
                  id="p-min"
                  type="number"
                  min="0"
                  value={form.minStock}
                  onChange={(e) => setForm({ ...form, minStock: e.target.value })}
                />
              </div>
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
            <DialogTitle>Supprimer le produit ?</DialogTitle>
            <DialogDescription>
              {deleting && `« ${deleting.name} » sera retiré du catalogue de façon définitive.`}
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
