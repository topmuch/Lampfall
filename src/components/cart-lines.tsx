"use client";

/**
 * CartLines — panier de la facture type « caisse » (POS).
 *
 * Chaque article est une carte lisible avec :
 *  - désignation modifiable (articles libres) ;
 *  - compteur de quantité − / + (plus besoin de taper) ;
 *  - prix unitaire modifiable et total de ligne ;
 *  - suppression en un geste.
 *
 * Utilisé par : facture de vente, proforma, facture fournisseur.
 */

import { Minus, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatMoney } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { DraftItem } from "@/components/items-editor";

interface CartLinesProps {
  items: DraftItem[];
  onChange: (items: DraftItem[]) => void;
  disabled?: boolean;
}

export function CartLines({ items, onChange, disabled = false }: CartLinesProps) {
  const update = (index: number, patch: Partial<DraftItem>) =>
    onChange(items.map((it, i) => (i === index ? { ...it, ...patch } : it)));

  const step = (index: number, delta: number) => {
    const current = Number(items[index].quantity) || 0;
    const next = Math.max(1, current + delta);
    update(index, { quantity: String(next) });
  };

  const remove = (index: number) => onChange(items.filter((_, i) => i !== index));

  if (items.length === 0) {
    return (
      <div className="flex min-h-28 items-center justify-center rounded-xl border border-dashed p-6 text-center">
        <p className="text-sm text-muted-foreground">
          Aucun article — touchez un produit du catalogue pour l&apos;ajouter.
        </p>
      </div>
    );
  }

  return (
    <ul className="grid gap-2" aria-label="Articles de la facture">
      {items.map((it, idx) => {
        const qty = Number(it.quantity) || 0;
        const price = Number(it.unitPrice) || 0;
        const total = qty * price;
        return (
          <li
            key={idx}
            className="rounded-xl border bg-card p-2.5 shadow-sm"
            aria-label={`Article ${idx + 1} : ${it.productName || "libre"}`}
          >
            {/* Ligne 1 : désignation + suppression */}
            <div className="flex items-center gap-2">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-muted text-[10px] font-bold text-muted-foreground" aria-hidden>
                {idx + 1}
              </span>
              <Input
                value={it.productName}
                onChange={(e) => update(idx, { productName: e.target.value })}
                placeholder="Article libre — saisissez le nom…"
                aria-label="Désignation de l'article"
                disabled={disabled}
                className={cn(
                  "h-8 border-0 bg-transparent px-1 font-semibold shadow-none focus-visible:bg-background focus-visible:border",
                  it.productId && "text-[15px]"
                )}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                onClick={() => remove(idx)}
                disabled={disabled}
                aria-label={`Supprimer l'article ${it.productName || idx + 1}`}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>

            {/* Ligne 2 : quantité × prix = total */}
            <div className="mt-1.5 flex items-center gap-2 pl-7">
              {/* Compteur quantité */}
              <div className="flex items-center rounded-lg border bg-background">
                <button
                  type="button"
                  onClick={() => step(idx, -1)}
                  disabled={disabled || qty <= 1}
                  aria-label="Diminuer la quantité"
                  className="flex h-8 w-8 items-center justify-center rounded-l-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-40"
                >
                  <Minus className="h-3.5 w-3.5" aria-hidden />
                </button>
                <Input
                  type="number"
                  min="1"
                  step="1"
                  value={it.quantity}
                  onChange={(e) => update(idx, { quantity: e.target.value })}
                  disabled={disabled}
                  aria-label="Quantité"
                  className="h-8 w-12 border-0 bg-transparent px-0 text-center font-bold tabular-nums shadow-none [appearance:textfield] focus-visible:bg-background [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                />
                <button
                  type="button"
                  onClick={() => step(idx, +1)}
                  disabled={disabled}
                  aria-label="Augmenter la quantité"
                  className="flex h-8 w-8 items-center justify-center rounded-r-lg text-muted-foreground transition-colors hover:bg-primary hover:text-primary-foreground"
                >
                  <Plus className="h-3.5 w-3.5" aria-hidden />
                </button>
              </div>

              <Input
                value={it.unit}
                onChange={(e) => update(idx, { unit: e.target.value })}
                disabled={disabled}
                aria-label="Unité"
                placeholder="unité"
                className="h-8 w-16 shrink-0 px-2 text-xs"
              />

              <span className="text-muted-foreground" aria-hidden>×</span>

              <Input
                type="number"
                min="0"
                step="25"
                value={it.unitPrice}
                onChange={(e) => update(idx, { unitPrice: e.target.value })}
                disabled={disabled}
                aria-label="Prix unitaire"
                className="h-8 min-w-0 flex-1 border-0 bg-transparent text-right tabular-nums shadow-none focus-visible:border focus-visible:bg-background"
              />

              <span
                className="w-24 shrink-0 text-right text-sm font-bold tabular-nums"
                aria-label="Total de la ligne"
              >
                {formatMoney(total)}
              </span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
