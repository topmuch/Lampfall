import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "@/components/theme-provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ETS LAMP FALL — Système de Facturation",
  description:
    "Gestion de facturation, devis proforma, factures d'achat, commandes prévisionnelles, clients et stock pour ETS LAMP FALL (Plomberie - Sanitaire - Luminaire).",
  keywords: [
    "facturation",
    "ETS LAMP FALL",
    "plomberie",
    "sanitaire",
    "luminaire",
    "proforma",
  ],
  icons: {
    icon: "/logo-green.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <ThemeProvider>{children}</ThemeProvider>
        <Toaster />
      </body>
    </html>
  );
}
