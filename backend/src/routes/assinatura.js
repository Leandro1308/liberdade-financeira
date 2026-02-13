// backend/src/routes/assinatura.js (ESM)
import express from "express";
import { authRequired } from "../middleware/auth.js";
import { User } from "../models/User.js";
import { ethers } from "ethers";

const router = express.Router();

// ================================
// CONFIG WEB3 (via ENV do Render)
// ================================
const RPC_URL = process.env.BSC_RPC_URL;
const PRIVATE_KEY = process.env.OPERATOR_PRIVATE_KEY;
const CONTRACT_ADDRESS = process.env.SUBSCRIPTION_CONTRACT;
const USDT_ADDRESS = process.env.USDT_ADDRESS;

let provider;
let wallet;
let contract;

if (RPC_URL && PRIVATE_KEY && CONTRACT_ADDRESS) {
  provider = new ethers.JsonRpcProvider(RPC_URL);
  wallet = new ethers.Wallet(PRIVATE_KEY, provider);

  const abi = [
    "function subscribe(address user, address referrer) external",
    "function renew(address user) external"
  ];

  contract = new ethers.Contract(CONTRACT_ADDRESS, abi, wallet);
}

// ==================================
// STATUS DA ASSINATURA (MongoDB)
// ==================================
router.get("/status", authRequired, async (req, res) => {
  const user = await User.findById(req.user.id);

  res.json({
    status: user.subscription.status,
    plan: user.subscription.plan,
    renovacaoAutomatica: user.subscription.renovacaoAutomatica,
    currentPeriodEnd: user.subscription.currentPeriodEnd
  });
});

// ==================================
// ATIVAÇÃO REAL (FUTURO ON-CHAIN)
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
    user.subscription.status = "active";
    user.subscription.currentPeriodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await user.save();

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "ONCHAIN_ERROR" });
  }
});

export default router;
