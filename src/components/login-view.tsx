"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { motion, AnimatePresence, type Variants } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  Eye,
  EyeOff,
  FileText,
  Loader2,
  LockKeyhole,
  LogIn,
  Package,
  ShieldCheck,
  Sparkles,
  User,
} from "lucide-react";
import { saveSession } from "@/lib/auth-client";
import type { AuthUser, Settings } from "@/lib/types";

/* ─── Animations d'entrée en cascade ─────────────────────────────────────── */

const panelV: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08, delayChildren: 0.12 } },
};

const itemV: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] },
  },
};

const FEATURES = [
  { icon: FileText, label: "Factures, devis & proformas PDF" },
  { icon: Package, label: "Produits, stock & réapprovisionnement" },
  { icon: Building2, label: "Gestion locative immobilière" },
  { icon: ShieldCheck, label: "Accès sécurisé par rôles" },
];

export function LoginView({
  settings,
  onSuccess,
}: {
  settings: Settings | null;
  onSuccess: (u: AuthUser) => void;
}) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const year = useMemo(() => new Date().getFullYear(), []);

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

  const defaultName = settings?.nomSociete ?? "ETS LAMP FALL";

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      {/* ─── Fond immersif animé : aurores vertes & dorées + grille ─── */}
      <div aria-hidden className="absolute inset-0">
        <div className="luxe-float-a absolute -left-44 -top-44 h-[34rem] w-[34rem] rounded-full bg-primary/20 blur-3xl" />
        <div className="luxe-float-b absolute -right-48 top-1/4 h-[32rem] w-[32rem] rounded-full bg-gold/20 blur-3xl" />
        <div className="luxe-float-c absolute -bottom-52 left-1/3 h-[30rem] w-[30rem] rounded-full bg-primary/15 blur-3xl" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,oklch(0.5_0.1_153/5%)_1px,transparent_1px),linear-gradient(to_bottom,oklch(0.5_0.1_153/5%)_1px,transparent_1px)] bg-[size:44px_44px] [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_72%)]" />
      </div>

      {/* ─── Bascule clair / sombre ─── */}
      <div className="absolute right-4 top-4 z-20">
        <ThemeToggle />
      </div>

      <main className="relative z-10 flex min-h-screen items-center justify-center p-4 py-10 sm:p-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.97, y: 18 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          className="w-full max-w-5xl"
        >
          <div className="grid overflow-hidden rounded-3xl border border-border/70 bg-card/85 shadow-luxe backdrop-blur-xl lg:grid-cols-2">
            {/* ─── Panneau gauche : marque ─── */}
            <aside className="luxe-banner relative hidden overflow-hidden lg:flex lg:flex-col">
              {/* Gouttes décoratives flottantes (clin d'œil au logo) */}
              <span aria-hidden className="luxe-float-a absolute right-10 top-14 h-16 w-16 rounded-full bg-gold/25 blur-md" />
              <span aria-hidden className="luxe-float-b absolute right-24 top-44 h-8 w-8 rounded-full bg-white/15" />
              <span aria-hidden className="luxe-float-c absolute bottom-24 left-8 h-24 w-24 rounded-full bg-gold/15 blur-lg" />
              {/* Halo pulsant derrière le logo */}
              <span aria-hidden className="luxe-glow absolute left-1/2 top-16 h-52 w-52 -translate-x-1/2 rounded-full bg-gold/20 blur-3xl" />

              <motion.div variants={panelV} initial="hidden" animate="visible" className="relative flex flex-1 flex-col items-center justify-center gap-6 p-10 text-white">
                <motion.div variants={itemV}>
                  <div className="rounded-3xl border border-white/25 bg-white/95 p-3 shadow-2xl">
                    {settings?.logo ? (
                      <img src={settings.logo} alt={`Logo ${defaultName}`} className="h-24 w-24 object-contain" />
                    ) : (
                      <Image src="/logo-green.png" alt="Logo Lampe Fall" width={96} height={96} className="h-24 w-24 object-contain" />
                    )}
                  </div>
                </motion.div>

                <motion.div variants={itemV} className="text-center">
                  <h1 className="text-3xl font-extrabold tracking-tight drop-shadow">{defaultName}</h1>
                  <p className="mt-2 flex items-center justify-center gap-2 text-sm text-white/85">
                    <Sparkles className="h-4 w-4 text-gold" aria-hidden />
                    {settings?.tagline ?? "Facturation • Stock • Immobilier"}
                  </p>
                </motion.div>

                <motion.ul variants={panelV} className="mt-4 w-full max-w-xs space-y-3">
                  {FEATURES.map((f) => (
                    <motion.li
                      key={f.label}
                      variants={itemV}
                      className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5 text-sm text-white/90 backdrop-blur transition-colors hover:bg-white/10"
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gold/20 text-gold ring-1 ring-gold/30">
                        <f.icon className="h-4 w-4" aria-hidden />
                      </span>
                      {f.label}
                    </motion.li>
                  ))}
                </motion.ul>
              </motion.div>

              <div className="relative flex items-center justify-between gap-4 border-t border-white/15 px-10 py-5 text-[10px] font-medium uppercase tracking-[0.3em] text-white/60">
                <span>Facturation</span>
                <span aria-hidden className="h-px flex-1 bg-gradient-to-r from-transparent via-gold/60 to-transparent" />
                <span>Dakar, Sénégal</span>
              </div>
            </aside>

            {/* ─── Panneau droit : formulaire ─── */}
            <section className="flex flex-col justify-center p-7 sm:p-10">
              {/* Entête compacte (mobile) */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, delay: 0.05 }}
                className="mb-8 flex items-center gap-3 lg:hidden"
              >
                <div className="rounded-xl border border-border bg-background p-1.5 shadow-sm">
                  {settings?.logo ? (
                    <img src={settings.logo} alt="" className="h-11 w-11 object-contain" />
                  ) : (
                    <Image src="/logo-green.png" alt="" width={44} height={44} className="h-11 w-11 object-contain" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-lg font-extrabold leading-tight text-luxe-gradient">{defaultName}</p>
                  <p className="text-xs text-muted-foreground">{settings?.tagline ?? "Facturation & Gestion"}</p>
                </div>
              </motion.div>

              <motion.div variants={panelV} initial="hidden" animate="visible" className="space-y-6">
                <motion.div variants={itemV}>
                  <p className="inline-flex items-center gap-1.5 rounded-full border border-gold/40 bg-gold-soft/60 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-foreground/80 dark:bg-gold-soft/20">
                    <Sparkles className="h-3 w-3 text-gold" aria-hidden /> Espace sécurisé
                  </p>
                  <h2 className="mt-3 text-2xl font-extrabold tracking-tight">
                    Bon retour <span className="text-luxe-gradient">parmi nous</span>
                  </h2>
                  <p className="mt-1.5 text-sm text-muted-foreground">
                    Connectez-vous pour accéder à votre espace de facturation.
                  </p>
                </motion.div>

                <form onSubmit={submit} className="space-y-4" aria-label="Formulaire de connexion">
                  <motion.div variants={itemV} className="space-y-1.5">
                    <Label htmlFor="username">Identifiant</Label>
                    <div className="group relative">
                      <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary" aria-hidden />
                      <Input
                        id="username"
                        autoComplete="username"
                        className="h-11 rounded-xl pl-9"
                        placeholder="ex : admin"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        required
                      />
                    </div>
                  </motion.div>

                  <motion.div variants={itemV} className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="password">Mot de passe</Label>
                      {capsLock && (
                        <span className="flex items-center gap-1 text-[11px] font-medium text-amber-600 dark:text-amber-400" role="status">
                          <AlertTriangle className="h-3 w-3" aria-hidden /> Verr. Maj activé
                        </span>
                      )}
                    </div>
                    <div className="group relative">
                      <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary" aria-hidden />
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        autoComplete="current-password"
                        className="h-11 rounded-xl pl-9 pr-10"
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        onKeyDown={(e) => setCapsLock(e.getModifierState("CapsLock"))}
                        onKeyUp={(e) => setCapsLock(e.getModifierState("CapsLock"))}
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                        aria-pressed={showPassword}
                        className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
                      </button>
                    </div>
                  </motion.div>

                  <AnimatePresence initial={false}>
                    {error && (
                      <motion.p
                        key="error"
                        role="alert"
                        initial={{ opacity: 0, y: -6, height: 0 }}
                        animate={{ opacity: 1, y: 0, height: "auto" }}
                        exit={{ opacity: 0, y: -6, height: 0 }}
                        transition={{ duration: 0.25 }}
                        className="overflow-hidden"
                      >
                        <span className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-3.5 py-2.5 text-sm font-medium text-destructive">
                          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                          {error}
                        </span>
                      </motion.p>
                    )}
                  </AnimatePresence>

                  <motion.div variants={itemV}>
                    <Button
                      type="submit"
                      disabled={loading}
                      className="btn-shine theme-toggle-luxe group h-12 w-full rounded-xl border-0 text-base font-bold text-white"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Connexion…
                        </>
                      ) : (
                        <>
                          <LogIn className="h-4 w-4" aria-hidden /> Se connecter
                          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden />
                        </>
                      )}
                    </Button>
                  </motion.div>
                </form>

                <motion.div
                  variants={itemV}
                  className="rounded-xl border border-gold/40 bg-gold-soft/60 px-4 py-3 text-xs leading-relaxed dark:bg-gold-soft/20"
                >
                  <p className="flex items-center gap-1.5 font-semibold text-foreground">
                    <ShieldCheck className="h-3.5 w-3.5 text-primary" aria-hidden /> Première utilisation ?
                  </p>
                  <p className="mt-1 text-muted-foreground">
                    Compte administrateur par défaut :{" "}
                    <code className="rounded bg-background/70 px-1.5 py-0.5 font-mono font-bold text-primary">admin</code> — mot de passe :{" "}
                    <code className="rounded bg-background/70 px-1.5 py-0.5 font-mono font-bold text-primary">admin123</code>
                    <br />
                    Pensez à le modifier dans <strong>Utilisateurs</strong> après connexion.
                  </p>
                </motion.div>
              </motion.div>
            </section>
          </div>

          {/* Pied de page */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.55 }}
            className="mt-6 text-center text-xs text-muted-foreground"
          >
            © {year} {defaultName} — Système de facturation sécurisé
          </motion.p>
        </motion.div>
      </main>
    </div>
  );
}
