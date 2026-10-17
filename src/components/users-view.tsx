"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ConfirmPage, PageOverlay } from "@/components/page-overlay";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { KeyRound, Loader2, Pencil, Plus, ShieldCheck, Trash2, UserCog, Users2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { authFetch } from "@/lib/auth-client";
import { formatDate } from "@/lib/constants";
import type { AuthUser, UserRecord } from "@/lib/types";

interface UserForm {
  name: string;
  username: string;
  password: string;
  role: "ADMIN" | "EMPLOYE";
  actif: boolean;
}

const EMPTY_FORM: UserForm = { name: "", username: "", password: "", role: "EMPLOYE", actif: true };

export function UsersView({ currentUser }: { currentUser: AuthUser }) {
  const { toast } = useToast();
  const [users, setUsers] = useState<UserRecord[] | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<UserRecord | null>(null);
  const [form, setForm] = useState<UserForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<UserRecord | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await authFetch("/api/users");
      if (!res.ok) throw new Error();
      setUsers(await res.json());
    } catch {
      toast({ title: "Impossible de charger les utilisateurs", variant: "destructive" });
      setUsers([]);
    }
     
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  };

  const openEdit = (u: UserRecord) => {
    setEditing(u);
    setForm({ name: u.name, username: u.username, password: "", role: u.role, actif: u.actif });
    setDialogOpen(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        name: form.name,
        username: form.username,
        role: form.role,
        actif: form.actif,
      };
      if (form.password) payload.password = form.password;
      const res = await authFetch(editing ? `/api/users/${editing.id}` : "/api/users", {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Erreur");
      toast({ title: editing ? "Utilisateur modifié" : "Utilisateur créé" });
      setDialogOpen(false);
      load();
    } catch (err) {
      toast({
        title: "Erreur",
        description: err instanceof Error ? err.message : "Erreur inconnue",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!deleting) return;
    try {
      const res = await authFetch(`/api/users/${deleting.id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Erreur");
      toast({ title: "Utilisateur supprimé" });
      load();
    } catch (err) {
      toast({
        title: "Erreur",
        description: err instanceof Error ? err.message : "Erreur inconnue",
        variant: "destructive",
      });
    } finally {
      setDeleting(null);
    }
  };

  const toggleActif = async (u: UserRecord, actif: boolean) => {
    try {
      const res = await authFetch(`/api/users/${u.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actif }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Erreur");
      load();
    } catch (err) {
      toast({
        title: "Erreur",
        description: err instanceof Error ? err.message : "Erreur inconnue",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Users2 className="h-5 w-5 text-primary" aria-hidden />
            Gestion des utilisateurs
          </h2>
          <p className="text-sm text-muted-foreground">
            Administrateurs et employés — contrôlez les accès et les rôles.
          </p>
        </div>
        <Button onClick={openCreate} className="h-10 font-semibold">
          <Plus className="h-4 w-4" aria-hidden /> Nouvel utilisateur
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {!users ? (
            <div className="p-4 space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Utilisateur</TableHead>
                    <TableHead>Identifiant</TableHead>
                    <TableHead>Rôle</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Créé le</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">
                        Aucun utilisateur. Créez le premier compte.
                      </TableCell>
                    </TableRow>
                  )}
                  {users.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell>
                        <div className="flex items-center gap-2.5">
                          <div
                            className={`flex h-8 w-8 items-center justify-center rounded-full text-white text-xs font-bold ${
                              u.role === "ADMIN"
                                ? "bg-gradient-to-br from-primary to-emerald-500"
                                : "bg-muted-foreground/70"
                            }`}
                            aria-hidden
                          >
                            {u.name.slice(0, 2).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">
                              {u.name}
                              {u.id === currentUser.id && (
                                <span className="ml-1.5 text-[10px] font-normal text-muted-foreground">(vous)</span>
                              )}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm font-mono">{u.username}</TableCell>
                      <TableCell>
                        {u.role === "ADMIN" ? (
                          <Badge className="bg-primary/15 text-primary border border-primary/30 hover:bg-primary/15">
                            <ShieldCheck className="h-3 w-3 mr-1" aria-hidden /> Administrateur
                          </Badge>
                        ) : (
                          <Badge variant="secondary">
                            <UserCog className="h-3 w-3 mr-1" aria-hidden /> Employé
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={u.actif}
                            onCheckedChange={(v) => toggleActif(u, v)}
                            disabled={u.id === currentUser.id}
                            aria-label={u.actif ? `Désactiver ${u.name}` : `Activer ${u.name}`}
                          />
                          <span className={`text-xs ${u.actif ? "text-green-600 dark:text-green-400" : "text-muted-foreground"}`}>
                            {u.actif ? "Actif" : "Désactivé"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatDate(u.createdAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(u)} aria-label={`Modifier ${u.name}`}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => setDeleting(u)}
                            disabled={u.id === currentUser.id}
                            aria-label={`Supprimer ${u.name}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Page création / édition */}
      <PageOverlay
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title={editing ? "Modifier l'utilisateur" : "Nouvel utilisateur"}
        description={
          editing
            ? `Compte « ${editing.username} » — laissez le mot de passe vide pour le conserver.`
            : "Créez un compte administrateur ou employé."
        }
        actions={
          <Button onClick={save} disabled={saving || !form.name.trim() || !form.username.trim()}>
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Enregistrement…
              </>
            ) : editing ? (
              "Enregistrer"
            ) : (
              "Créer le compte"
            )}
          </Button>
        }
        maxWidth="max-w-2xl"
      >
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="u-name">Nom complet</Label>
              <Input
                id="u-name"
                placeholder="ex : Moussa Diop"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="u-username">Identifiant de connexion</Label>
              <Input
                id="u-username"
                placeholder="ex : mdiop"
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="u-password">
                {editing ? "Nouveau mot de passe (optionnel)" : "Mot de passe"}
              </Label>
              <div className="relative">
                <KeyRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                <Input
                  id="u-password"
                  type="password"
                  className="pl-9"
                  placeholder={editing ? "•••••• (inchangé)" : "Minimum 6 caractères"}
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Rôle</Label>
                <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v as "ADMIN" | "EMPLOYE" })}>
                  <SelectTrigger aria-label="Rôle de l'utilisateur">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ADMIN">Administrateur</SelectItem>
                    <SelectItem value="EMPLOYE">Employé</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Compte actif</Label>
                <div className="flex h-10 items-center gap-3">
                  <Switch checked={form.actif} onCheckedChange={(v) => setForm({ ...form, actif: v })} aria-label="Compte actif" />
                  <span className="text-sm text-muted-foreground">{form.actif ? "Actif" : "Désactivé"}</span>
                </div>
              </div>
            </div>
          </div>
      </PageOverlay>

      {/* Page confirmation suppression */}
      <ConfirmPage
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={remove}
        title="Supprimer cet utilisateur ?"
        description={
          <>
            Le compte « {deleting?.username} » ({deleting?.name}) sera définitivement supprimé.
          </>
        }
        confirmLabel="Supprimer"
        destructive
        icon={<Trash2 className="h-6 w-6 text-destructive" aria-hidden />}
      />
    </div>
  );
}

