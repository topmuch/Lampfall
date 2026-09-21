"use client";

import { useEffect, useState } from "react";
import { Loader2, Printer } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { buildPaymentTicketHTML, printTicket80 } from "@/lib/pdf";

interface TicketDoc {
  number: string;
  clientName?: string | null;
  totalTTC: number;
  amountPaid: number;
}

interface TicketPayment {
  amount: number;
  method: string;
  paidAt: string;
  note?: string | null;
}

interface TicketPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  payment: TicketPayment | null;
  /** Facture d'origine (ou pseudo-document pour un règlement crédit). */
  doc: TicketDoc | null;
}

/**
 * Aperçu visuel du reçu de versement au format ticket 80 mm avant impression.
 * L'aperçu s'affiche toujours (plus rien de « invisible »), puis l'utilisateur
 * lance l'impression thermique en un clic.
 */
export function TicketPreviewDialog({ open, onOpenChange, payment, doc }: TicketPreviewDialogProps) {
  const { toast } = useToast();
  const [built, setBuilt] = useState<{ key: string; html: string | null }>({ key: "", html: null });

  // Signature du versement affiché (évite de reconstruire pour rien)
  const key = payment && doc ? `${payment.paidAt}|${payment.amount}|${payment.method}|${doc.number}` : "";
  const html = built.key === key && key ? built.html : null;
  const building = key !== "" && built.key !== key;

  useEffect(() => {
    if (!key || !payment || !doc) return;
    let cancelled = false;
    buildPaymentTicketHTML(payment, doc)
      .then((h) => {
        if (!cancelled) setBuilt({ key, html: h });
      })
      .catch(() => {
        if (!cancelled) setBuilt({ key, html: null });
      });
    return () => {
      cancelled = true;
    };
  }, [key, payment, doc]);

  const handlePrint = () => {
    if (!html) return;
    try {
      printTicket80(html);
      toast({ title: "Impression lancée", description: "Ticket 80 mm envoyé à l'imprimante." });
    } catch {
      toast({
        title: "Impression impossible",
        description: "Autorisez les fenêtres surgissantes ou utilisez Ctrl+P depuis l'aperçu.",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Aperçu du ticket 80 mm</DialogTitle>
          <DialogDescription>
            Reçu de versement prêt pour l&apos;imprimante thermique (80 mm).
          </DialogDescription>
        </DialogHeader>

        <div className="flex justify-center rounded-xl bg-muted/60 p-4">
          {building ? (
            <div className="flex h-72 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-hidden />
            </div>
          ) : html ? (
            <iframe
              title="Aperçu du ticket 80 mm"
              srcDoc={html}
              className="h-72 w-[312px] max-w-full rounded-lg border bg-white shadow-md"
              sandbox="allow-same-origin"
            />
          ) : (
            <p className="py-16 text-sm text-muted-foreground">Aperçu indisponible.</p>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fermer
          </Button>
          <Button onClick={handlePrint} disabled={!html || building}>
            {building ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Printer className="h-4 w-4" aria-hidden />
            )}
            Imprimer (80 mm)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
