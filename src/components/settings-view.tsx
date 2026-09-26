"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ConfirmPage } from "@/components/page-overlay";
import {
  AlertTriangle,
  ArchiveRestore,
  Building2,
  DatabaseBackup,
  ImagePlus,
  Loader2,
  Power,
  Save,
  Trash2,
  Wrench,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { authFetch } from "@/lib/auth-client";
import { invalidateCompanyCache } from "@/lib/pdf";
import { MaintenanceMiniCounter } from "@/components/maintenance-screen";
import { useSettingsStore } from "@/lib/settings-store";
import type { Settings } from "@/lib/types";

/** Redimensionne une image en data-URL JPEG (max 512px) pour le logo. */
async function fileToDataUrl(file: File, max = 512): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas indisponible");
  ctx.drawImage(bitmap, 0, 0, w, h);
  return canvas.toDataURL("image/jpeg", 0.9);
}

export function SettingsView() {
  const { toast } = useToast();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Sauvegarde & restauration
  const restoreFileRef = useRef<HTMLInputElement>(null);
  const [backupBusy, setBackupBusy] = useState(false);
  const [restoreBusy, setRestoreBusy] = useState(false);
  const [restoreData, setRestoreData] = useState<unknown>(null);
  const [restoreFileName, setRestoreFileName] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [maintenanceBusy, setMaintenanceBusy] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/settings");
        if (!res.ok) throw new Error();
        setSettings(await res.json());
      } catch {
        toast({ title: "Impossible de charger les paramètres", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    })();
     
  }, []);

  const save = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      const res = await authFetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Erreur d'enregistrement");
      setSettings(json);
      // Rafraîchit les stores/caches : shell + PDF
      useSettingsStore.getState().setSettings(json);
      invalidateCompanyCache();
      toast({ title: "Paramètres enregistrés", description: "Ils apparaîtront sur les factures et proformas." });
    } catch (err) {
      toast({ title: "Erreur", description: err instanceof Error ? err.message : "Erreur inconnue", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  // Bascule du mode maintenance (bouton dédié, indépendant du formulaire société)
  const toggleMaintenance = async () => {
    if (!settings) return;
    const target = !settings.maintenanceActive;
    setMaintenanceBusy(true);
    try {
      const res = await authFetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...settings, maintenanceActive: target }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Erreur d'enregistrement");
      setSettings(json);
      useSettingsStore.getState().setSettings(json);
      toast({
        title: target ? "Maintenance activée" : "Maintenance désactivée",
        description: target
          ? "Les employés voient désormais l'écran « Maintenance en cours »."
          : "L'application redevient accessible à tous.",
      });
    } catch (err) {
      toast({ title: "Erreur", description: err instanceof Error ? err.message : "Erreur inconnue", variant: "destructive" });
    } finally {
      setMaintenanceBusy(false);
    }
  };

  const onPickLogo = async (file: File | undefined) => {
    if (!file || !settings) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "Fichier invalide", description: "Choisissez une image (PNG, JPG…).", variant: "destructive" });
      return;
    }
    try {
      const dataUrl = await fileToDataUrl(file);
      setSettings({ ...settings, logo: dataUrl });
      toast({ title: "Logo chargé", description: "Cliquez sur Enregistrer pour l'appliquer." });
    } catch {
      toast({ title: "Impossible de lire l'image", variant: "destructive" });
    }
    if (fileRef.current) fileRef.current.value = "";
  };

  // ─── Sauvegarde & restauration ────────────────────────────────────────────

  const exportBackup = async () => {
    setBackupBusy(true);
    try {
      const res = await authFetch("/api/admin/backup");
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(
          json.error ??
            (res.status === 403
              ? "Action réservée à l'administrateur."
              : "Export de la sauvegarde impossible.")
        );
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `sauvegarde-lampfall-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast({
        title: "Sauvegarde exportée",
        description: "Le fichier JSON complet a été téléchargé.",
      });
    } catch (e) {
      toast({
        title: "Erreur",
        description: e instanceof Error ? e.message : "Export impossible",
        variant: "destructive",
      });
    } finally {
      setBackupBusy(false);
    }
  };

  const onRestoreFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      const text = await file.text();
      const data: unknown = JSON.parse(text);
      if (!data || typeof data !== "object" || !("data" in (data as Record<string, unknown>))) {
        throw new Error("Ce fichier ne ressemble pas à une sauvegarde ETS LAMP FALL.");
      }
      setRestoreData(data);
      setRestoreFileName(file.name);
      setConfirmOpen(true);
    } catch (e) {
      toast({
        title: "Fichier invalide",
        description: e instanceof Error ? e.message : "Lecture du fichier impossible",
        variant: "destructive",
      });
    }
    if (restoreFileRef.current) restoreFileRef.current.value = "";
  };

  const doRestore = async () => {
    if (!restoreData) return;
    setRestoreBusy(true);
    try {
      const res = await authFetch("/api/admin/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(restoreData),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          json.error ??
            (res.status === 403
              ? "Action réservée à l'administrateur."
              : res.status === 400
                ? "Sauvegarde invalide ou incomplète."
                : "Restauration impossible.")
        );
      }
      const restored = (json.restored ?? {}) as Record<string, unknown>;
      const labels: Record<string, string> = {
        clients: "clients",
        products: "produits",
        categories: "catégories",
        invoices: "factures",
        purchases: "achats",
        orders: "commandes",
        tenants: "locataires",
        suppliers: "fournisseurs",
        users: "utilisateurs",
        settings: "paramètres",
      };
      const details = Object.entries(restored)
        .filter(([, v]) => typeof v === "number")
        .map(([k, v]) => `${v} ${labels[k] ?? k}`)
        .join(", ");
      setConfirmOpen(false);
      setRestoreData(null);
      setRestoreFileName("");
      toast({
        title: "Restauration terminée",
        description: details || "Les données ont été remplacées avec succès.",
      });
      // Les paramètres société ont pu être remplacés : on les recharge
      try {
        const sres = await fetch("/api/settings");
        if (sres.ok) {
          const s = (await sres.json()) as Settings;
          setSettings(s);
          useSettingsStore.getState().setSettings(s);
          invalidateCompanyCache();
        }
      } catch {
        /* silencieux */
      }
    } catch (e) {
      toast({
        title: "Erreur de restauration",
        description: e instanceof Error ? e.message : "Erreur inconnue",
        variant: "destructive",
      });
    } finally {
      setRestoreBusy(false);
    }
  };

  if (loading || !settings) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-9 w-56" />
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }

  const field = (key: keyof Settings, label: string, placeholder: string, type = "text") => (
    <div className="space-y-1.5">
      <Label htmlFor={`set-${key}`}>{label}</Label>
      <Input
        id={`set-${key}`}
        type={type}
        placeholder={placeholder}
        value={(settings[key] as string) ?? ""}
        onChange={(e) => setSettings({ ...settings, [key]: e.target.value })}
      />
    </div>
  );

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Building2 className="h-5 w-5 text-primary" aria-hidden />
          Paramètres de la société
        </h2>
        <p className="text-sm text-muted-foreground">
          Ces informations sont injectées dans l&apos;application et sur toutes les factures & proformas PDF.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Logo */}
        <Card className="card-luxe lg:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Logo de la société</CardTitle>
            <CardDescription>Visible dans l&apos;application et en tête des PDF.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-4">
            <div className="flex h-36 w-36 items-center justify-center rounded-2xl border-2 border-dashed border-border bg-muted/40 overflow-hidden">
              {settings.logo ? (
                 
                <img src={settings.logo} alt="Logo de la société" className="h-full w-full object-contain p-2" />
              ) : (
                <Image src="/logo-green.png" alt="Logo par défaut" width={120} height={120} className="h-full w-full object-contain p-3 opacity-80" />
              )}
            </div>
            <div className="flex gap-2">
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => onPickLogo(e.target.files?.[0])}
                aria-label="Choisir un logo"
              />
              <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
                <ImagePlus className="h-4 w-4" aria-hidden /> Choisir un logo
              </Button>
              {settings.logo && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() => setSettings({ ...settings, logo: null })}
                >
                  <Trash2 className="h-4 w-4" aria-hidden /> Retirer
                </Button>
              )}
            </div>
            {!settings.logo && (
              <Badge variant="secondary" className="text-[11px]">
                Logo par défaut utilisé
              </Badge>
            )}
          </CardContent>
        </Card>

        {/* Informations */}
        <Card className="card-luxe lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Informations légales & contact</CardTitle>
            <CardDescription>Imprimées sur l&apos;en-tête et le pied de page des documents.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2">
              {field("nomSociete", "Nom de la société", "ex : ETS LAMP FALL")}
              {field("tagline", "Slogan / activité", "ex : Plomberie - Sanitaire - Luminaire")}
              {field("adresse", "Adresse", "ex : Dakar, Sénégal")}
              {field("telephone", "Téléphone", "ex : +221 77 000 00 00", "tel")}
              {field("email", "Email", "ex : contact@lampefall.sn", "email")}
              <div className="grid grid-cols-2 gap-4">
                {field("rc", "RC", "N° RCCM")}
                {field("ninea", "NINEA", "N° NINEA")}
              </div>
            </div>
            <div className="mt-6 flex justify-end">
              <Button onClick={save} disabled={saving} className="min-w-44 h-11 font-semibold">
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Enregistrement…
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" aria-hidden /> Enregistrer
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sauvegarde & restauration */}
      <Card className="card-luxe">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <DatabaseBackup className="h-4 w-4 text-primary" aria-hidden />
            Sauvegarde &amp; restauration
          </CardTitle>
          <CardDescription>
            Exportez l&apos;intégralité des données (clients, factures, produits, loyers, utilisateurs…)
            au format JSON, ou restaurez une sauvegarde précédente.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Button onClick={exportBackup} disabled={backupBusy || restoreBusy} className="min-h-11 font-semibold">
            {backupBusy ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <DatabaseBackup className="h-4 w-4" aria-hidden />
            )}
            Exporter la sauvegarde
          </Button>
          <Button
            variant="outline"
            className="min-h-11 font-semibold text-destructive hover:text-destructive"
            onClick={() => restoreFileRef.current?.click()}
            disabled={backupBusy || restoreBusy}
          >
            <ArchiveRestore className="h-4 w-4" aria-hidden />
            Restaurer…
          </Button>
          <input
            ref={restoreFileRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={(e) => onRestoreFile(e.target.files?.[0])}
            aria-label="Choisir un fichier de sauvegarde JSON"
          />
          <p className="text-xs text-muted-foreground sm:ml-auto sm:text-right">
            La restauration remplace toutes les données actuelles.
          </p>
        </CardContent>
      </Card>

      {/* Maintenance en cours */}
      <Card className={settings.maintenanceActive ? "card-luxe border-amber-500/50" : "card-luxe"}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Wrench className={`h-4 w-4 ${settings.maintenanceActive ? "animate-pulse text-amber-500" : "text-primary"}`} aria-hidden />
            Maintenance en cours
          </CardTitle>
          <CardDescription>
            Bloque l&apos;accès applicatif aux employés : un écran affiche le logo de la société et un
            compteur (jours, mois, années). L&apos;administrateur conserve toujours l&apos;accès.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center">
          {settings.maintenanceActive ? (
            <div className="flex flex-col gap-1">
              <Badge className="w-fit bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/40">
                <Wrench className="mr-1 h-3 w-3" aria-hidden /> Maintenance active
              </Badge>
              {settings.maintenanceSince && (
                <MaintenanceMiniCounter since={settings.maintenanceSince} />
              )}
            </div>
          ) : (
            <Badge variant="secondary" className="w-fit">Mode normal</Badge>
          )}
          <Button
            onClick={toggleMaintenance}
            disabled={maintenanceBusy}
            variant={settings.maintenanceActive ? "destructive" : "default"}
            className="min-h-11 min-w-56 font-semibold sm:ml-auto"
            aria-pressed={settings.maintenanceActive}
          >
            {maintenanceBusy ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : settings.maintenanceActive ? (
              <Power className="h-4 w-4" aria-hidden />
            ) : (
              <Wrench className="h-4 w-4" aria-hidden />
            )}
            {settings.maintenanceActive ? "Désactiver la maintenance" : "Activer la maintenance"}
          </Button>
        </CardContent>
      </Card>

      {/* Page de confirmation de restauration (action irréversible) */}
      <ConfirmPage
        open={confirmOpen}
        onClose={() => !restoreBusy && setConfirmOpen(false)}
        onConfirm={doRestore}
        title="Restaurer la sauvegarde ?"
        description={
          <>
            Toutes les données actuelles seront remplacées par le contenu de la sauvegarde
            {restoreFileName ? <span className="font-semibold"> « {restoreFileName} »</span> : null}. Cette
            action est <span className="font-semibold">irréversible</span>.
          </>
        }
        confirmLabel={restoreBusy ? "Remplacement…" : "Remplacer les données"}
        destructive
        busy={restoreBusy}
        busyLabel="Remplacement…"
        icon={<AlertTriangle className="h-6 w-6 text-destructive" aria-hidden />}
      />
    </div>
  );
}
