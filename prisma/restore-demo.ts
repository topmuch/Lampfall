// Restauration SÉCURISÉE du catalogue de démonstration Lampfall
// — ne supprime RIEN, ne touche pas aux factures/clients existants —
// Recrée : catégories, produits (avec prix d'achat/vente), clients de démonstration.
// Idempotent : relançable sans créer de doublons (upsert par référence / nom).
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

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

const PRODUCTS = [
  { name: "WC complet à poser Blanc", reference: "SAN-WC-001", category: "SANITAIRE", purchasePrice: 45000, salePrice: 65000, stock: 12, unit: "pièce", minStock: 3 },
  { name: "Lavabo céramique sur colonne", reference: "SAN-LAV-002", category: "SANITAIRE", purchasePrice: 38000, salePrice: 55000, stock: 8, unit: "pièce", minStock: 3 },
  { name: "Cabine de douche 80x80", reference: "SAN-CD-003", category: "SANITAIRE", purchasePrice: 85000, salePrice: 120000, stock: 4, unit: "pièce", minStock: 2 },
  { name: "Tube PVC Ø100 (barre 4m)", reference: "PLB-PVC-100", category: "PLOMBERIE", purchasePrice: 6500, salePrice: 9500, stock: 40, unit: "barre", minStock: 10 },
  { name: "Coude PVC 90° Ø100", reference: "PLB-COD-100", category: "PLOMBERIE", purchasePrice: 1500, salePrice: 2500, stock: 60, unit: "pièce", minStock: 15 },
  { name: "Plafonnier LED 24W rond", reference: "LUM-LED-024", category: "LUMINAIRE", purchasePrice: 5500, salePrice: 8500, stock: 30, unit: "pièce", minStock: 8 },
  { name: "Lustre moderne 5 branches doré", reference: "LUM-LUS-005", category: "LUMINAIRE", purchasePrice: 55000, salePrice: 85000, stock: 5, unit: "pièce", minStock: 2 },
  { name: "Ampoule LED E27 9W", reference: "ELE-AMP-009", category: "ELECTRICITE", purchasePrice: 700, salePrice: 1500, stock: 150, unit: "pièce", minStock: 30 },
  { name: "Interrupteur simple blanc Legrand", reference: "ELE-INT-001", category: "ELECTRICITE", purchasePrice: 1800, salePrice: 3500, stock: 45, unit: "pièce", minStock: 10 },
  { name: "Câble électrique 2,5mm² (rouleau 100m)", reference: "ELE-CAB-250", category: "ELECTRICITE", purchasePrice: 32000, salePrice: 45000, stock: 14, unit: "rouleau", minStock: 5 },
  { name: "Kit goutte-à-goutte 100m", reference: "GAG-KIT-100", category: "GOUTTE_A_GOUTTE", purchasePrice: 28000, salePrice: 42000, stock: 9, unit: "kit", minStock: 3 },
  { name: "Goutteur régulé 4L/h (lot de 50)", reference: "GAG-GTT-050", category: "GOUTTE_A_GOUTTE", purchasePrice: 7500, salePrice: 12000, stock: 20, unit: "lot", minStock: 5 },
  { name: "Tube PPR Ø25 (barre 4m)", reference: "TUY-PPR-025", category: "TUYAUTERIE", purchasePrice: 2800, salePrice: 4500, stock: 50, unit: "barre", minStock: 12 },
  { name: "Coude PPR Ø25 femelle", reference: "TUY-COD-025", category: "TUYAUTERIE", purchasePrice: 900, salePrice: 1600, stock: 80, unit: "pièce", minStock: 20 },
  { name: "Miroir rectangulaire 60x80 avec cadre", reference: "MIR-6080-01", category: "MIROITERIE", purchasePrice: 22000, salePrice: 35000, stock: 6, unit: "pièce", minStock: 2 },
  { name: "Miroir rond lumineux Ø60", reference: "MIR-RND-060", category: "MIROITERIE", purchasePrice: 32000, salePrice: 50000, stock: 2, unit: "pièce", minStock: 2 },
  { name: "Mitigeur lavabo chromé", reference: "ROB-MIT-LAV", category: "ROBINETTERIE", purchasePrice: 12500, salePrice: 20000, stock: 18, unit: "pièce", minStock: 5 },
  { name: "Robinet d'arrêt Ø15", reference: "ROB-ARR-015", category: "ROBINETTERIE", purchasePrice: 2500, salePrice: 4000, stock: 35, unit: "pièce", minStock: 10 },
  { name: "Pompe surpresseur 800W", reference: "POM-SUR-800", category: "POMPE", purchasePrice: 65000, salePrice: 95000, stock: 6, unit: "pièce", minStock: 2 },
  { name: "Pompe immergée 1CV", reference: "POM-IMM-100", category: "POMPE", purchasePrice: 95000, salePrice: 140000, stock: 3, unit: "pièce", minStock: 2 },
  { name: "Chasse de douche complète", reference: "CHS-DCH-001", category: "CHASSE_DOUCHE", purchasePrice: 8500, salePrice: 14000, stock: 15, unit: "pièce", minStock: 4 },
  { name: "Réservoir WC plastique double chasse", reference: "RES-WC-002", category: "RESERVOIR_EAU", purchasePrice: 15000, salePrice: 24000, stock: 10, unit: "pièce", minStock: 3 },
  { name: "Cuve réservoir d'eau 1000L", reference: "RES-EAU-1000", category: "RESERVOIR_EAU", purchasePrice: 75000, salePrice: 105000, stock: 1, unit: "pièce", minStock: 2 },
];

const CLIENTS = [
  { name: "M. Abdoulaye Diop", phone: "+221 77 512 34 56", email: "a.diop@gmail.com", address: "Sacré-Cœur 3, Dakar", type: "PARTICULIER" },
  { name: "Mme Fatou Ndiaye", phone: "+221 76 998 12 34", email: "fatou.ndiaye@yahoo.fr", address: "Ouakam, Dakar", type: "PARTICULIER" },
  { name: "SARL BTP Teranga", phone: "+221 33 869 00 11", email: "contact@btpteranga.sn", address: "Zone industrielle, Rufisque", type: "ENTREPRISE" },
  { name: "Entreprise SENELEC Services", phone: "+221 33 839 50 00", email: "services@senelec.sn", address: "Médina, Dakar", type: "ENTREPRISE" },
  { name: "M. Ibrahima Sarr", phone: "+221 70 223 45 67", email: "ibrahima.sarr@hotmail.fr", address: "Guédiawaye, Dakar", type: "PARTICULIER" },
];

async function main() {
  console.log("── Restauration du catalogue (aucune donnée existante n'est supprimée) ──");

  console.log("Catégories…");
  for (const cat of CATEGORIES) {
    await db.category.upsert({ where: { code: cat.code }, update: {}, create: cat });
  }

  console.log("Produits (avec prix)…");
  let created = 0;
  let kept = 0;
  for (const p of PRODUCTS) {
    // Correspondance par référence OU par nom : évite les doublons si la base
    // existante contient les mêmes produits sous une référence différente.
    const existing = await db.product.findFirst({
      where: { OR: [{ reference: p.reference }, { name: p.name }] },
    });
    if (existing) {
      // Le produit existe : on ne modifie QUE les prix s'ils sont à 0 (ne jamais écraser une saisie utilisateur)
      if (existing.purchasePrice === 0 && existing.salePrice === 0) {
        await db.product.update({
          where: { id: existing.id },
          data: { purchasePrice: p.purchasePrice, salePrice: p.salePrice },
        });
        created++;
      } else {
        kept++;
      }
      continue;
    }
    await db.product.create({ data: p });
    created++;
  }

  console.log("Clients…");
  for (const c of CLIENTS) {
    const exists = await db.client.findFirst({ where: { name: c.name } });
    if (!exists) await db.client.create({ data: c });
  }

  const [nbProducts, nbClients, nbCategories] = await Promise.all([
    db.product.count(),
    db.client.count(),
    db.category.count(),
  ]);
  console.log(`✔ Terminé — ${created} produit(s) créé(s)/prix corrigé(s), ${kept} conservé(s)`);
  console.log(`✔ État : ${nbProducts} produits · ${nbClients} clients · ${nbCategories} catégories`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
