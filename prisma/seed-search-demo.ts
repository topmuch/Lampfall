/**
 * Jeu de données de test pour la barre de recherche client/fournisseur.
 * Insère des clients et fournisseurs variés (accents, casse) pour prouver
 * le filtrage insensible à la casse/accents du SearchSelect.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const clients = [
  { name: "Alioune Sow", phone: "+221 77 123 45 67", address: "Ouest Foire, Dakar", type: "PARTICULIER" },
  { name: "Fatou Ndiaye", phone: "+221 76 555 11 22", address: "Médina, Dakar", type: "PARTICULIER" },
  { name: "Entreprise Sène & Fils", phone: "+221 33 869 00 11", address: "Zone industrielle", type: "ENTREPRISE" },
  { name: "Aïcha Bâ", phone: "+221 78 400 22 33", address: "Guédiawaye", type: "PARTICULIER" },
  { name: "Promoteur Keur Dansa", phone: "+221 77 900 88 77", address: "Almadies", type: "ENTREPRISE" },
];

const suppliers = [
  { name: "Quincaillerie Ndiaye", phone: "+221 77 411 22 33", address: "Sandaga" },
  { name: "SENELEC", phone: "+221 33 839 50 00", address: "Dakar" },
  { name: "Ciments du Sahel", phone: "+221 33 879 60 60", address: "Rufisque" },
];

async function main() {
  const existing = await prisma.client.count();
  if (existing === 0) {
    for (const c of clients) await prisma.client.create({ data: c });
    console.log(`✔ ${clients.length} clients insérés`);
  } else {
    console.log(`ℹ ${existing} clients déjà présents — insertion ignorée`);
  }

  const existingSup = await prisma.supplier.count();
  if (existingSup === 0) {
    for (const s of suppliers) await prisma.supplier.create({ data: s });
    console.log(`✔ ${suppliers.length} fournisseurs insérés`);
  } else {
    console.log(`ℹ ${existingSup} fournisseurs déjà présents — insertion ignorée`);
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
