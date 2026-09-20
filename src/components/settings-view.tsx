"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Building2, ImagePlus, Loader2, Save, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { authFetch } from "@/lib/auth-client";
import { invalidateCompanyCache } from "@/lib/pdf";
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
                <Image src="/logo.png" alt="Logo par défaut" width={120} height={120} className="h-full w-full object-contain p-3 opacity-80" />
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
    </div>
  );
}
