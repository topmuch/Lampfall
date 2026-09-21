"use client";

import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import {
  ArrowLeft,
  Building2,
  Download,
  Eye,
  FileDown,
  Mail,
  MapPin,
  Pencil,
  Phone,
  ReceiptText,
  ShieldAlert,
  StickyNote,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useFetch } from "@/hooks/use-fetch";
import { formatDate, formatMoney } from "@/lib/constants";
import type { Client, Invoice } from "@/lib/types";
import { DeliveryBadge, PaymentBadge } from "@/components/status-badges";
import { buildClientHistoryPDF, downloadPDF, saveOrOpenInvoicePDF } from "@/lib/pdf";

interface ClientDetailProps {
  client: Client;
  onBack: () => void;
  onEdit: (client: Client) => void;
}

export function ClientDetailView({ client, onBack, onEdit }: ClientDetailProps) {
  const { toast } = useToast();
  const { data: history, loading } = useFetch<Invoice[]>(
    `/api/invoices?clientId=${client.id}`
  );

  const stats = useMemo(() => {
    const list = history ?? [];
    const ventes = list.filter((f) => f.type === "VENTE");
    const proformas = list.filter((f) => f.type === "PROFORMA");
    const totalFacture = ventes.reduce((s, f) => s + f.totalTTC, 0);
    const totalPaye = ventes.reduce((s, f) => s + f.amountPaid, 0);

    // Encours : reste à payer des ventes non soldées
    const encours = ventes
      .filter((f) => f.paymentStatus !== "PAYE")
      .reduce((s, f) => s + Math.max(0, f.totalTTC - f.amountPaid), 0);

    // Panier moyen
    const panierMoyen = ventes.length > 0 ? totalFacture / ventes.length : 0;

    // Fréquence moyenne entre achats (jours) + dernier achat
    const sortedTs = ventes
      .map((f) => new Date(f.date).getTime())
      .filter((t) => !Number.isNaN(t))
      .sort((a, b) => a - b);
    let frequenceJours: number | null = null;
    if (sortedTs.length >= 2) {
      const totalDays = sortedTs
        .slice(1)
        .reduce((s, t, i) => s + (t - sortedTs[i]) / 86_400_000, 0);
      frequenceJours = Math.round(totalDays / (sortedTs.length - 1));
    }
    const dernierTs = sortedTs.length > 0 ? sortedTs[sortedTs.length - 1] : null;
    const joursDepuisDernier =
      dernierTs !== null
        ? Math.max(0, Math.floor((Date.now() - dernierTs) / 86_400_000))
        : null;
    const dernierAchat = dernierTs !== null ? new Date(dernierTs).toISOString() : null;

    return {
      ventes: ventes.length,
      proformas: proformas.length,
      totalFacture,
      totalPaye,
      reste: totalFacture - totalPaye,
      encours,
      panierMoyen,
      frequenceJours,
      joursDepuisDernier,
      dernierAchat,
    };
  }, [history]);

  const creditLimit = client.creditLimit ?? 0;
  const depassePlafond = creditLimit > 0 && stats.encours > creditLimit;

  const exportHistory = async () => {
    try {
      const doc = await buildClientHistoryPDF(client, history ?? []);
      downloadPDF(doc, `Historique-${client.name.replace(/[^a-zA-Z0-9]+/g, "-")}.pdf`);
      toast({ title: "Historique exporté en PDF" });
    } catch (e) {
      toast({
        title: "Erreur",
        description: e instanceof Error ? e.message : "Export impossible",
        variant: "destructive",
      });
    }
  };

  const saveInvoicePdf = async (invoice: Invoice) => {
    try {
      await saveOrOpenInvoicePDF(invoice, "download");
      toast({ title: "PDF téléchargé", description: invoice.number });
    } catch (e) {
      toast({
        title: "Erreur",
        description: e instanceof Error ? e.message : "Génération PDF impossible",
        variant: "destructive",
      });
    }
  };

  const openInvoicePdf = async (invoice: Invoice) => {
    try {
      await saveOrOpenInvoicePDF(invoice, "open");
    } catch (e) {
      toast({
        title: "Erreur",
        description: e instanceof Error ? e.message : "Génération PDF impossible",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-4">
      {/* En-tête */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <Button variant="outline" size="icon" onClick={onBack} aria-label="Retour aux clients">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h2 className="text-xl font-bold leading-tight">{client.name}</h2>
            <p className="text-sm text-muted-foreground">
              {client.type === "ENTREPRISE" ? "Entreprise" : "Particulier"} • Client depuis le{" "}
              {formatDate(client.createdAt)}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => onEdit(client)}>
            <Pencil className="h-4 w-4" /> Modifier
          </Button>
          <Button size="sm" variant="outline" onClick={exportHistory} disabled={loading}>
            <FileDown className="h-4 w-4" /> Historique PDF
          </Button>
        </div>
      </div>

      {/* Coordonnées */}
      <Card>
        <CardContent className="p-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4 text-sm">
          <p className="flex items-center gap-2">
            <Phone className="h-4 w-4 text-primary shrink-0" />
            {client.phone || <span className="text-muted-foreground">—</span>}
          </p>
          <p className="flex items-center gap-2 min-w-0">
            <Mail className="h-4 w-4 text-primary shrink-0" />
            <span className="truncate">{client.email || "—"}</span>
          </p>
          <p className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-primary shrink-0" />
            <span className="truncate">{client.address || "—"}</span>
          </p>
          <p className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-primary shrink-0" />
            <span className="truncate">
              {stats.dernierAchat ? `Dernier achat : ${formatDate(stats.dernierAchat)}` : "Aucun achat"}
            </span>
          </p>
          {client.notes && (
            <p className="flex items-start gap-2 sm:col-span-2 lg:col-span-4 text-muted-foreground">
              <StickyNote className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              {client.notes}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Statistiques */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Achats (factures)</p>
            <p className="text-lg font-bold tabular-nums">{stats.ventes}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Proformas</p>
            <p className="text-lg font-bold tabular-nums">{stats.proformas}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total facturé</p>
            <p className="text-lg font-bold tabular-nums text-primary">
              {formatMoney(stats.totalFacture)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Reste à payer</p>
            <p
              className={`text-lg font-bold tabular-nums ${
                stats.reste > 0 ? "text-red-600" : "text-green-700"
              }`}
            >
              {formatMoney(stats.reste)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Panier moyen</p>
            <p className="text-lg font-bold tabular-nums">{formatMoney(stats.panierMoyen)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Fréquence d&apos;achat</p>
            <p className="text-lg font-bold tabular-nums">
              {stats.frequenceJours !== null ? `≈ ${stats.frequenceJours} jours` : "—"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Dernier achat</p>
            <p className="text-lg font-bold tabular-nums">
              {stats.joursDepuisDernier !== null
                ? stats.joursDepuisDernier === 0
                  ? "Aujourd'hui"
                  : `il y a ${stats.joursDepuisDernier} jour${stats.joursDepuisDernier > 1 ? "s" : ""}`
                : "—"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Encours (non soldé)</p>
            <p
              className={`text-lg font-bold tabular-nums ${
                stats.encours > 0 ? "text-amber-600" : "text-green-700"
              }`}
            >
              {formatMoney(stats.encours)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Plafond de crédit (encours vs plafond) */}
      {creditLimit > 0 && (
        <Card className={depassePlafond ? "border-red-500/50" : undefined}>
          <CardContent className="space-y-2.5 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span className="flex items-center gap-2 font-semibold">
                <ShieldAlert
                  className={`h-4 w-4 ${depassePlafond ? "text-red-600" : "text-primary"}`}
                  aria-hidden
                />
                Plafond de crédit
              </span>
              {depassePlafond ? (
                <span className="font-bold text-red-600">Plafond dépassé !</span>
              ) : (
                <span className="tabular-nums text-muted-foreground">
                  Encours : {formatMoney(stats.encours)} / plafond {formatMoney(creditLimit)}
                </span>
              )}
            </div>
            <Progress
              value={Math.min(100, (stats.encours / creditLimit) * 100)}
              aria-label={`Encours ${formatMoney(stats.encours)} sur un plafond de ${formatMoney(creditLimit)}`}
              className={
                depassePlafond ? "[&>[data-slot=progress-indicator]]:bg-red-600" : undefined
              }
            />
            {depassePlafond && (
              <p className="text-xs tabular-nums text-red-600">
                Encours : {formatMoney(stats.encours)} / plafond {formatMoney(creditLimit)}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Historique des achats */}
      <Card>
        <CardContent className="p-0">
          <div className="px-4 py-3 border-b flex items-center justify-between gap-2">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <ReceiptText className="h-4 w-4 text-primary" /> Historique des achats
            </h3>
            <p className="text-xs text-muted-foreground hidden sm:block">
              Téléchargez chaque facture ou proforma en PDF
            </p>
          </div>
          {loading ? (
            <div className="p-4 space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : !history || history.length === 0 ? (
            <div className="p-10 text-center text-sm text-muted-foreground">
              Aucun achat enregistré pour ce client.
            </div>
          ) : (
            <div className="max-h-[28rem] overflow-auto">
              <Table>
                <TableHeader className="sticky top-0 bg-background z-10">
                  <TableRow>
                    <TableHead>N°</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Date d&apos;achat</TableHead>
                    <TableHead className="text-right">Montant</TableHead>
                    <TableHead>Paiement</TableHead>
                    <TableHead>Livraison</TableHead>
                    <TableHead className="text-center">PDF</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.map((f) => (
                    <TableRow key={f.id}>
                      <TableCell className="font-medium whitespace-nowrap">{f.number}</TableCell>
                      <TableCell>
                        <span
                          className={`inline-flex rounded-md px-2 py-0.5 text-xs font-semibold ${
                            f.type === "PROFORMA"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-green-100 text-green-800"
                          }`}
                        >
                          {f.type === "PROFORMA" ? "Proforma" : "Vente"}
                        </span>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{formatDate(f.date)}</TableCell>
                      <TableCell className="text-right tabular-nums whitespace-nowrap">
                        {formatMoney(f.totalTTC)}
                      </TableCell>
                      <TableCell>
                        <PaymentBadge status={f.paymentStatus} />
                      </TableCell>
                      <TableCell>
                        <DeliveryBadge status={f.deliveryStatus} />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => saveInvoicePdf(f)}
                            aria-label={`Télécharger le PDF de ${f.number}`}
                            title="Télécharger le PDF"
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => openInvoicePdf(f)}
                            aria-label={`Afficher le PDF de ${f.number}`}
                            title="Afficher le PDF"
                          >
                            <Eye className="h-4 w-4" />
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
    </div>
  );
}
