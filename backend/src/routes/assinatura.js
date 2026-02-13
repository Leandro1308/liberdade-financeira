// backend/src/routes/assinatura.js (ESM)
import express from "express";
import { requireAuth } from "../middleware/auth.js";
import { User } from "../models/User.js";

import { ethers } from "ethers";
import { env } from "../config/env.js";

const router = express.Router();

// ================================
// WEB3 (somente se envs existirem)
// ================================
let provider = null;
let wallet = null;
let contract = null;

function initWeb3() {
  if (contract) return; // já inicializado

  const RPC_URL = env.BSC_RPC_URL;
  const PRIVATE_KEY = env.OPERATOR_PRIVATE_KEY;
  const CONTRACT_ADDRESS = env.SUBSCRIPTION_CONTRACT;

  if (!RPC_URL || !PRIVATE_KEY || !CONTRACT_ADDRESS) return;

  provider = new ethers.JsonRpcProvider(RPC_URL);
  wallet = new ethers.Wallet(PRIVATE_KEY, provider);

  const abi = [
    "function subscribe(address user, address directReferrer) external",
    "function renew(address user) external",
    "function price() view returns (uint256)",
    "function txFeeBps() view returns (uint16)"
  ];

  contract = new ethers.Contract(CONTRACT_ADDRESS, abi, wallet);
}

// ==================================
// GET /api/assinatura/status
// (compatível com o que você já tinha)
// ==================================
router.get("/status", requireAuth, async (req, res) => {
  const user = await User.findById(req.user._id || req.user.id).select("-passwordHash");
  if (!user) return res.status(404).json({ error: "USER_NOT_FOUND" });

  res.json({
    status: user.subscription?.status || "inactive",
    plan: user.subscription?.plan || "mensal",
    price: "onchain", // compat: existia "price" no antigo db.json
    updatedAt: new Date().toISOString()
  });
});

// ==================================
// POST /api/assinatura/toggle
// (mantido para seu modo teste atual)
// ==================================
router.post("/toggle", requireAuth, async (req, res) => {
  const user = await User.findById(req.user._id || req.user.id);
  if (!user) return res.status(404).json({ error: "USER_NOT_FOUND" });

  const current = user.subscription?.status || "inactive";
  const next = current === "active" ? "inactive" : "active";

  user.subscription.status = next;

  // opcional: se ativar, coloca um vencimento “didático” de 30 dias
  if (next === "active") {
    user.subscription.currentPeriodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  }

  await user.save();
  res.json({ status: user.subscription.status });
});

// ==================================
// POST /api/assinatura/ativar
// (on-chain: só usar quando for cobrar de verdade)
// body: { wallet: "0x...", referrer?: "0x..." }
// ==================================
router.post("/ativar", requireAuth, async (req, res) => {
  try {
    initWeb3();
    if (!contract) return res.status(500).json({ error: "WEB3_NOT_CONFIGURED" });

    const userWallet = String(req.body?.wallet || "").trim();
    const referrer = String(req.body?.referrer || "").trim();

    if (!ethers.isAddress(userWallet)) {
      return res.status(400).json({ error: "INVALID_WALLET" });
    }

    const referrerAddr = ethers.isAddress(referrer) ? referrer : ethers.ZeroAddress;

    // (não executaremos pagamento agora se você não quiser,
    // mas a rota fica pronta. Quando liberar, ela funciona.)
    const tx = await contract.subscribe(userWallet, referrerAddr);
    const receipt = await tx.wait();

    const user = await User.findById(req.user._id || req.user.id);
    if (!user) return res.status(404).json({ error: "USER_NOT_FOUND" });

    user.subscription.status = "active";
    user.subscription.currentPeriodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await user.save();

    res.json({ ok: true, txHash: tx.hash, blockNumber: receipt?.blockNumber });
  } catch (err) {
    console.error("❌ ONCHAIN_ERROR:", err?.message || err);
    res.status(500).json({ error: "ONCHAIN_ERROR" });
  }
});

export default router;
