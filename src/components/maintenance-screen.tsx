"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import Image from "next/image";
import { Wrench, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Settings } from "@/lib/types";

/** Écart calendaire (années / mois / jours) entre deux dates — sans approximations. */
export function elapsedCalendar(since: Date, now: Date): { years: number; months: number; days: number } {
  let years = now.getFullYear() - since.getFullYear();
  let months = now.getMonth() - since.getMonth();
  let days = now.getDate() - since.getDate();
  if (days < 0) {
    months -= 1;
    days += new Date(now.getFullYear(), now.getMonth(), 0).getDate(); // jours du mois précédent
  }
  if (months < 0) {
    years -= 1;
    months += 12;
  }
  return { years, months, days };
}

function Box({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex min-w-24 flex-col items-center gap-1 rounded-2xl border border-white/15 bg-white/5 px-5 py-4 backdrop-blur-sm sm:min-w-28">
      <span className="text-3xl font-black tabular-nums text-white sm:text-4xl" aria-hidden>
        {value}
      </span>
      <span className="sr-only">{value}</span>
      <span className="text-[11px] font-semibold uppercase tracking-widest text-amber-300/90">{label}</span>
    </div>
  );
}

function plural(n: number, s: string) {
  return `${n} ${s}${n > 1 ? "s" : ""}`;
}

interface MaintenanceScreenProps {
  settings: Settings | null;
  /** Appelé quand la maintenance est désactivée ailleurs (polling toutes les 45 s). */
  onRelease: () => void;
  /** Affiché si fourni (avant connexion) : accès discret à l'espace administrateur. */
  onAdminAccess?: () => void;
}

export function MaintenanceScreen({ settings, onRelease, onAdminAccess }: MaintenanceScreenProps) {
  const active = settings?.maintenanceActive === true;
  const since = settings?.maintenanceSince ? new Date(settings.maintenanceSince) : null;
  // Évite tout décalage d'hydratation : le compteur n'apparaît qu'après montage client
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );
  const [now, setNow] = useState(() => new Date());

  // Horloge du compteur : mise à jour every 30 s (le compteur est en jours/mois/années)
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  // Libération automatique : si la maintenance est désactivée ailleurs, on rafraîchit
  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    const check = async () => {
      try {
        const res = await fetch("/api/settings", { cache: "no-store" });
        if (!cancelled && res.ok) {
          const s = (await res.json()) as Settings;
          if (s.maintenanceActive === false) onRelease();
        }
      } catch {
        /* silencieux */
      }
    };
    const id = setInterval(check, 45_000);
    void check();
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [active, onRelease]);

  const e = mounted && since ? elapsedCalendar(since, now) : null;
  const sinceLabel = since
    ? since.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
    : "";

  return (
    <div
      className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-[#0b2e1d] via-[#0f3d26] to-[#071f13] px-4 py-10 text-white"
      role="status"
      aria-live="polite"
    >
      {/* Halos décoratifs */}
      <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-emerald-500/10 blur-3xl" aria-hidden />
      <div className="pointer-events-none absolute -bottom-24 -right-24 h-96 w-96 rounded-full bg-amber-400/10 blur-3xl" aria-hidden />
      <div className="pointer-events-none absolute inset-0 opacity-[0.04]" aria-hidden>
        <div className="h-full w-full" style={{ backgroundImage: "radial-gradient(circle, #fff 1px, transparent 1px)", backgroundSize: "28px 28px" }} />
      </div>

      <div className="relative z-10 flex w-full max-w-xl flex-col items-center gap-7 text-center">
        {/* Logo de la société */}
        <div className="flex h-28 w-28 items-center justify-center rounded-3xl border border-white/20 bg-white/95 p-2 shadow-2xl shadow-black/40">
          {settings?.logo ? (
            <img src={settings.logo} alt={`Logo ${settings.nomSociete ?? ""}`} className="h-full w-full object-contain" />
          ) : (
            <Image src="/logo-green.png" alt="Logo de la société" width={96} height={96} className="h-full w-full object-contain" />
          )}
        </div>

        <div className="space-y-2">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-amber-300">
            {settings?.nomSociete ?? "ETS LAMP FALL"}
          </p>
          <h1 className="flex flex-wrap items-center justify-center gap-3 text-3xl font-black sm:text-4xl">
            <Wrench className="h-8 w-8 animate-pulse text-amber-300" aria-hidden />
            Maintenance en cours
          </h1>
          <p className="text-sm leading-relaxed text-white/70 sm:text-base">
            {settings?.tagline ?? "Notre application est momentanément indisponible."}
            <br />
            Nous revenons très rapidement. Merci de votre compréhension.
          </p>
        </div>

        {/* Compteur jours / mois / années */}
        {e && (
          <div className="flex flex-col items-center gap-2">
            <div className="flex items-center justify-center gap-3 sm:gap-4">
              <Box value={e.days} label={e.days > 1 ? "Jours" : "Jour"} />
              <Box value={e.months} label={e.months > 1 ? "Mois" : "Mois"} />
              <Box value={e.years} label={e.years > 1 ? "Années" : "Année"} />
            </div>
            {sinceLabel && (
              <p className="text-xs text-white/50">depuis le {sinceLabel}</p>
            )}
          </div>
        )}

        {onAdminAccess && (
          <Button
            variant="outline"
            size="sm"
            onClick={onAdminAccess}
            className="border-white/25 bg-white/5 text-white/80 hover:bg-white/15 hover:text-white"
          >
            <LogIn className="h-4 w-4" aria-hidden />
            Espace administrateur
          </Button>
        )}

        <p className="absolute -bottom-2 left-0 right-0 translate-y-full text-[11px] text-white/40 sm:static sm:translate-y-0">
          {settings?.telephone ? `Contact : ${settings.telephone} · ` : ""}
          {settings?.email ?? ""}
        </p>
      </div>
    </div>
  );
}

/** Petit compteur compact réutilisé dans Paramètres (état actif). */
export function MaintenanceMiniCounter({ since }: { since: string }) {
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);
  if (!mounted) return null;
  const e = elapsedCalendar(new Date(since), now);
  return (
    <span className="text-sm font-semibold tabular-nums text-amber-600 dark:text-amber-400">
      {plural(e.years, "année")} · {plural(e.months, "mois")} · {plural(e.days, "jour")}
    </span>
  );
}
