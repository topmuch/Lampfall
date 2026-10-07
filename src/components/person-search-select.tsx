"use client";

import { useMemo, useState } from "react";
import { Plus, Search, UserPlus, Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";

/* ─── Combobox de recherche client / fournisseur ────────────────────────────
 * Barre de recherche réutilisable pour les écrans de création
 * (nouvelle facture, proforma, commande, facture d'achat…) : au lieu d'une
 * liste déroulante plate, un champ de saisie filtre les noms en direct
 * (insensible à la casse ET aux accents — « ali » trouve « Alioune »).
 *
 * Mêmes conventions visuelles que la recherche de produits de
 * items-editor.tsx (icône loupe + chevrons, popover ancré au déclencheur).
 *
 *   - `freeOption`      : choix « — Client libre — » / « — Fournisseur libre — »
 *                         (value "") — rend possible la désélection.
 *   - `createAction`    : entrée « Créer … » en bas de liste, pré-remplie
 *                         avec le terme recherché.
 *   - `hint`            : information secondaire affichée à droite (téléphone…).
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
  /** Texte du bouton fermé quand rien n'est sélectionné. */
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

export function SearchSelect({
  items,
  value,
  onChange,
  placeholder = "Rechercher…",
  searchPlaceholder = "Rechercher…",
  ariaLabel,
  emptyMessage = "Aucun résultat",
  freeOption,
  createAction,
  disabled = false,
}: SearchSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

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

  const pick = (id: string) => {
    onChange(id);
    setOpen(false);
    setSearch("");
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label={ariaLabel}
          disabled={disabled}
          className="h-9 w-full justify-between gap-2 px-3 font-normal"
        >
          <span className="flex min-w-0 items-center gap-2">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            <span
              className={cn(
                "min-w-0 truncate",
                selected || isFree ? "" : "text-muted-foreground"
              )}
            >
              {selected ? selected.name : isFree ? freeOption.label : placeholder}
            </span>
          </span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={searchPlaceholder}
            value={search}
            onValueChange={setSearch}
            autoFocus
          />
          <CommandList className="max-h-64">
            <CommandEmpty>
              {emptyMessage}
              {search.trim() ? ` pour « ${search.trim()} »` : ""}.
            </CommandEmpty>

            {/* Choix libre (désélection) */}
            {freeOption && (
              <>
                <CommandGroup>
                  <CommandItem
                    value="__free__"
                    onSelect={() => pick(freeOption.value)}
                    className="cursor-pointer"
                  >
                    <Check
                      className={cn(
                        "h-4 w-4 shrink-0",
                        isFree ? "opacity-100" : "opacity-0"
                      )}
                      aria-hidden
                    />
                    <span className="text-muted-foreground">{freeOption.label}</span>
                  </CommandItem>
                </CommandGroup>
                {filtered.length > 0 && <CommandSeparator />}
              </>
            )}

            {/* Résultats filtrés */}
            {filtered.length > 0 && (
              <CommandGroup>
                {filtered.map((it) => {
                  const active = it.id === value;
                  return (
                    <CommandItem
                      key={it.id}
                      value={it.id}
                      onSelect={() => pick(it.id)}
                      className="cursor-pointer"
                    >
                      <Check
                        className={cn(
                          "h-4 w-4 shrink-0",
                          active ? "opacity-100" : "opacity-0"
                        )}
                        aria-hidden
                      />
                      <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
                        <span className="min-w-0 truncate font-medium">{it.name}</span>
                        {it.hint && (
                          <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                            {it.hint}
                          </span>
                        )}
                      </div>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            )}

            {/* Création rapide */}
            {createAction && (
              <>
                <CommandSeparator />
                <CommandGroup>
                  <CommandItem
                    value="__create__"
                    onSelect={() => {
                      setOpen(false);
                      setSearch("");
                      createAction.onSelect(search.trim());
                    }}
                    className="cursor-pointer text-primary"
                  >
                    {createAction.icon === "plus" ? (
                      <Plus className="h-4 w-4" aria-hidden />
                    ) : (
                      <UserPlus className="h-4 w-4" aria-hidden />
                    )}
                    {createAction.label}
                    {search.trim() ? ` « ${search.trim()} »` : ""}…
                  </CommandItem>
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
