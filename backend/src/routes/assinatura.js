// backend/src/routes/assinatura.js (ESM)
import express from "express";
import * as auth from "../middleware/auth.js"; // ✅ usa o caminho que você tem: middleware/auth.js
import { User } from "../models/User.js";
import { ethers } from "ethers";

const router = express.Router();

// ✅ compatibilidade: authRequired pode estar como export nomeado OU default
const authRequired =
  auth.authRequired ||
  auth.default?.authRequired ||
  auth.default;

if (typeof authRequired !== "function") {
  console.warn("⚠️ authRequired não encontrado em ../middleware/auth.js");
}

// ================================
// CONFIG WEB3 (via ENV do Render)
// ================================
const RPC_URL = process.env.BSC_RPC_URL;
const PRIVATE_KEY = process.env.OPERATOR_PRIVATE_KEY;
const CONTRACT_ADDRESS = process.env.SUBSCRIPTION_CONTRACT;

let provider;
let wallet;
let contract;

if (RPC_URL && PRIVATE_KEY && CONTRACT_ADDRESS) {
  provider = new ethers.JsonRpcProvider(RPC_URL);
  wallet = new ethers.Wallet(PRIVATE_KEY, provider);

  const abi = [
    "function subscribe(address user, address directReferrer) external",
    "function renew(address user) external"
  ];

  contract = new ethers.Contract(CONTRACT_ADDRESS, abi, wallet);
} else {
  console.warn("⚠️ WEB3 não configurado: faltam envs BSC_RPC_URL / OPERATOR_PRIVATE_KEY / SUBSCRIPTION_CONTRACT");
}

// ==================================
// STATUS DA ASSINATURA (MongoDB)
// ==================================
router.get("/status", authRequired, async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user) return res.status(404).json({ error: "USER_NOT_FOUND" });

  res.json({
    status: user.subscription.status,
    plan: user.subscription.plan,
    renovacaoAutomatica: user.subscription.renovacaoAutomatica,
    currentPeriodEnd: user.subscription.currentPeriodEnd,
  });
});

// ==================================
// ATIVAÇÃO ON-CHAIN (vamos usar depois)
// ==================================
router.post("/ativar", authRequired, async (req, res) => {
  try {
    if (!contract) {
      return res.status(500).json({ error: "WEB3_NOT_CONFIGURED" });
    }

    const userAddress = req.body.wallet;
    const referrerAddress = req.body.referrer || ethers.ZeroAddress;

    const tx = await contract.subscribe(userAddress, referrerAddress);
    await tx.wait();

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: "USER_NOT_FOUND" });

    user.subscription.status = "active";
    user.subscription.currentPeriodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await user.save();

    res.json({ ok: true, txHash: tx.hash });
  } catch (err) {
    console.error("❌ ONCHAIN_ERROR:", err?.message || err);
    res.status(500).json({ error: "ONCHAIN_ERROR" });
  }
});

export default router;
