import { Router } from "express";
import { requireAuth, requireActiveSubscription } from "../middleware/auth.js";

const router = Router();

// Conteúdo protegido (exemplo)
router.get("/modules", requireAuth, requireActiveSubscription, async (req, res) => {
  return res.json({
    modules: [
      { id: "orcamento", title: "Orçamento", items: 12 },
      { id: "dividas", title: "Dívidas", items: 9 },
      { id: "reserva", title: "Reserva", items: 6 },
      { id: "investimentos", title: "Investimentos", items: 14 }
    ]
  });
});

export default router;
