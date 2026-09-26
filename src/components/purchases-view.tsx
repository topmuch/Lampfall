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
import { ConfirmPage, PageOverlay } from "@/components/page-overlay";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { authFetch } from "@/lib/auth-client";
import { formatDate, formatMoney, toISODate } from "@/lib/constants";
import type { Product, Purchase, Supplier } from "@/lib/types";
import {
  DraftItem,
  ItemsEditor,
  emptyItem,
  itemToApi,
} from "@/components/items-editor";
import { buildPurchasePDF, openPDF } from "@/lib/pdf";

interface FormState {
  supplier: string;
  supplierId: string; // « » = fournisseur libre
  date: string;
  notes: string;
  updateStock: boolean;
  items: DraftItem[];
}

/** L'API renvoie aussi fileStored (nom interne du fichier stocké), absent du type Purchase. */
type PurchaseRow = Purchase & { fileStored?: string | null };

export function PurchasesView() {
  const { toast } = useToast();
  const [q, setQ] = useState("");
  const debouncedQ = useDebouncedValue(q);
  const { data: purchases, loading, refetch } = useFetch<PurchaseRow[]>(
    `/api/purchases${debouncedQ ? `?q=${encodeURIComponent(debouncedQ)}` : ""}`
  );
  const { data: products } = useFetch<Product[]>("/api/products");
  const { data: suppliers, refetch: refetchSuppliers } = useFetch<Supplier[]>("/api/suppliers");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<FormState>({
    supplier: "",
    supplierId: "",
    date: toISODate(new Date()),
    notes: "",
    updateStock: true,
    items: [emptyItem()],
  });
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<Purchase | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Mini-dialog « nouveau fournisseur » (répertoire)
  const [newSupOpen, setNewSupOpen] = useState(false);
  const [newSup, setNewSup] = useState({ name: "", phone: "" });
  const [newSupBusy, setNewSupBusy] = useState(false);

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
      if (form.supplierId) formData.set("supplierId", form.supplierId);
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
        supplierId: "",
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

  // Création rapide d'un fournisseur depuis le dialog d'achat
  const submitNewSupplier = async () => {
    if (!newSup.name.trim()) {
      toast({
        title: "Nom obligatoire",
        description: "Saisissez le nom du fournisseur.",
        variant: "destructive",
      });
      return;
    }
    setNewSupBusy(true);
    try {
      const res = await authFetch("/api/suppliers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newSup.name.trim(),
          phone: newSup.phone.trim() || null,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error ?? "Création impossible");
      toast({ title: "Fournisseur créé", description: newSup.name.trim() });
      await refetchSuppliers();
      if (json?.id) {
        setForm((f) => ({
          ...f,
          supplierId: json.id as string,
          supplier: (json.name as string) ?? newSup.name.trim(),
        }));
      }
      setNewSupOpen(false);
      setNewSup({ name: "", phone: "" });
    } catch (e) {
      toast({
        title: "Erreur",
        description: e instanceof Error ? e.message : "Erreur inconnue",
        variant: "destructive",
      });
    } finally {
      setNewSupBusy(false);
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
              supplierId: "",
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

      {/* Page nouvel achat */}
      <PageOverlay
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title="Nouvelle facture d'achat"
        description="Enregistrez l'achat et joignez éventuellement le scan de la facture (PDF ou image)."
        actions={
          <>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              Annuler
            </Button>
            <Button onClick={submit} disabled={saving} className="min-w-32">
              {saving ? "Enregistrement…" : "Enregistrer"}
            </Button>
          </>
        }
      >
          <div className="grid gap-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="pu-supplier-dir">Fournisseur (répertoire)</Label>
                <div className="flex gap-2">
                  <Select
                    value={form.supplierId || "free"}
                    onValueChange={(v) => {
                      const id = v === "free" ? "" : v;
                      const found = (suppliers ?? []).find((s) => s.id === id);
                      setForm((f) => ({
                        ...f,
                        supplierId: id,
                        supplier: found ? found.name : "",
                      }));
                    }}
                  >
                    <SelectTrigger
                      id="pu-supplier-dir"
                      className="w-full"
                      aria-label="Choisir un fournisseur du répertoire"
                    >
                      <SelectValue placeholder="— Fournisseur libre —" />
                    </SelectTrigger>
                    <SelectContent className="max-h-64">
                      <SelectItem value="free">— Fournisseur libre —</SelectItem>
                      {(suppliers ?? []).map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="shrink-0 h-11 sm:h-9"
                    onClick={() => {
                      setNewSup({ name: "", phone: "" });
                      setNewSupOpen(true);
                    }}
                  >
                    <Plus className="h-4 w-4" />
                    <span className="hidden sm:inline">Nouveau</span>
                  </Button>
                </div>
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

            <div className="space-y-1.5">
              <Label htmlFor="pu-supplier">Fournisseur (nom libre) *</Label>
              <Input
                id="pu-supplier"
                value={form.supplier}
                onChange={(e) => setForm({ ...form, supplier: e.target.value })}
                placeholder="Ex : SOTRA Import"
              />
              {form.supplierId && (
                <p className="text-xs text-muted-foreground">
                  Fournisseur lié au répertoire — le nom est prérempli et modifiable.
                </p>
              )}
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
      </PageOverlay>

      {/* Page confirmation suppression */}
      <ConfirmPage
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        onConfirm={doDelete}
        title="Supprimer la facture d'achat ?"
        description={
          deleting &&
          `L'achat ${deleting.number} (${formatMoney(deleting.total)}) et sa pièce jointe seront définitivement supprimés.`
        }
        confirmLabel="Supprimer"
        destructive
        icon={<Trash2 className="h-6 w-6 text-destructive" aria-hidden />}
      />

      {/* Page nouveau fournisseur (répertoire) */}
      <PageOverlay
        open={newSupOpen}
        onClose={() => setNewSupOpen(false)}
        title="Nouveau fournisseur"
        description="Ajoutez le fournisseur au répertoire : il sera présélectionné pour cet achat."
        actions={
          <Button onClick={submitNewSupplier} disabled={newSupBusy || !newSup.name.trim()} className="min-w-24">
            {newSupBusy ? "Création…" : "Créer"}
          </Button>
        }
        maxWidth="max-w-2xl"
      >
          <div className="grid gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ns-name">Nom *</Label>
              <Input
                id="ns-name"
                value={newSup.name}
                onChange={(e) => setNewSup((s) => ({ ...s, name: e.target.value }))}
                placeholder="Ex : SOTRA Import"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ns-phone">Téléphone</Label>
              <Input
                id="ns-phone"
                value={newSup.phone}
                onChange={(e) => setNewSup((s) => ({ ...s, phone: e.target.value }))}
                placeholder="77 000 00 00"
              />
            </div>
          </div>
      </PageOverlay>
    </div>
  );
}
