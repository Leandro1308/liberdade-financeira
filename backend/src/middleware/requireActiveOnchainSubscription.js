// backend/src/middleware/requireActiveOnchainSubscription.js (ESM)
import { getOnchainSubscriptionStatus } from "../services/subscriptionOnchain.js";

/**
 * Middleware: valida assinatura 100% on-chain.
 * - Mongo não decide acesso.
 * - Sem wallet vinculada => 403
 * - Inativo on-chain => 403
 * - Falha RPC => 503 (bloqueia por segurança)
 */
export async function requireActiveOnchainSubscription(req, res, next) {
  try {
    const wallet = req.user?.walletAddress || null;

    if (!wallet) {
      return res.status(403).json({
        error: "WALLET_REQUIRED",
        message: "Vincule sua wallet para validar a assinatura.",
      });
    }

    const status = await getOnchainSubscriptionStatus(wallet);
    req.onchainSubscription = status; // disponível para a rota

    if (!status.ok) {
      return res.status(503).json({
        error: "ONCHAIN_UNAVAILABLE",
        message: "Não foi possível validar a assinatura na blockchain agora.",
        onchain: status,
      });
    }

    if (!status.active) {
      return res.status(403).json({
        error: "SUBSCRIPTION_INACTIVE",
        message: "Assinatura inativa.",
        onchain: status,
      });
    }

    return next();
  } catch (e) {
    return res.status(500).json({
      error: "ONCHAIN_MIDDLEWARE_ERROR",
      message: "Falha inesperada ao validar assinatura.",
      details: String(e?.message || e),
    });
  }
}
