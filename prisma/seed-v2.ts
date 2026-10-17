import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

// Seed incrémental (v2) :
//  1. Catégories en base (gestion dynamique) — 11 catégories d'origine
//  2. Dossiers immobiliers de démonstration (locataires + loyers)

const CATEGORIES: { code: string; label: string }[] = [
  { code: "SANITAIRE", label: "Sanitaire" },
  { code: "PLOMBERIE", label: "Plomberie" },
  { code: "LUMINAIRE", label: "Luminaire" },
  { code: "ELECTRICITE", label: "Électricité" },
  { code: "GOUTTE_A_GOUTTE", label: "Goutte à goutte" },
  { code: "TUYAUTERIE", label: "Tuyauterie" },
  { code: "MIROITERIE", label: "Miroiterie" },
  { code: "ROBINETTERIE", label: "Robinetterie" },
  { code: "POMPE", label: "Pompe" },
  { code: "CHASSE_DOUCHE", label: "Chasse de douche" },
  { code: "RESERVOIR_EAU", label: "Réservoir d'eau" },
];

function monthStr(offsetMonths: number): string {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() + offsetMonths);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(11, 0, 0, 0);
  return d;
}

async function main() {
  // ─── 1. Catégories ────────────────────────────────────────────────────────
  console.log("Catégories…");
  for (const cat of CATEGORIES) {
    await db.category.upsert({
      where: { code: cat.code },
      update: { label: cat.label },
      create: cat,
    });
  }
  console.log(`  ${CATEGORIES.length} catégories prêtes.`);

  // ─── 2. Immobilier ────────────────────────────────────────────────────────
  console.log("Immobilier…");
  const existingTenants = await db.tenant.count();
  if (existingTenants === 0) {
    // Locataire exemple de la demande : Moussa Diop — Immeuble F — 200 000 CFA — mois de juillet non payé
    const moussa = await db.tenant.create({
      data: {
        name: "Moussa Diop",
        phone: "+221 77 123 45 67",
        building: "Immeuble F",
        unit: "Appartement 2B",
        monthlyRent: 200000,
        notes: "Bail renouvelé cette année.",
      },
    });
    const awa = await db.tenant.create({
      data: {
        name: "Awa Ndiaye",
        phone: "+221 76 555 12 34",
        building: "Immeuble A",
        unit: "Studio 1er étage",
        monthlyRent: 150000,
      },
    });
    const boutique = await db.tenant.create({
      data: {
        name: "SARL Teranga Store",
        building: "Immeuble F",
        unit: "Local commercial RDC",
        monthlyRent: 350000,
      },
    });

    // Loyers : 2 mois précédents payés + mois courant / juillet selon le cas
    await db.rent.createMany({
      data: [
        // Moussa Diop : juillet non payé (exemple de la demande), autres mois payés
        { tenantId: moussa.id, month: monthStr(-3), amount: 200000, status: "PAYE", paidAt: daysAgo(85) },
        { tenantId: moussa.id, month: monthStr(-2), amount: 200000, status: "NON_PAYE" },
        { tenantId: moussa.id, month: monthStr(-1), amount: 200000, status: "PAYE", paidAt: daysAgo(40) },
        { tenantId: moussa.id, month: monthStr(0), amount: 200000, status: "NON_PAYE" },
        // Awa Ndiaye : à jour
        { tenantId: awa.id, month: monthStr(-1), amount: 150000, status: "PAYE", paidAt: daysAgo(35) },
        { tenantId: awa.id, month: monthStr(0), amount: 150000, status: "PAYE", paidAt: daysAgo(5) },
        // Boutique : 2 mois d'impayés
        { tenantId: boutique.id, month: monthStr(-1), amount: 350000, status: "NON_PAYE" },
        { tenantId: boutique.id, month: monthStr(0), amount: 350000, status: "NON_PAYE" },
      ],
    });
    console.log("  3 dossiers locataires créés avec leurs loyers.");
  } else {
    console.log(`  ${existingTenants} locataire(s) déjà présents — ignoré.`);
  }

  console.log("Seed v2 terminé.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
