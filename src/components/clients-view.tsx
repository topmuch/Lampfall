"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  History,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Trash2,
  Users,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useDebouncedValue, useFetch } from "@/hooks/use-fetch";
import { formatDate, formatMoney } from "@/lib/constants";
import type { Client, Invoice } from "@/lib/types";
import { PaymentBadge } from "@/components/status-badges";

interface ClientRow extends Client {
  _count?: { invoices: number; orders: number };
}

interface FormState {
  name: string;
  type: "PARTICULIER" | "ENTREPRISE";
  phone: string;
  email: string;
  address: string;
  notes: string;
}

const emptyForm: FormState = {
  name: "",
  type: "PARTICULIER",
  phone: "",
  email: "",
  address: "",
  notes: "",
};

export function ClientsView() {
  const { toast } = useToast();
  const [q, setQ] = useState("");
  const debouncedQ = useDebouncedValue(q);
  const { data: clients, loading, refetch } = useFetch<ClientRow[]>(
    `/api/clients${debouncedQ ? `?q=${encodeURIComponent(debouncedQ)}` : ""}`
  );

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<Client | null>(null);
  const [historyOf, setHistoryOf] = useState<Client | null>(null);

  const historyQuery = useMemo(
    () => (historyOf ? `/api/invoices?clientId=${historyOf.id}` : null),
    [historyOf]
  );
  const { data: history } = useFetch<Invoice[]>(historyQuery);

  useEffect(() => {
    if (dialogOpen) {
      setForm(
        editing
          ? {
              name: editing.name,
              type: (editing.type as FormState["type"]) ?? "PARTICULIER",
              phone: editing.phone ?? "",
              email: editing.email ?? "",
              address: editing.address ?? "",
              notes: editing.notes ?? "",
            }
          : emptyForm
      );
    }
  }, [dialogOpen, editing]);

  const submit = async () => {
    if (!form.name.trim()) {
      toast({ title: "Nom obligatoire", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(editing ? `/api/clients/${editing.id}` : "/api/clients", {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Erreur d'enregistrement");
      toast({
        title: editing ? "Client modifié" : "Client créé",
        description: form.name,
      });
      setDialogOpen(false);
      refetch();
    } catch (e) {
      toast({
        title: "Erreur",
        description: e instanceof Error ? e.message : "Erreur inconnue",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const doDelete = async () => {
    if (!deleting) return;
    try {
      const res = await fetch(`/api/clients/${deleting.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Suppression impossible");
      toast({ title: "Client supprimé", description: deleting.name });
      setDeleting(null);
      refetch();
    } catch (e) {
      toast({
        title: "Erreur",
        description: e instanceof Error ? e.message : "Erreur inconnue",
        variant: "destructive",
      });
    }
  };

  const historyTotal = (history ?? [])
    .filter((f) => f.type === "VENTE")
    .reduce((s, f) => s + f.totalTTC, 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold">Clients</h2>
          <p className="text-sm text-muted-foreground">
            Gestion du fichier client et historique des achats.
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => {
            setEditing(null);
            setDialogOpen(true);
          }}
        >
          <Plus className="h-4 w-4" /> Nouveau client
        </Button>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Rechercher par nom, téléphone ou email…"
              className="pl-8"
              aria-label="Rechercher un client"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4 space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : !clients || clients.length === 0 ? (
            <div className="p-10 text-center text-sm text-muted-foreground">
              Aucun client trouvé.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nom</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Téléphone</TableHead>
                  <TableHead>Adresse</TableHead>
                  <TableHead className="text-center">Factures</TableHead>
                  <TableHead className="w-12" aria-label="Actions" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {clients.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          c.type === "ENTREPRISE"
                            ? "border-green-200 text-green-800"
                            : "border-stone-200 text-stone-600"
                        }
                      >
                        {c.type === "ENTREPRISE" ? "Entreprise" : "Particulier"}
                      </Badge>
                    </TableCell>
                    <TableCell>{c.phone || "—"}</TableCell>
                    <TableCell className="max-w-40 truncate" title={c.address ?? ""}>
                      {c.address || "—"}
                    </TableCell>
                    <TableCell className="text-center tabular-nums">
                      {c._count?.invoices ?? 0}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Actions pour ${c.name}`}>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setHistoryOf(c)}>
                            <History className="h-4 w-4" /> Historique des achats
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              setEditing(c);
                              setDialogOpen(true);
                            }}
                          >
                            <Pencil className="h-4 w-4" /> Modifier
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => setDeleting(c)}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" /> Supprimer
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Dialog création / édition */}
      <Dialog open={dialogOpen} onOpenChange={(v) => !v && setDialogOpen(false)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Modifier le client" : "Nouveau client"}</DialogTitle>
            <DialogDescription>
              Renseignez les coordonnées du client.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="c-name">Nom complet / Raison sociale *</Label>
              <Input
                id="c-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ex : SARL BTP Teranga"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Type</Label>
              <div className="flex gap-2">
                {(["PARTICULIER", "ENTREPRISE"] as const).map((t) => (
                  <Button
                    key={t}
                    type="button"
                    size="sm"
                    variant={form.type === t ? "default" : "outline"}
                    onClick={() => setForm({ ...form, type: t })}
                  >
                    {t === "PARTICULIER" ? "Particulier" : "Entreprise"}
                  </Button>
                ))}
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="c-phone">Téléphone</Label>
                <Input
                  id="c-phone"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="+221 …"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="c-email">Email</Label>
                <Input
                  id="c-email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="client@email.com"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="c-address">Adresse</Label>
              <Input
                id="c-address"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                placeholder="Quartier, ville"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="c-notes">Notes</Label>
              <Textarea
                id="c-notes"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              Annuler
            </Button>
            <Button onClick={submit} disabled={saving}>
              {saving ? "Enregistrement…" : "Enregistrer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Historique client */}
      <Dialog open={historyOf !== null} onOpenChange={(v) => !v && setHistoryOf(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              Historique — {historyOf?.name}
            </DialogTitle>
            <DialogDescription>
              Factures et dates d&apos;achat du client.
            </DialogDescription>
          </DialogHeader>
          {!history || history.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              Aucun achat enregistré pour ce client.
            </p>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Card>
                  <CardContent className="p-3">
                    <p className="text-xs text-muted-foreground">Achats (factures)</p>
                    <p className="text-lg font-bold tabular-nums">
                      {history.filter((f) => f.type === "VENTE").length}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-3">
                    <p className="text-xs text-muted-foreground">Total facturé</p>
                    <p className="text-lg font-bold tabular-nums text-primary">
                      {formatMoney(historyTotal)}
                    </p>
                  </CardContent>
                </Card>
              </div>
              <div className="rounded-md border max-h-72 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>N°</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Date d&apos;achat</TableHead>
                      <TableHead className="text-right">Montant</TableHead>
                      <TableHead>Paiement</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {history.map((f) => (
                      <TableRow key={f.id}>
                        <TableCell className="font-medium">{f.number}</TableCell>
                        <TableCell className="text-xs">
                          {f.type === "PROFORMA" ? "Proforma" : "Vente"}
                        </TableCell>
                        <TableCell>{formatDate(f.date)}</TableCell>
                        <TableCell className="text-right tabular-nums whitespace-nowrap">
                          {formatMoney(f.totalTTC)}
                        </TableCell>
                        <TableCell>
                          <PaymentBadge status={f.paymentStatus} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Confirmation suppression */}
      <Dialog open={deleting !== null} onOpenChange={(v) => !v && setDeleting(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Supprimer le client ?</DialogTitle>
            <DialogDescription>
              {deleting &&
                `Le client « ${deleting.name} » sera supprimé. Ses factures seront conservées sans client associé.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)}>
              Annuler
            </Button>
            <Button variant="destructive" onClick={doDelete}>
              Supprimer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
