"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Loader2,
  Upload,
} from "lucide-react";
import { CATEGORY_LABELS, PRODUCT_CATEGORIES } from "@/lib/constants";
import { cn } from "@/lib/utils";

/* ─── Utilitaires ───────────────────────────────────────────────────────── */

/** Normalise un en-tête : minuscules, sans accents, sans espaces superflus. */
function normHeader(s: string): string {
  return s
    .toString()
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\s._-]+/g, "");
}

/** Correspondances possibles pour chaque champ (en-têtes normalisés). */
const HEADER_ALIASES: Record<string, string[]> = {
  name: ["nom", "produit", "designation", "name", "article", "libelle"],
  reference: ["reference", "ref", "sku", "code"],
  category: ["categorie", "category", "rayon", "famille"],
  purchasePrice: ["prixachat", "prixachatfcfa", "achat", "purchaseprice", "pa", "coutachat"],
  salePrice: ["prixvente", "prixventefcfa", "vente", "saleprice", "pv", "prix"],
  stock: ["stock", "quantite", "quantity", "qte", "inventaire"],
  unit: ["unite", "unit", "unitemesure", "mesure"],
  minStock: ["stockmin", "stockminimum", "minstock", "min", "seuil"],
};

interface ParsedRow {
  index: number;
  values: Record<string, string>;
  error: string | null;
}

interface CategoryLite {
  code: string;
  label: string;
}

function resolveCategory(
  raw: string,
  categories: CategoryLite[]
): { code: string | null; matched: boolean } {
  const q = normHeader(raw);
  if (!q) return { code: null, matched: false };
  const byCode = categories.find((c) => normHeader(c.code) === q);
  if (byCode) return { code: byCode.code, matched: true };
  const byLabel = categories.find((c) => normHeader(c.label) === q);
  if (byLabel) return { code: byLabel.code, matched: true };
  // correspondance partielle (ex. « sanitaire » vs « sanitaire-bain »)
  const partial = categories.find(
    (c) => normHeader(c.label).includes(q) || normHeader(c.code).includes(q)
  );
  if (partial) return { code: partial.code, matched: true };
  return { code: null, matched: false };
}

/** Parse un fichier Excel/CSV en lignes d'objets. */
async function parseSpreadsheet(file: File): Promise<Record<string, string>[]> {
  const XLSX = await import("xlsx");
  const isCsv = /\.csv$/i.test(file.name);
  let wb;
  if (isCsv) {
    const text = await file.text();
    wb = XLSX.read(text, { type: "string", raw: false });
  } else {
    const buffer = await file.arrayBuffer();
    wb = XLSX.read(buffer, { type: "array" });
  }
  const sheet = wb.Sheets[wb.SheetNames[0]];
  if (!sheet) return [];
  return XLSX.utils.sheet_to_json<Record<string, string>>(sheet, {
    defval: "",
    raw: false,
  });
}

function downloadTemplate() {
  const rows = [
    ["Nom", "Référence", "Catégorie", "Prix achat", "Prix vente", "Stock", "Unité", "Stock min"],
    ["Robinet mélangeur", "ROB-001", "SANITAIRE", "12000", "15000", "10", "pièce", "3"],
    ["Câble électrique 2.5mm", "CAB-025", "ELECTRICITE", "800", "1200", "100", "m", "20"],
    ["Ampoule LED 12W", "LED-012", "LUMINAIRE", "900", "1500", "50", "pièce", "10"],
  ];
  const csv = rows.map((r) => r.map((c) => `"${c}"`).join(";")).join("\n");
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "modele-import-produits.csv";
  a.click();
  URL.revokeObjectURL(url);
}

/* ─── Dialogue principal ────────────────────────────────────────────────── */

export function ProductImportDialog({
  open,
  onOpenChange,
  onImported,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onImported: () => void;
}) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [categories, setCategories] = useState<CategoryLite[]>([]);
  const [defaultCategory, setDefaultCategory] = useState("");
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [results, setResults] = useState<{ ok: number; failed: number } | null>(null);

  // Réinitialisation à l'ouverture (ajustement de state pendant le rendu — pattern React)
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setFileName("");
      setRows([]);
      setResults(null);
      setProgress({ done: 0, total: 0 });
    }
  }

  // Catégories disponibles
  useEffect(() => {
    if (!open) return;
    (async () => {
      let list: CategoryLite[] = [];
      try {
        const res = await fetch("/api/categories");
        if (res.ok) list = await res.json();
      } catch {
        /* repli statique */
      }
      if (list.length === 0) {
        list = PRODUCT_CATEGORIES.map((code) => ({
          code,
          label: CATEGORY_LABELS[code] ?? code,
        }));
      }
      setCategories(list);
      setDefaultCategory(list[0]?.code ?? "");
    })();
  }, [open]);

  // Réinitialisation à l'ouverture (gérée ci-dessus pendant le rendu)

  const handleFile = async (file: File) => {
    setResults(null);
    try {
      const raw = await parseSpreadsheet(file);
      if (raw.length === 0) {
        toast({
          title: "Fichier vide",
          description: "Aucune ligne de données n'a été trouvée dans le fichier.",
          variant: "destructive",
        });
        return;
      }
      // Mapping des en-têtes (première ligne)
      const keys = Object.keys(raw[0]);
      const mapping: Record<string, string> = {};
      for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
        const found = keys.find((k) => aliases.includes(normHeader(k)));
        if (found) mapping[field] = found;
      }
      if (!mapping.name) {
        toast({
          title: "Colonne « Nom » introuvable",
          description:
            "Le fichier doit contenir une colonne Nom (ou Désignation / Produit). Téléchargez le modèle pour un exemple.",
          variant: "destructive",
        });
        return;
      }

      const parsed: ParsedRow[] = raw.map((r, i) => {
        const get = (field: string) => (mapping[field] ? (r[mapping[field]] ?? "").toString().trim() : "");
        const name = get("name");
        const catRaw = get("category");
        const error =
          !name
            ? "Nom manquant"
            : catRaw && !resolveCategory(catRaw, categories).matched && !defaultCategory
              ? "Catégorie inconnue"
              : null;
        return {
          index: i + 1,
          values: {
            name,
            reference: get("reference"),
            category: catRaw,
            purchasePrice: get("purchasePrice").replace(/[^\d.,-]/g, "").replace(",", "."),
            salePrice: get("salePrice").replace(/[^\d.,-]/g, "").replace(",", "."),
            stock: get("stock").replace(/[^\d.,-]/g, "").replace(",", "."),
            unit: get("unit") || "pièce",
            minStock: get("minStock").replace(/[^\d.,-]/g, "").replace(",", "."),
          },
          error: name ? error : "Nom manquant",
        };
      });
      setRows(parsed);
      setFileName(file.name);
    } catch {
      toast({
        title: "Fichier illisible",
        description: "Formats acceptés : .xlsx, .xls ou .csv.",
        variant: "destructive",
      });
    }
  };

  const validRows = useMemo(() => rows.filter((r) => !r.error), [rows]);
  const errorCount = rows.length - validRows.length;

  const runImport = async () => {
    if (validRows.length === 0) return;
    setImporting(true);
    setResults(null);
    let ok = 0;
    let failed = 0;
    setProgress({ done: 0, total: validRows.length });
    for (const row of validRows) {
      const resolved = resolveCategory(row.values.category, categories);
      try {
        const res = await fetch("/api/products", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: row.values.name,
            reference: row.values.reference || null,
            category: resolved.code ?? defaultCategory,
            purchasePrice: Number(row.values.purchasePrice) || 0,
            salePrice: Number(row.values.salePrice) || 0,
            stock: Number(row.values.stock) || 0,
            unit: row.values.unit || "pièce",
            minStock: Number(row.values.minStock) || 0,
          }),
        });
        if (res.ok) ok += 1;
        else failed += 1;
      } catch {
        failed += 1;
      }
      setProgress((p) => ({ ...p, done: p.done + 1 }));
    }
    setResults({ ok, failed });
    setImporting(false);
    toast({
      title: "Import terminé",
      description: `${ok} produit(s) importé(s)${failed ? `, ${failed} échec(s)` : ""}.`,
      variant: failed ? "destructive" : "default",
    });
    if (ok > 0) onImported();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-4 w-4 text-primary" aria-hidden />
            Importer des produits (Excel / CSV)
          </DialogTitle>
          <DialogDescription>
            Chargez un fichier .xlsx, .xls ou .csv. Colonnes attendues : Nom, Référence,
            Catégorie, Prix achat, Prix vente, Stock, Unité, Stock min. Seule la colonne{" "}
            <strong>Nom</strong> est obligatoire.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          {/* Zone de dépôt / sélection */}
          <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
            <div className="space-y-1.5">
              <Label htmlFor="import-file">Fichier</Label>
              <Input
                id="import-file"
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void handleFile(f);
                }}
                disabled={importing}
              />
            </div>
            <Button variant="outline" onClick={downloadTemplate} className="gap-1.5">
              <Download className="h-4 w-4" aria-hidden /> Modèle CSV
            </Button>
          </div>

          {fileName && (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <FileSpreadsheet className="h-3.5 w-3.5" aria-hidden />
              {fileName} — {rows.length} ligne(s) détectée(s), {validRows.length} valide(s)
              {errorCount > 0 && (
                <Badge variant="destructive" className="ml-1 gap-1">
                  <AlertTriangle className="h-3 w-3" aria-hidden /> {errorCount} erreur(s)
                </Badge>
              )}
            </p>
          )}

          {/* Catégorie par défaut */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Catégorie si vide / inconnue</Label>
              <Select value={defaultCategory} onValueChange={setDefaultCategory}>
                <SelectTrigger aria-label="Catégorie par défaut">
                  <SelectValue placeholder="Choisir…" />
                </SelectTrigger>
                <SelectContent className="max-h-56">
                  {categories.map((c) => (
                    <SelectItem key={c.code} value={c.code}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <p className="self-end pb-1 text-xs text-muted-foreground">
              Les stocks initiaux sont enregistrés automatiquement comme mouvements d&apos;entrée.
            </p>
          </div>

          {/* Aperçu */}
          {rows.length > 0 && (
            <div className="rounded-md border">
              <ScrollArea className="max-h-56">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-muted/80 backdrop-blur">
                    <tr className="text-left text-muted-foreground">
                      <th className="p-2 font-medium w-10">#</th>
                      <th className="p-2 font-medium">Nom</th>
                      <th className="p-2 font-medium">Catégorie</th>
                      <th className="p-2 font-medium text-right">Prix vente</th>
                      <th className="p-2 font-medium text-right">Stock</th>
                      <th className="p-2 font-medium">État</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr
                        key={r.index}
                        className={cn(
                          "border-t",
                          r.error && "bg-destructive/5 text-destructive"
                        )}
                      >
                        <td className="p-2 tabular-nums text-muted-foreground">{r.index}</td>
                        <td className="p-2 font-medium">{r.values.name || "—"}</td>
                        <td className="p-2">
                          {resolveCategory(r.values.category, categories).code ??
                            (r.values.category ? "⚠️" : defaultCategory)}
                        </td>
                        <td className="p-2 text-right tabular-nums">{r.values.salePrice || "0"}</td>
                        <td className="p-2 text-right tabular-nums">{r.values.stock || "0"}</td>
                        <td className="p-2">
                          {r.error ? (
                            <span className="inline-flex items-center gap-1 text-destructive">
                              <AlertTriangle className="h-3 w-3" aria-hidden /> {r.error}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-green-700 dark:text-green-400">
                              <CheckCircle2 className="h-3 w-3" aria-hidden /> OK
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ScrollArea>
            </div>
          )}

          {/* Résultat */}
          {results && (
            <p className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800 dark:border-green-900 dark:bg-green-950/40 dark:text-green-300">
              ✅ {results.ok} produit(s) créé(s)
              {results.failed ? ` — ❌ ${results.failed} échec(s)` : ""}.
            </p>
          )}
        </div>

        <DialogFooter className="items-center gap-2">
          {importing && (
            <span className="mr-auto flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Import… {progress.done}/{progress.total}
            </span>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={importing}>
            Fermer
          </Button>
          <Button onClick={runImport} disabled={importing || validRows.length === 0}>
            {importing ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Upload className="h-4 w-4" aria-hidden />
            )}
            Importer {validRows.length > 0 ? `${validRows.length} produit(s)` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
