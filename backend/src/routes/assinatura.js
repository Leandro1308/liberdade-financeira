// backend/src/routes/assinatura.js (ESM)
import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { User } from "../models/User.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();

/**
 * GET /api/assinatura/status
 * Retorna o status atual da assinatura do usuário logado.
 */
router.get(
  "/status",
  requireAuth,
  asyncHandler(async (req, res) => {
    // req.user já vem do middleware/auth.js
    const sub = req.user?.subscription;

    if (!sub) {
      return res.status(404).json({ error: "SUBSCRIPTION_NOT_FOUND" });
    }

    return res.json({
      status: sub.status,
      plan: sub.plan,
      renovacaoAutomatica: sub.renovacaoAutomatica,
      currentPeriodEnd: sub.currentPeriodEnd,
    });
  })
);

/**
 * POST /api/assinatura/toggle
 * (APENAS TESTE) alterna active/inactive.
 * Quando integrar pagamento real, esse endpoint deve ser removido.
 */
router.post(
  "/toggle",
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = req.user?._id;
    if (!userId) return res.status(401).json({ error: "Não autenticado" });

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: "USER_NOT_FOUND" });

    const current = user.subscription?.status || "inactive";
    const next = current === "active" ? "inactive" : "active";

    user.subscription.status = next;

    // se ativar, cria um vencimento “padrão” 30 dias (somente teste)
    if (next === "active") {
      const now = new Date();
      user.subscription.currentPeriodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    } else {
      user.subscription.currentPeriodEnd = null;
    }

    await user.save();

    return res.json({
      status: user.subscription.status,
      currentPeriodEnd: user.subscription.currentPeriodEnd,
    });
  })
);

export default router;
