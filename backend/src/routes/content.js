// backend/src/routes/content.js
import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { requireActiveOnchainSubscription } from "../middleware/requireActiveOnchainSubscription.js";

const router = Router();

// Conteúdo protegido (exemplo)
router.get("/modules", requireAuth, requireActiveOnchainSubscription, async (req, res) => {
  return res.json({
    modules: [
      { id: "orcamento", title: "Orçamento", items: 12 },
      { id: "dividas", title: "Dívidas", items: 9 },
      { id: "reserva", title: "Reserva", items: 6 },
      { id: "investimentos", title: "Investimentos", items: 14 },
    ],
    // ajuda debug sem mudar fluxo
    onchain: req.onchainSubscription || null,
  });
});

export default router;
