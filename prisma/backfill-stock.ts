// Backfill stock : crée les mouvements INITIAUX manquants pour les produits
// dont le stock a été renseigné sans passer par le journal des mouvements
// (ex. restauration de démo). Rend le calcul d'inventaire cohérent :
// chaque produit reçoit un mouvement ENTREE/refType=INITIAL daté du
// premier jour du mois précédent (hors période courante).
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  const now = new Date();
  // Date de référence : 1er jour du mois précédent (-stock initial disponible avant la période courante)
  const backfillDate = new Date(now.getFullYear(), now.getMonth() - 1, 1, 9, 0, 0);

  const products = await db.product.findMany({ orderBy: { name: "asc" } });
  const productsWithMovements = await db.stockMovement.findMany({
    select: { productId: true },
    distinct: ["productId"],
  });
  const hasMovements = new Set(productsWithMovements.map((m) => m.productId));

  let created = 0;
  for (const p of products) {
    if (hasMovements.has(p.id)) continue; // a déjà un journal → ne rien toucher
    if (p.stock <= 0) continue; // stock nul → aucun mouvement nécessaire
    await db.stockMovement.create({
      data: {
        productId: p.id,
        type: "ENTREE",
        quantity: p.stock,
        stockBefore: 0,
        stockAfter: p.stock,
        reason: "Stock initial (backfill)",
        refType: "INITIAL",
        userName: "Système",
        createdAt: backfillDate,
      },
    });
    created += 1;
  }

  console.log(
    `Backfill stock OK : ${created} mouvement(s) INITIAL créé(s) (date ${backfillDate.toISOString().slice(0, 10)}).`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
