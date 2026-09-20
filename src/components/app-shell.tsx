"use client";

import { useState, useSyncExternalStore } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  Building2,
  ClipboardList,
  FileSignature,
  FileText,
  LayoutDashboard,
  Menu,
  Package,
  ShoppingBag,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { COMPANY } from "@/lib/constants";
import { CategoriesProvider } from "@/components/categories-provider";
import { DashboardView } from "@/components/dashboard-view";
import { InvoicesView } from "@/components/invoices-view";
import { ClientsView } from "@/components/clients-view";
import { ProductsView } from "@/components/products-view";
import { PurchasesView } from "@/components/purchases-view";
import { OrdersView } from "@/components/orders-view";
import { ImmoView } from "@/components/immo-view";

type ViewId =
  | "dashboard"
  | "factures"
  | "proforma"
  | "commandes"
  | "achats"
  | "clients"
  | "produits"
  | "immo";

const NAV: { id: ViewId; label: string; short: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "dashboard", label: "Tableau de bord", short: "Tableau", icon: LayoutDashboard },
  { id: "factures", label: "Factures", short: "Factures", icon: FileText },
  { id: "proforma", label: "Factures proforma", short: "Proforma", icon: FileSignature },
  { id: "commandes", label: "Commandes prévisionnelles", short: "Commandes", icon: ClipboardList },
  { id: "achats", label: "Factures d'achat", short: "Achats", icon: ShoppingBag },
  { id: "clients", label: "Clients", short: "Clients", icon: Users },
  { id: "produits", label: "Produits & stock", short: "Produits", icon: Package },
  { id: "immo", label: "Immobilier — Loyers", short: "Immo", icon: Building2 },
];

function NavItems({
  active,
  onSelect,
  className,
}: {
  active: ViewId;
  onSelect: (id: ViewId) => void;
  className?: string;
}) {
  return (
    <nav className={cn("space-y-1", className)} aria-label="Navigation principale">
      {NAV.map((item) => {
        const Icon = item.icon;
        const isActive = active === item.id;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelect(item.id)}
            className={cn(
              "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors text-left",
              isActive
                ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
                : "text-sidebar-foreground/85 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            )}
            aria-current={isActive ? "page" : undefined}
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span className="truncate">{item.short}</span>
          </button>
        );
      })}
    </nav>
  );
}

export function AppShell() {
  const [view, setView] = useState<ViewId>("dashboard");
  const [mobileOpen, setMobileOpen] = useState(false);
  // Évite la mismatch d'ID Radix (useId) entre SSR et client au premier rendu
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

  const select = (id: ViewId) => {
    setView(id);
    setMobileOpen(false);
    window.scrollTo({ top: 0 });
  };

  return (
    <CategoriesProvider>
      <div className="min-h-screen flex flex-col">
      {/* Header mobile */}
      <header className="lg:hidden sticky top-0 z-40 flex items-center justify-between gap-2 border-b bg-sidebar px-4 py-3 text-sidebar-foreground">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="rounded-lg bg-white p-1 shrink-0">
            <Image src="/logo.png" alt="Logo ETS LAMP FALL" width={32} height={28} className="h-7 w-auto" />
          </div>
          <div className="min-w-0">
            <p className="font-bold text-sm leading-tight truncate">ETS LAMP FALL</p>
            <p className="text-[10px] text-sidebar-foreground/70 truncate">Facturation</p>
          </div>
        </div>
        {mounted && (
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="text-sidebar-foreground hover:bg-sidebar-accent"
                aria-label="Ouvrir le menu"
              >
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="bg-sidebar text-sidebar-foreground border-sidebar-border w-64 p-4">
              <SheetTitle className="sr-only">Menu de navigation</SheetTitle>
              <div className="flex items-center gap-2.5 mb-5">
                <div className="rounded-lg bg-white p-1">
                  <Image src="/logo.png" alt="" width={36} height={31} className="h-8 w-auto" />
                </div>
                <div>
                  <p className="font-bold text-sm">ETS LAMP FALL</p>
                  <p className="text-[10px] opacity-70">{COMPANY.tagline}</p>
                </div>
              </div>
              <NavItems active={view} onSelect={select} />
            </SheetContent>
          </Sheet>
        )}
      </header>

      <div className="flex flex-1">
        {/* Sidebar desktop */}
        <aside className="hidden lg:flex w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
          <div className="flex items-center gap-3 px-4 py-5">
            <div className="rounded-xl bg-white p-1.5 shrink-0">
              <Image src="/logo.png" alt="Logo ETS LAMP FALL" width={44} height={38} className="h-10 w-auto" />
            </div>
            <div className="min-w-0">
              <p className="font-bold text-sm leading-tight">ETS LAMP FALL</p>
              <p className="text-[10px] text-sidebar-foreground/70 leading-tight mt-0.5">
                {COMPANY.tagline}
              </p>
            </div>
          </div>
          <div className="px-3 pb-4">
            <NavItems active={view} onSelect={select} />
          </div>
          <div className="mt-auto px-4 py-4 border-t border-sidebar-border text-[11px] text-sidebar-foreground/60">
            <p>{COMPANY.phone}</p>
            <p className="truncate">{COMPANY.email}</p>
          </div>
        </aside>

        {/* Contenu */}
        <main className="flex-1 min-w-0 bg-background">
          <div className="mx-auto max-w-6xl px-3 sm:px-6 py-5 sm:py-7 pb-10">
            {view === "dashboard" && <DashboardView />}
            {view === "factures" && <InvoicesView type="VENTE" />}
            {view === "proforma" && <InvoicesView type="PROFORMA" />}
            {view === "commandes" && <OrdersView />}
            {view === "achats" && <PurchasesView />}
            {view === "clients" && <ClientsView />}
            {view === "produits" && <ProductsView />}
            {view === "immo" && <ImmoView />}
          </div>
        </main>
      </div>

      {/* Footer collant */}
      <footer className="mt-auto border-t bg-sidebar text-sidebar-foreground/75">
        <div className="mx-auto max-w-6xl px-4 py-3.5 flex flex-col sm:flex-row items-center justify-between gap-1.5 text-xs">
          <p className="font-semibold text-sidebar-foreground">
            © {new Date().getFullYear()} ETS LAMP FALL — {COMPANY.tagline}
          </p>
          <p className="flex flex-wrap items-center justify-center gap-x-3 gap-y-0.5">
            <span>{COMPANY.address}</span>
            <span aria-hidden>•</span>
            <span>{COMPANY.phone}</span>
          </p>
        </div>
      </footer>
      </div>
    </CategoriesProvider>
  );
}
