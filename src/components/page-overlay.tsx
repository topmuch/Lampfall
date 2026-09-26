"use client";

/**
 * PageOverlay — ouverture en PAGE plein écran (remplace les modales).
 *
 * Tout le système ouvre désormais les formulaires, éditeurs, détails et
 * confirmations dans des pages plein écran avec une barre supérieure
 * collante (bouton retour + titre + actions) — comme une vraie page.
 *
 * - Empilement automatique : la touche Échap ferme uniquement la page du dessus.
 * - Verrouillage du défilement de la page sous-jacente.
 * - Animation d'entrée type navigation (glissement depuis la droite).
 */

import { useEffect, useRef } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/* ─── Pile des pages ouvertes (pour Échap : fermer seulement la dernière) ── */

type CloseHandler = () => void;
const pageStack: CloseHandler[] = [];

function pushPage(close: CloseHandler) {
  pageStack.push(close);
}

function removePage(close: CloseHandler) {
  const idx = pageStack.lastIndexOf(close);
  if (idx >= 0) pageStack.splice(idx, 1);
}

/* ─── PageOverlay ────────────────────────────────────────────────────────── */

export interface PageOverlayProps {
  open: boolean;
  onClose: () => void;
  /** Titre de la page (en-tête). */
  title: React.ReactNode;
  /** Sous-titre descriptif (optionnel). */
  description?: React.ReactNode;
  /** Actions à droite de l'en-tête (bouton Enregistrer, etc.). */
  actions?: React.ReactNode;
  /** Contenu de la page. */
  children: React.ReactNode;
  /** Largeur maximale du contenu (Tailwind). */
  maxWidth?: string;
  /** Texte du bouton retour pour les lecteurs d'écran. */
  backLabel?: string;
}

export function PageOverlay({
  open,
  onClose,
  title,
  description,
  actions,
  children,
  maxWidth = "max-w-6xl",
  backLabel = "Retour",
}: PageOverlayProps) {
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  // Échap : ferme uniquement la page au sommet de la pile
  useEffect(() => {
    if (!open) return;
    const handler = () => closeRef.current();
    pushPage(handler);
    return () => removePage(handler);
  }, [open]);

  // Écouteur global unique (monté par la première PageOverlay)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const top = pageStack[pageStack.length - 1];
      if (top) {
        e.stopPropagation();
        top();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // Verrouille le défilement de la page sous-jacente
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-background animate-in fade-in slide-in-from-right-4 duration-200"
      role="dialog"
      aria-modal="true"
    >
      {/* Barre supérieure collante */}
      <header className="sticky top-0 z-10 border-b border-border/70 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className={cn("mx-auto flex items-center justify-between gap-3 px-4 py-3", maxWidth)}>
          <div className="flex min-w-0 items-center gap-3">
            <Button
              variant="outline"
              size="icon"
              onClick={onClose}
              aria-label={backLabel}
              className="shrink-0"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden />
            </Button>
            <div className="min-w-0">
              <h1 className="truncate text-base font-bold sm:text-lg">{title}</h1>
              {description ? (
                <p className="hidden text-xs text-muted-foreground sm:block">{description}</p>
              ) : null}
            </div>
          </div>
          {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
        </div>
      </header>

      {/* Contenu */}
      <div className={cn("mx-auto px-4 py-5 pb-12", maxWidth)}>{children}</div>
    </div>
  );
}

/* ─── ConfirmPage — confirmation en page plein écran ────────────────────── */

export interface ConfirmPageProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Bouton de confirmation rouge (action destructive). */
  destructive?: boolean;
  /** Affiche un spinner et bloque les boutons. */
  busy?: boolean;
  busyLabel?: string;
  /** Message d'erreur affiché sous la description. */
  error?: React.ReactNode;
  /** Icône d'illustration (optionnel). */
  icon?: React.ReactNode;
}

export function ConfirmPage({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Confirmer",
  cancelLabel = "Annuler",
  destructive = false,
  busy = false,
  busyLabel,
  error,
  icon,
}: ConfirmPageProps) {
  return (
    <PageOverlay
      open={open}
      onClose={onClose}
      title={title}
      maxWidth="max-w-xl"
      backLabel={cancelLabel}
    >
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="w-full max-w-md rounded-xl border bg-card p-6 text-center shadow-sm">
          {icon ? (
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              {icon}
            </div>
          ) : null}
          <h2 className="text-lg font-bold">{title}</h2>
          {description ? (
            <div className="mt-2 text-sm text-muted-foreground">{description}</div>
          ) : null}
          {error ? (
            <div
              role="alert"
              className="mt-3 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {error}
            </div>
          ) : null}
          <div className="mt-6 flex items-center justify-center gap-3">
            <Button variant="outline" onClick={onClose} disabled={busy}>
              {cancelLabel}
            </Button>
            <Button
              variant={destructive ? "destructive" : "default"}
              onClick={onConfirm}
              disabled={busy}
              className="min-w-28"
            >
              {busy ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  {busyLabel ?? "…"}
                </>
              ) : (
                confirmLabel
              )}
            </Button>
          </div>
        </div>
      </div>
    </PageOverlay>
  );
}
