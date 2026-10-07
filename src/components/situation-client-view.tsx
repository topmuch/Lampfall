"use client";

import { useMemo, useState } from "react";
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
import { Eye, FileDown, FileSearch, Phone, SearchX } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useFetch } from "@/hooks/use-fetch";
import { formatDate, formatMoney } from "@/lib/constants";
import type { Client, Invoice } from "@/lib/types";
import { DeliveryBadge, PaymentBadge } from "@/components/status-badges";
import { SearchSelect } from "@/components/person-search-select";
import {
  buildSituationClientPDF,
  downloadPDF,
  saveOrOpenInvoicePDF,
} from "@/lib/pdf";

/* ─── Situation client ──────────────────────────────────────────────────────
 * Onglet dédié : on recherche un client (ex : « Senhotel »), sa situation
 * s'affiche — synthèse des montants + tableau de ses factures VENTE
 * (date, numéro, entreprise, montant TTC, reste à payer, livraison) —
 * puis on génère le PDF « Situation client » prêt à envoyer.
 * ──────────────────────────────────────────────────────────────────────────── */

export function SituationClientView() {
  const { toast } = useToast();
  const { data: clients } = useFetch<Client[]>("/api/clients");
  const [clientId, setClientId] = useState("");

  const { data: history, loading } = useFetch<Invoice[]>(
    clientId ? `/api/invoices?clientId=${clientId}` : null
  );

  const client = useMemo(
    () => (clients ?? []).find((c) => c.id === clientId) ?? null,
    [clients, clientId]
  );

  // Option A : seules les vraies factures VENTE (une proforma n'est pas
  // encore une dette réelle du client).
  const ventes = useMemo(
    () => (history ?? []).filter((f) => f.type === "VENTE"),
    [history]
  );

  const stats = useMemo(() => {
    const totalFacture = ventes.reduce((s, f) => s + f.totalTTC, 0);
    const totalPaye = ventes.reduce((s, f) => s + f.amountPaid, 0);
    const reste = ventes.reduce(
      (s, f) => s + Math.max(0, f.totalTTC - f.amountPaid),
      0
    );
    const nonLivrees = ventes.filter((f) => f.deliveryStatus === "NON_LIVRE").length;
    return { totalFacture, totalPaye, reste, nonLivrees };
  }, [ventes]);

  const generatePDF = async () => {
    if (!client) return;
    try {
      const doc = await buildSituationClientPDF(client, ventes);
      downloadPDF(doc, `Situation-${client.name.replace(/[^a-zA-Z0-9]+/g, "-")}.pdf`);
      toast({ title: "Situation client exportée en PDF" });
    } catch (e) {
      toast({
        title: "Erreur",
        description: e instanceof Error ? e.message : "Export impossible",
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
        <div>
          <h2 className="flex items-center gap-2 text-xl font-bold leading-tight">
            <FileSearch className="h-5 w-5 text-primary" aria-hidden />
            Situation client
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Recherchez un client pour consulter son relevé : factures, montants
            dus, livraisons — puis générez le PDF officiel.
          </p>
        </div>
        <Button size="sm" onClick={generatePDF} disabled={!client || ventes.length === 0}>
          <FileDown className="h-4 w-4" /> Générer le PDF
        </Button>
      </div>

      {/* Barre de recherche client */}
      <Card>
        <CardContent className="p-4">
          <SearchSelect
            items={(clients ?? []).map((c) => ({
              id: c.id,
              name: c.name,
              hint: c.phone ?? undefined,
            }))}
            value={clientId}
            onChange={setClientId}
            ariaLabel="Rechercher un client"
            searchPlaceholder="Rechercher un client par nom ou téléphone… (ex : Senhotel)"
            emptyMessage="Aucun client trouvé"
          />
        </CardContent>
      </Card>

      {/* État vide : aucun client sélectionné */}
      {!client && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-2 py-14 text-center">
            <SearchX className="h-10 w-10 text-muted-foreground/50" aria-hidden />
            <p className="font-medium">Aucun client sélectionné</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Tapez le nom d'un client dans la barre de recherche ci-dessus
              (ex : « Senhotel ») — sa situation détaillée s'affichera
              automatiquement.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Situation du client sélectionné */}
      {client && (
        <>
          {/* Identité du client */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            <span className="text-base font-bold">{client.name}</span>
            <span className="text-muted-foreground">
              {client.type === "ENTREPRISE" ? "Entreprise" : "Particulier"}
            </span>
            {client.phone && (
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <Phone className="h-3.5 w-3.5 text-primary" aria-hidden />
                {client.phone}
              </span>
            )}
          </div>

          {/* Synthèse des montants */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Factures (ventes)</p>
                <p className="text-lg font-bold tabular-nums">{ventes.length}</p>
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
                <p className="text-xs text-muted-foreground">Total payé</p>
                <p className="text-lg font-bold tabular-nums">
                  {formatMoney(stats.totalPaye)}
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
                {stats.nonLivrees > 0 && (
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    dont {stats.nonLivrees} facture(s) non livrée(s)
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Tableau des factures */}
          <Card>
            <CardContent className="p-0">
              {loading ? (
                <div className="space-y-2 p-4">
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-3/4" />
                </div>
              ) : ventes.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
                  <SearchX className="h-9 w-9 text-muted-foreground/50" aria-hidden />
                  <p className="font-medium">Aucune facture de vente</p>
                  <p className="max-w-sm text-sm text-muted-foreground">
                    Ce client n'a pas encore de facture VENTE (les proformas ne
                    comptent pas dans la situation).
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date facture</TableHead>
                        <TableHead>N° facture</TableHead>
                        <TableHead>Entreprise</TableHead>
                        <TableHead className="text-right">Montant TTC</TableHead>
                        <TableHead className="text-right">Reste à payer</TableHead>
                        <TableHead>Paiement</TableHead>
                        <TableHead>Livraison</TableHead>
                        <TableHead className="w-10" aria-label="Actions" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {ventes.map((f) => {
                        const reste = Math.max(0, f.totalTTC - f.amountPaid);
                        return (
                          <TableRow key={f.id}>
                            <TableCell className="whitespace-nowrap tabular-nums">
                              {formatDate(f.date)}
                            </TableCell>
                            <TableCell className="whitespace-nowrap font-medium">
                              {f.number}
                            </TableCell>
                            <TableCell className="max-w-48 truncate">
                              {f.clientName || client.name}
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-right tabular-nums">
                              {formatMoney(f.totalTTC)}
                            </TableCell>
                            <TableCell
                              className={`whitespace-nowrap text-right font-semibold tabular-nums ${
                                reste > 0 ? "text-red-600" : "text-green-700"
                              }`}
                            >
                              {formatMoney(reste)}
                            </TableCell>
                            <TableCell>
                              <PaymentBadge status={f.paymentStatus} />
                            </TableCell>
                            <TableCell>
                              <DeliveryBadge status={f.deliveryStatus} />
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                aria-label={`Aperçu PDF de la facture ${f.number}`}
                                onClick={() => openInvoicePdf(f)}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
