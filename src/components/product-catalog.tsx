"use client";

/**
 * ProductCatalog — catalogue visible type « caisse » (POS).
 *
 * Remplace la recherche par liste déroulante : les produits s'affichent
 * en cartes cliquables, filtrables par catégorie. Un clic ajoute le
 * produit au panier de la facture (ou incrémente sa quantité).
 *
 * Utilisé par : facture de vente, proforma, facture fournisseur.
 */

import { useEffect, useMemo, useState } from "react";
import { PackagePlus, PackageSearch, Plus, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CATEGORY_LABELS, formatMoney } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { Product } from "@/lib/types";

interface ProductCatalogProps {
  products: Product[];
  /** Champ du prix à afficher : vente ou achat (facture fournisseur). */
  priceField?: "salePrice" | "purchasePrice";
  /** Appelé quand on touche une carte produit (ajout / incrément panier). */
  onPick: (product: Product) => void;
  /** Ouvre la création rapide de produit avec le terme recherché. */
  onCreateProduct?: (searchTerm: string) => void;
  disabled?: boolean;
}

export function ProductCatalog({
  products,
  priceField = "salePrice",
  onPick,
  onCreateProduct,
  disabled = false,
}: ProductCatalogProps) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("ALL");
  const [categories, setCategories] = useState<{ code: string; label: string }[]>([]);

  // Catégories : API d'abord, repli statique ensuite
  useEffect(() => {
    let cancelled = false;
    (async () => {
      let list: { code: string; label: string }[] = [];
      try {
        const res = await fetch("/api/categories");
        if (res.ok) list = await res.json();
      } catch {
        /* repli ci-dessous */
      }
      if (!cancelled && list.length === 0) {
        list = Object.entries(CATEGORY_LABELS).map(([code, label]) => ({ code, label }));
      }
      if (!cancelled) setCategories(list);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Catégories réellement présentes dans le catalogue (avec compte)
  const usedCategories = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of products) counts.set(p.category, (counts.get(p.category) ?? 0) + 1);
    const known = categories
      .filter((c) => counts.has(c.code))
      .map((c) => ({ ...c, count: counts.get(c.code)! }));
    // Catégories inconnues du référentiel (sécurité)
    for (const code of counts.keys()) {
      if (!known.some((k) => k.code === code)) {
        known.push({ code, label: CATEGORY_LABELS[code] ?? code, count: counts.get(code)! });
      }
    }
    return known;
  }, [products, categories]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return [...products]
      .filter((p) => (category === "ALL" ? true : p.category === category))
      .filter(
        (p) =>
          !q ||
          p.name.toLowerCase().includes(q) ||
          (p.reference ?? "").toLowerCase().includes(q)
      )
      .sort((a, b) => a.name.localeCompare(b.name, "fr"));
  }, [products, category, search]);

  const exactExists = useMemo(
    () => products.some((p) => p.name.toLowerCase() === search.trim().toLowerCase()),
    [products, search]
  );

  return (
    <div className="flex h-full flex-col gap-3">
      {/* Recherche */}
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher un produit…"
          aria-label="Rechercher un produit dans le catalogue"
          className="h-11 pl-9 pr-9 text-base"
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch("")}
            aria-label="Effacer la recherche"
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            ✕
          </button>
        )}
      </div>

      {/* Filtres par catégorie (chips défilantes) */}
      {usedCategories.length > 1 && (
        <div
          className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1"
          role="tablist"
          aria-label="Filtrer par catégorie"
        >
          <button
            type="button"
            role="tab"
            aria-selected={category === "ALL"}
            onClick={() => setCategory("ALL")}
            className={cn(
              "shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
              category === "ALL"
                ? "border-primary bg-primary text-primary-foreground"
                : "bg-card text-muted-foreground hover:bg-accent hover:text-foreground"
            )}
          >
            Tous ({products.length})
          </button>
          {usedCategories.map((c) => (
            <button
              key={c.code}
              type="button"
              role="tab"
              aria-selected={category === c.code}
              onClick={() => setCategory(c.code)}
              className={cn(
                "shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
                category === c.code
                  ? "border-primary bg-primary text-primary-foreground"
                  : "bg-card text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
            >
              {c.label} ({c.count})
            </button>
          ))}
        </div>
      )}

      {/* Grille de cartes produits */}
      <div className="min-h-40 flex-1 overflow-y-auto pb-2 pr-0.5" data-catalog-grid>
        {filtered.length === 0 ? (
          <div className="flex h-full min-h-40 flex-col items-center justify-center gap-3 rounded-xl border border-dashed p-6 text-center">
            <PackageSearch className="h-8 w-8 text-muted-foreground/60" aria-hidden />
            <p className="text-sm text-muted-foreground">
              Aucun produit{search.trim() ? ` pour « ${search.trim()} »` : ""}.
            </p>
            {onCreateProduct && search.trim() && !exactExists && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5 border-dashed border-primary/50 font-semibold text-primary hover:bg-primary/5 hover:text-primary"
                onClick={() => onCreateProduct(search.trim())}
              >
                <PackagePlus className="h-4 w-4" aria-hidden />
                Créer « {search.trim()} »
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
            {filtered.map((p) => {
              const price = priceField === "purchasePrice" ? p.purchasePrice : p.salePrice;
              const rupture = p.stock <= 0;
              const bas = !rupture && p.stock <= (p.minStock ?? 0);
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => onPick(p)}
                  disabled={disabled}
                  aria-label={`Ajouter ${p.name} au panier`}
                  className="group relative flex flex-col gap-1 rounded-xl border bg-card p-3 text-left transition-all hover:border-primary/60 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.98] disabled:opacity-50"
                >
                  {/* Bouton + visible au survol / toujours sur mobile */}
                  <span
                    className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm transition-transform group-hover:scale-110"
                    aria-hidden
                  >
                    <Plus className="h-4 w-4" />
                  </span>
                  <span className="line-clamp-2 min-h-9 pr-7 text-sm font-semibold leading-snug">
                    {p.name}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {CATEGORY_LABELS[p.category] ?? p.category}
                  </span>
                  <span className="mt-auto flex items-end justify-between gap-1 pt-1">
                    <span className="text-sm font-bold tabular-nums text-primary">
                      {formatMoney(price)}
                    </span>
                    <span
                      className={cn(
                        "rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                        rupture
                          ? "bg-destructive/10 text-destructive"
                          : bas
                            ? "bg-amber-500/15 text-amber-700 dark:text-amber-400"
                            : "bg-muted text-muted-foreground"
                      )}
                    >
                      {rupture ? "Rupture" : `Stock ${p.stock}`}
                    </span>
                  </span>
                </button>
              );
            })}

            {/* Créer un produit — carte en fin de grille */}
            {onCreateProduct && (
              <button
                type="button"
                onClick={() => onCreateProduct(search.trim())}
                disabled={disabled}
                className="flex min-h-24 flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-primary/50 p-3 text-primary transition-colors hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="Créer un nouveau produit"
              >
                <PackagePlus className="h-5 w-5" aria-hidden />
                <span className="text-xs font-semibold">Créer un produit</span>
                {search.trim() && (
                  <span className="line-clamp-1 text-[10px] text-muted-foreground">
                    « {search.trim()} »
                  </span>
                )}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
