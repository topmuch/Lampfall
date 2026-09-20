"use client";

import { useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, LockKeyhole, LogIn, ShieldCheck, User } from "lucide-react";
import { saveSession } from "@/lib/auth-client";
import type { AuthUser, Settings } from "@/lib/types";

export function LoginView({ settings, onSuccess }: { settings: Settings | null; onSuccess: (u: AuthUser) => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Connexion impossible");
      saveSession(json.token, json.user);
      onSuccess(json.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background relative overflow-hidden">
      {/* Halos décoratifs violet & or */}
      <div aria-hidden className="pointer-events-none absolute -top-32 -left-32 h-96 w-96 rounded-full bg-primary/15 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -bottom-40 -right-24 h-[28rem] w-[28rem] rounded-full bg-gold/20 blur-3xl" />

      <div className="relative w-full max-w-4xl grid lg:grid-cols-2 shadow-luxe rounded-2xl overflow-hidden border border-border/60">
        {/* Panneau gauche : marque */}
        <div className="luxe-banner hidden lg:flex flex-col items-center justify-center gap-5 p-10 text-white">
          <div className="rounded-2xl bg-white/95 p-3 shadow-lg backdrop-blur">
            {settings?.logo ? (
               
              <img src={settings.logo} alt={`Logo ${settings.nomSociete}`} className="h-24 w-24 object-contain" />
            ) : (
              <Image src="/logo.png" alt="Logo Lampe Fall" width={96} height={96} className="h-24 w-auto object-contain" />
            )}
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-extrabold tracking-tight">
              {settings?.nomSociete ?? "LAMPE FALL"}
            </h1>
            <p className="mt-1 text-sm text-white/80">{settings?.tagline ?? "Facturation & Gestion"}</p>
          </div>
          <div className="mt-6 space-y-2.5 text-sm text-white/85">
            <p className="flex items-center gap-2.5">
              <ShieldCheck className="h-4 w-4 text-gold" aria-hidden /> Factures, proformas & PDF
            </p>
            <p className="flex items-center gap-2.5">
              <ShieldCheck className="h-4 w-4 text-gold" aria-hidden /> Clients, produits & immobilier
            </p>
            <p className="flex items-center gap-2.5">
              <ShieldCheck className="h-4 w-4 text-gold" aria-hidden /> Accès sécurisé par rôles
            </p>
          </div>
          <div className="mt-auto pt-8 text-[11px] text-white/60 tracking-[0.3em] uppercase">
            Système de facturation
          </div>
        </div>

        {/* Panneau droit : formulaire */}
        <div className="bg-card p-7 sm:p-10 flex flex-col justify-center">
          <div className="mb-7 flex flex-col items-center gap-3 lg:hidden">
            <div className="rounded-xl border border-border bg-background p-2">
              {settings?.logo ? (
                 
                <img src={settings.logo} alt="" className="h-14 w-14 object-contain" />
              ) : (
                <Image src="/logo.png" alt="" width={56} height={56} className="h-14 w-auto object-contain" />
              )}
            </div>
            <p className="font-bold text-lg text-luxe-gradient">{settings?.nomSociete ?? "LAMPE FALL"}</p>
          </div>

          <Card className="border-none shadow-none bg-transparent">
            <CardContent className="p-0 space-y-5">
              <div>
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <LockKeyhole className="h-5 w-5 text-primary" aria-hidden />
                  Connexion
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Accédez à votre espace de facturation.
                </p>
              </div>

              <form onSubmit={submit} className="space-y-4" aria-label="Formulaire de connexion">
                <div className="space-y-1.5">
                  <Label htmlFor="username">Identifiant</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                    <Input
                      id="username"
                      autoComplete="username"
                      className="pl-9 h-11"
                      placeholder="ex : admin"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      required
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="password">Mot de passe</Label>
                  <div className="relative">
                    <LockKeyhole className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                    <Input
                      id="password"
                      type="password"
                      autoComplete="current-password"
                      className="pl-9 h-11"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                  </div>
                </div>

                {error && (
                  <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    {error}
                  </p>
                )}

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full h-11 text-base font-semibold theme-toggle-luxe text-white border-0"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Connexion…
                    </>
                  ) : (
                    <>
                      <LogIn className="h-4 w-4" aria-hidden /> Se connecter
                    </>
                  )}
                </Button>
              </form>

              <div className="rounded-xl border border-gold/40 bg-gold-soft/60 dark:bg-gold-soft/20 px-4 py-3 text-xs leading-relaxed">
                <p className="font-semibold text-foreground">Première utilisation ?</p>
                <p className="text-muted-foreground mt-0.5">
                  Compte administrateur par défaut :{" "}
                  <code className="font-mono font-bold text-primary">admin</code> — mot de passe :{" "}
                  <code className="font-mono font-bold text-primary">admin123</code>
                  <br />
                  Pensez à le modifier dans <strong>Utilisateurs</strong> après connexion.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
