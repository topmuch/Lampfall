"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
import {
  AlertTriangle,
  FolderPlus,
  ImagePlus,
  MoreHorizontal,
  Package,
  Pencil,
  Plus,
  Search,
  Tags,
  Trash2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useDebouncedValue, useFetch } from "@/hooks/use-fetch";
import { formatMoney } from "@/lib/constants";
import type { Product } from "@/lib/types";
import { CategoryBadge } from "@/components/status-badges";
import { useCategories } from "@/components/categories-provider";

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
  image: string; // data-URL (« » = aucune)
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
  image: "",
};

/** Redimensionne une image choisie en data-URL JPEG (max 640px, ~100 Ko) */
function fileToDataUrl(file: File, maxSize = 640): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Lecture du fichier impossible"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Fichier image invalide"));
      img.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Canvas indisponible"));
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", 0.82));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

export function ProductsView() {
  const { toast } = useToast();
  const { categories, refetch: refetchCategories } = useCategories();
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const debouncedQ = useDebouncedValue(q);

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (debouncedQ) params.set("q", debouncedQ);
    if (category && category !== "all") params.set("category", category);
    return params.toString();
  }, [debouncedQ, category]);

  const { data: products, loading, refetch } = useFetch<Product[]>(`/api/products?${query}`);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<Product | null>(null);
  const [imageBusy, setImageBusy] = useState(false);

  // Gestion des catégories
  const [catDialogOpen, setCatDialogOpen] = useState(false);
  const [newCategoryLabel, setNewCategoryLabel] = useState("");
  const [catBusy, setCatBusy] = useState(false);
  const [catToDelete, setCatToDelete] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

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
              image: editing.image ?? "",
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
          image: form.image || null,
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
      refetchCategories();
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
      refetchCategories();
    } catch (e) {
      toast({
        title: "Erreur",
        description: e instanceof Error ? e.message : "Erreur inconnue",
        variant: "destructive",
      });
    }
  };

  const onPickImage = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({
        title: "Fichier invalide",
        description: "Choisissez une image (JPG, PNG, WebP…).",
        variant: "destructive",
      });
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      toast({
        title: "Image trop lourde",
        description: "Taille maximale : 8 Mo.",
        variant: "destructive",
      });
      return;
    }
    setImageBusy(true);
    try {
      const dataUrl = await fileToDataUrl(file);
      setForm((f) => ({ ...f, image: dataUrl }));
    } catch (e) {
      toast({
        title: "Erreur",
        description: e instanceof Error ? e.message : "Image illisible",
        variant: "destructive",
      });
    } finally {
      setImageBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const createCategory = async () => {
    const label = newCategoryLabel.trim();
    if (!label) {
      toast({ title: "Saisissez un libellé de catégorie", variant: "destructive" });
      return;
    }
    setCatBusy(true);
    try {
      const res = await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Création impossible");
      toast({ title: "Catégorie créée", description: json.label });
      setNewCategoryLabel("");
      await refetchCategories();
    } catch (e) {
      toast({
        title: "Erreur",
        description: e instanceof Error ? e.message : "Erreur inconnue",
        variant: "destructive",
      });
    } finally {
      setCatBusy(false);
    }
  };

  const doDeleteCategory = async () => {
    if (!catToDelete) return;
    setCatBusy(true);
    try {
      const res = await fetch(`/api/categories/${encodeURIComponent(catToDelete)}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Suppression impossible");
      toast({ title: "Catégorie supprimée" });
      if (category === catToDelete) setCategory("");
      if (form.category === catToDelete) setForm((f) => ({ ...f, category: "" }));
      setCatToDelete(null);
      await refetchCategories();
    } catch (e) {
      toast({
        title: "Erreur",
        description: e instanceof Error ? e.message : "Erreur inconnue",
        variant: "destructive",
      });
    } finally {
      setCatBusy(false);
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
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => setCatDialogOpen(true)}>
            <Tags className="h-4 w-4" /> Catégories
          </Button>
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
          <Select value={category || "all"} onValueChange={(v) => setCategory(v === "all" ? "" : v)}>
            <SelectTrigger className="w-full sm:w-56" aria-label="Filtrer par catégorie">
              <SelectValue placeholder="Toutes les catégories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes les catégories</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c.code} value={c.code}>
                  {c.label}
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
                      <div className="flex items-center gap-2.5">
                        {p.image ? (
                          <img
                            src={p.image}
                            alt={`Photo de ${p.name}`}
                            className="h-10 w-10 rounded-md object-cover border shrink-0"
                          />
                        ) : (
                          <span className="h-10 w-10 rounded-md border bg-muted/50 flex items-center justify-center shrink-0">
                            <ImagePlus className="h-4 w-4 text-muted-foreground" />
                          </span>
                        )}
                        <div className="min-w-0">
                          <div className="font-medium truncate max-w-52" title={p.name}>
                            {p.name}
                          </div>
                          {p.reference && (
                            <div className="text-xs text-muted-foreground">{p.reference}</div>
                          )}
                        </div>
                      </div>
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
            {/* Image du produit */}
            <div className="space-y-1.5">
              <Label>Photo du produit</Label>
              <div className="flex items-center gap-3">
                {form.image ? (
                  <img
                    src={form.image}
                    alt="Aperçu du produit"
                    className="h-20 w-20 rounded-lg object-cover border"
                  />
                ) : (
                  <span className="h-20 w-20 rounded-lg border border-dashed bg-muted/40 flex items-center justify-center">
                    <ImagePlus className="h-6 w-6 text-muted-foreground" />
                  </span>
                )}
                <div className="space-y-1.5">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => onPickImage(e.target.files?.[0])}
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={imageBusy}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <ImagePlus className="h-4 w-4" />
                    {imageBusy ? "Traitement…" : "Choisir une image"}
                  </Button>
                  {form.image && (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:text-destructive"
                      onClick={() => setForm((f) => ({ ...f, image: "" }))}
                    >
                      <Trash2 className="h-4 w-4" /> Retirer
                    </Button>
                  )}
                  <p className="text-[11px] text-muted-foreground">JPG, PNG… (max 8 Mo)</p>
                </div>
              </div>
            </div>

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
                    {categories.map((c) => (
                      <SelectItem key={c.code} value={c.code}>
                        {c.label}
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

      {/* Dialog gestion des catégories */}
      <Dialog open={catDialogOpen} onOpenChange={(v) => !v && setCatDialogOpen(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Tags className="h-5 w-5 text-primary" /> Gestion des catégories
            </DialogTitle>
            <DialogDescription>
              Créez une nouvelle catégorie ou supprimez une catégorie vide.
            </DialogDescription>
          </DialogHeader>

          <div className="flex gap-2">
            <Input
              value={newCategoryLabel}
              onChange={(e) => setNewCategoryLabel(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && createCategory()}
              placeholder="Ex : Carrelage"
              aria-label="Nom de la nouvelle catégorie"
            />
            <Button onClick={createCategory} disabled={catBusy || !newCategoryLabel.trim()}>
              <FolderPlus className="h-4 w-4" /> Créer
            </Button>
          </div>

          <div className="rounded-md border max-h-72 overflow-y-auto">
            <ul className="divide-y">
              {categories.map((c) => (
                <li key={c.code} className="flex items-center justify-between gap-2 px-3 py-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{c.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {c.productCount === 1
                        ? "1 produit"
                        : `${c.productCount ?? 0} produits`}
                    </p>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0"
                    onClick={() => setCatToDelete(c.code)}
                    aria-label={`Supprimer la catégorie ${c.label}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirmation suppression catégorie */}
      <Dialog open={catToDelete !== null} onOpenChange={(v) => !v && setCatToDelete(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Supprimer la catégorie ?</DialogTitle>
            <DialogDescription>
              La suppression échouera si des produits utilisent encore cette catégorie.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCatToDelete(null)}>
              Annuler
            </Button>
            <Button variant="destructive" onClick={doDeleteCategory} disabled={catBusy}>
              {catBusy ? "Suppression…" : "Supprimer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmation suppression produit */}
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
