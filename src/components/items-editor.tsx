"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Trash2 } from "lucide-react";
import { formatMoney } from "@/lib/constants";
import type { Product } from "@/lib/types";

export interface DraftItem {
  productId: string | null;
  productName: string;
  category: string | null;
  unit: string;
  quantity: string;
  unitPrice: string;
}

export function emptyItem(): DraftItem {
  return {
    productId: null,
    productName: "",
    category: null,
    unit: "pièce",
    quantity: "1",
    unitPrice: "0",
  };
}

export function itemToApi(item: DraftItem) {
  return {
    productId: item.productId,
    productName: item.productName.trim() || "Article",
    category: item.category,
    unit: item.unit,
    quantity: Number(item.quantity) || 0,
    unitPrice: Number(item.unitPrice) || 0,
  };
}

interface ItemsEditorProps {
  items: DraftItem[];
  onChange: (items: DraftItem[]) => void;
  products: Product[];
  priceField?: "salePrice" | "purchasePrice";
  disabled?: boolean;
}

export function ItemsEditor({
  items,
  onChange,
  products,
  priceField = "salePrice",
  disabled = false,
}: ItemsEditorProps) {
  const update = (index: number, patch: Partial<DraftItem>) => {
    onChange(items.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  };

  const addFromCatalog = (productId: string) => {
    const product = products.find((p) => p.id === productId);
    if (!product) return;
    onChange([
      ...items,
      {
        productId: product.id,
        productName: product.name,
        category: product.category,
        unit: product.unit,
        quantity: "1",
        unitPrice: String(product[priceField]),
      },
    ]);
  };

  const lineTotal = (it: DraftItem) =>
    (Number(it.quantity) || 0) * (Number(it.unitPrice) || 0);

  return (
    <div className="space-y-2">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Select onValueChange={addFromCatalog} value="" disabled={disabled}>
          <SelectTrigger className="w-full sm:w-[340px]" aria-label="Ajouter un produit du catalogue">
            <SelectValue placeholder="＋ Ajouter depuis le catalogue…" />
          </SelectTrigger>
          <SelectContent className="max-h-72">
            {products.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name} — {formatMoney(p[priceField])}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground">
          ou saisissez un article libre ci-dessous
        </span>
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground border border-dashed rounded-md p-4 text-center">
          Aucun article. Ajoutez un produit du catalogue ou un article libre.
        </p>
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead>
              <tr className="border-b bg-muted/60 text-left text-xs text-muted-foreground">
                <th className="p-2 font-medium">Désignation</th>
                <th className="p-2 font-medium w-20">Qté</th>
                <th className="p-2 font-medium w-24">Unité</th>
                <th className="p-2 font-medium w-28">Prix unitaire</th>
                <th className="p-2 font-medium w-28 text-right">Total</th>
                <th className="p-2 w-10" aria-label="Supprimer" />
              </tr>
            </thead>
            <tbody>
              {items.map((it, idx) => (
                <tr key={idx} className="border-b last:border-0">
                  <td className="p-1.5">
                    <Input
                      value={it.productName}
                      onChange={(e) => update(idx, { productName: e.target.value })}
                      placeholder="Nom de l'article"
                      className="h-8"
                      disabled={disabled}
                      aria-label="Désignation de l'article"
                    />
                  </td>
                  <td className="p-1.5">
                    <Input
                      type="number"
                      min="0"
                      step="1"
                      value={it.quantity}
                      onChange={(e) => update(idx, { quantity: e.target.value })}
                      className="h-8"
                      disabled={disabled}
                      aria-label="Quantité"
                    />
                  </td>
                  <td className="p-1.5">
                    <Input
                      value={it.unit}
                      onChange={(e) => update(idx, { unit: e.target.value })}
                      className="h-8"
                      disabled={disabled}
                      aria-label="Unité"
                    />
                  </td>
                  <td className="p-1.5">
                    <Input
                      type="number"
                      min="0"
                      step="25"
                      value={it.unitPrice}
                      onChange={(e) => update(idx, { unitPrice: e.target.value })}
                      className="h-8 text-right"
                      disabled={disabled}
                      aria-label="Prix unitaire"
                    />
                  </td>
                  <td className="p-1.5 text-right font-medium tabular-nums whitespace-nowrap">
                    {formatMoney(lineTotal(it))}
                  </td>
                  <td className="p-1.5">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => onChange(items.filter((_, i) => i !== idx))}
                      disabled={disabled}
                      aria-label={`Supprimer l'article ${it.productName || idx + 1}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
