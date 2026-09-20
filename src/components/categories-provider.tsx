"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { CATEGORY_LABELS, PRODUCT_CATEGORIES } from "@/lib/constants";
import type { CategoryWithCount } from "@/lib/types";

interface CategoriesContextValue {
  categories: CategoryWithCount[];
  labels: Record<string, string>;
  loading: boolean;
  refetch: () => Promise<void>;
}

const CategoriesContext = createContext<CategoriesContextValue>({
  categories: [],
  labels: CATEGORY_LABELS,
  loading: false,
  refetch: async () => {},
});

export function CategoriesProvider({ children }: { children: React.ReactNode }) {
  const [categories, setCategories] = useState<CategoryWithCount[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    try {
      const res = await fetch("/api/categories");
      if (res.ok) setCategories(await res.json());
    } catch {
      /* silencieux : le repli statique reste utilisé */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  const labels = useMemo(() => {
    const map: Record<string, string> = { ...CATEGORY_LABELS };
    for (const c of categories) map[c.code] = c.label;
    return map;
  }, [categories]);

  // Repli statique si la base n'a pas encore été initialisée
  const effective =
    categories.length > 0
      ? categories
      : PRODUCT_CATEGORIES.map((code) => ({
          id: code,
          code,
          label: CATEGORY_LABELS[code] ?? code,
          createdAt: "",
          productCount: 0,
        }));

  return (
    <CategoriesContext.Provider value={{ categories: effective, labels, loading, refetch }}>
      {children}
    </CategoriesContext.Provider>
  );
}

export function useCategories(): CategoriesContextValue {
  return useContext(CategoriesContext);
}

/** Libellé joliment formaté d'un code catégorie inconnu */
export function prettifyCode(code: string): string {
  const lower = code.toLowerCase().replace(/_/g, " ");
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}
