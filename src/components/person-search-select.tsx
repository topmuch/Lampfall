"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, Search, UserPlus, Check, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/* ─── Barre de recherche client / fournisseur ──────────────────────────────
 * VRAIE barre de recherche toujours visible (et non un bouton déroulant) :
 * un champ de saisie filtre les noms en direct (insensible à la casse ET
 * aux accents — « ali » trouve « Alioune », « sène » trouve « Sène »),
 * la recherche porte aussi sur le téléphone (hint).
 *
 * Comportement :
 *   - champ de recherche focus/typé → liste déroulante de résultats dessous ;
 *   - sélection → puce « Client sélectionné » avec croix pour désélectionner ;
 *   - `freeOption`   : choix « — Client libre — » (value "") dans la liste ;
 *   - `createAction` : entrée « Créer … » en bas de liste, pré-remplie avec
 *     le terme saisi ;
 *   - navigation clavier : flèches haut/bas, Entrée pour valider, Échap.
 * ──────────────────────────────────────────────────────────────────────────── */

export interface SearchSelectItem {
  id: string;
  name: string;
  /** Information secondaire (ex : téléphone) affichée dans la liste. */
  hint?: string;
}

interface SearchSelectProps {
  items: SearchSelectItem[];
  /** id sélectionné — "" si aucun (et si freeOption.value === ""). */
  value: string;
  onChange: (id: string) => void;
  /** Placeholder du champ (fallback si searchPlaceholder absent). */
  placeholder?: string;
  /** Placeholder du champ de recherche. */
  searchPlaceholder?: string;
  ariaLabel: string;
  emptyMessage?: string;
  /** Choix « libre » (désélection) — value "" recommandé. */
  freeOption?: { value: string; label: string };
  /** Entrée de création rapide en bas de liste (reçoit le terme recherché). */
  createAction?: { label: string; icon?: "user" | "plus"; onSelect: (search: string) => void };
  disabled?: boolean;
}

/** Normalisation ASCII française : minuscules, sans accents, espaces comprimés. */
function normalizeFr(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

type RowKind = "free" | "item" | "create";
interface Row {
  kind: RowKind;
  key: string;
  item?: SearchSelectItem;
}

export function SearchSelect({
  items,
  value,
  onChange,
  placeholder,
  searchPlaceholder,
  ariaLabel,
  emptyMessage = "Aucun résultat",
  freeOption,
  createAction,
  disabled = false,
}: SearchSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [hi, setHi] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  /** Filtre local insensible à la casse/accents, sur le nom ET l'indice (téléphone). */
  const filtered = useMemo(() => {
    const q = normalizeFr(search);
    if (!q) return items;
    return items.filter(
      (it) =>
        normalizeFr(it.name).includes(q) ||
        (it.hint ? normalizeFr(it.hint).includes(q) : false),
    );
  }, [items, search]);

  const selected = items.find((it) => it.id === value) ?? null;
  const isFree = freeOption !== undefined && value === freeOption.value;

  /** Lignes aplaties de la liste déroulante (pour la navigation clavier). */
  const rows = useMemo<Row[]>(() => {
    const r: Row[] = [];
    if (freeOption) r.push({ kind: "free", key: "__free__" });
    for (const it of filtered) r.push({ kind: "item", key: it.id, item: it });
    if (createAction) r.push({ kind: "create", key: "__create__" });
    return r;
  }, [filtered, freeOption, createAction]);

  // Le terme de recherche (ou les items) change → repart du haut de la liste.
  // (réinitialisation de state dérivé pendant le rendu — pattern React)
  const navKey = `${search}|${items.length}`;
  const [lastNavKey, setLastNavKey] = useState(navKey);
  if (lastNavKey !== navKey) {
    setLastNavKey(navKey);
    setHi(0);
  }

  // Fermeture au clic extérieur.
  useEffect(() => {
    if (!open) return;
    const onDocMouseDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, [open]);

  // Garde la ligne surlignée visible.
  useEffect(() => {
    if (!open || !listRef.current) return;
    const el = listRef.current.querySelector<HTMLElement>(
      `[data-row-index="${hi}"]`,
    );
    el?.scrollIntoView({ block: "nearest" });
  }, [hi, open]);

  const pick = (id: string) => {
    onChange(id);
    setOpen(false);
    setSearch("");
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      const n = rows.length;
      if (!n) return;
      setHi((h) =>
        e.key === "ArrowDown" ? (h + 1) % n : (h - 1 + n) % n,
      );
    } else if (e.key === "Enter") {
      if (!open) return;
      e.preventDefault();
      const row = rows[hi];
      if (!row) return;
      if (row.kind === "free") pick(freeOption!.value);
      else if (row.kind === "item") pick(row.key);
      else {
        setOpen(false);
        setSearch("");
        createAction!.onSelect(search.trim());
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  const rowProps = (index: number) => ({
    "data-row-index": index,
    onMouseDown: (e: React.MouseEvent) => e.preventDefault(),
    className: cn(
      "flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left text-sm outline-none transition-colors",
      index === hi ? "bg-accent text-accent-foreground" : "hover:bg-accent/60",
    ),
  });

  const freeIndex = freeOption ? 0 : -1;
  const itemsStart = freeOption ? 1 : 0;
  const createIndex = itemsStart + filtered.length;

  return (
    <div ref={rootRef} className="relative">
      {/* ── Barre de recherche toujours visible ── */}
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-label={ariaLabel}
          autoComplete="off"
          disabled={disabled}
          className="h-9 pl-9 pr-9"
          placeholder={searchPlaceholder ?? placeholder ?? "Rechercher…"}
          value={search}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setSearch(e.target.value);
            setOpen(true);
          }}
          onKeyDown={onKeyDown}
        />
        {search && !disabled && (
          <button
            type="button"
            aria-label="Effacer la recherche"
            className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-sm text-muted-foreground transition-colors hover:text-foreground"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setSearch("")}
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        )}
      </div>

      {/* ── Sélection courante (puce avec croix) ── */}
      {(selected || isFree) && (
        <div className="mt-2 flex items-center justify-between gap-2 rounded-md border bg-muted/40 px-3 py-1.5 text-sm">
          <span className="flex min-w-0 items-center gap-2">
            <Check className="h-4 w-4 shrink-0 text-primary" aria-hidden />
            <span
              className={cn(
                "min-w-0 truncate font-medium",
                isFree && "font-normal text-muted-foreground",
              )}
            >
              {selected ? selected.name : freeOption?.label}
            </span>
            {selected?.hint && (
              <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                {selected.hint}
              </span>
            )}
          </span>
          {!disabled && (
            <button
              type="button"
              aria-label="Désélectionner"
              className="shrink-0 rounded-sm text-muted-foreground transition-colors hover:text-foreground"
              onClick={() => onChange(freeOption?.value ?? "")}
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          )}
        </div>
      )}

      {/* ── Liste déroulante de résultats ── */}
      {open && !disabled && (
        <div
          ref={listRef}
          role="listbox"
          aria-label={ariaLabel}
          className="absolute left-0 right-0 z-50 mt-1 max-h-64 overflow-y-auto rounded-md border bg-popover text-popover-foreground shadow-md"
        >
          {/* Choix libre (désélection) */}
          {freeOption && (
            <button
              type="button"
              role="option"
              aria-selected={isFree}
              {...rowProps(freeIndex)}
              onClick={() => pick(freeOption.value)}
            >
              <Check
                className={cn(
                  "h-4 w-4 shrink-0",
                  isFree ? "opacity-100" : "opacity-0",
                )}
                aria-hidden
              />
              <span className="truncate text-muted-foreground">
                {freeOption.label}
              </span>
            </button>
          )}

          {/* Résultats filtrés */}
          {filtered.map((it, i) => {
            const active = it.id === value;
            return (
              <button
                key={it.id}
                type="button"
                role="option"
                aria-selected={active}
                {...rowProps(itemsStart + i)}
                onClick={() => pick(it.id)}
              >
                <Check
                  className={cn(
                    "h-4 w-4 shrink-0",
                    active ? "opacity-100" : "opacity-0",
                  )}
                  aria-hidden
                />
                <span className="min-w-0 flex-1 truncate font-medium">
                  {it.name}
                </span>
                {it.hint && (
                  <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                    {it.hint}
                  </span>
                )}
              </button>
            );
          })}

          {/* Aucun résultat */}
          {filtered.length === 0 && (
            <div className="px-3 py-4 text-center text-sm text-muted-foreground">
              {emptyMessage}
              {search.trim() ? ` pour « ${search.trim()} »` : ""}.
            </div>
          )}

          {/* Création rapide */}
          {createAction && (
            <>
              <div className="my-1 h-px bg-border" role="separator" />
              <button
                type="button"
                role="option"
                aria-selected={false}
                {...rowProps(createIndex)}
                onClick={() => {
                  setOpen(false);
                  setSearch("");
                  createAction.onSelect(search.trim());
                }}
                className={cn(rowProps(createIndex).className, "text-primary")}
              >
                {createAction.icon === "plus" ? (
                  <Plus className="h-4 w-4 shrink-0" aria-hidden />
                ) : (
                  <UserPlus className="h-4 w-4 shrink-0" aria-hidden />
                )}
                <span className="truncate">
                  {createAction.label}
                  {search.trim() ? ` « ${search.trim()} »` : ""}…
                </span>
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
