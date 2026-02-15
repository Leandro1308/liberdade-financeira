// backend/src/routes/assinatura.js (ESM)
import { Router } from "express";
import { z } from "zod";
import { ethers } from "ethers";

import { requireAuth } from "../middleware/auth.js";
import { User } from "../models/User.js";
import { getSubscriptionContract, getErc20 } from "../services/web3.js";

const router = Router();

const SubscribeSchema = z.object({
  walletAddress: z.string().min(10),
  referrerCode: z.string().min(3).max(40).optional().nullable()
});

// ✅ params públicos: preço, taxa, token, etc.
router.get("/params", async (req, res) => {
  try {
    const c = getSubscriptionContract();

    const [price, txFeeBps, cycleSeconds, token, treasury, gasVault] = await Promise.all([
      c.price(),
      c.txFeeBps(),
      c.cycleSeconds(),
      c.token(),
      c.treasury(),
      c.gasVault()
    ]);

    return res.json({
      ok: true,
      contractAddress: c.target, // ✅ importante pro approve no frontend
      token,
      treasury,
      gasVault,
      price: price.toString(),
      txFeeBps: Number(txFeeBps),
      cycleSeconds: cycleSeconds.toString()
    });
  } catch (e) {
    console.error("assinatura/params error:", e?.message || e);
    return res.status(500).json({ ok: false, error: "PARAMS_UNAVAILABLE" });
  }
});

// ✅ status baseado no Mongo
router.get("/status", requireAuth, async (req, res) => {
  return res.json({
    ok: true,
    subscription: req.user.subscription,
    walletAddress: req.user.walletAddress || null
  });
});

// ✅ subscribe gasless: operador paga gás, contrato puxa USDT do usuário (allowance)
router.post("/subscribe", requireAuth, async (req, res) => {
  const parsed = SubscribeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Dados inválidos" });

  const userId = req.user._id.toString();

  let userWallet;
  try {
    userWallet = ethers.getAddress(parsed.data.walletAddress);
  } catch {
    return res.status(400).json({ error: "Wallet inválida" });
  }

  // salva wallet do usuário (se já existir, só mantém)
  await User.updateOne({ _id: userId }, { $set: { walletAddress: userWallet } });

  // referrer on-chain (se existir no sistema e tiver wallet)
  let directReferrerWallet = ethers.ZeroAddress;
  if (parsed.data.referrerCode) {
    const refUser = await User.findOne({ affiliateCode: parsed.data.referrerCode }).lean();
    if (refUser?.walletAddress) {
      try {
        directReferrerWallet = ethers.getAddress(refUser.walletAddress);
      } catch {
        directReferrerWallet = ethers.ZeroAddress;
      }
    }
  }

  try {
    const c = getSubscriptionContract();

    // valida allowance mínima antes de gastar gas
    const tokenAddress = await c.token();
    const erc20 = getErc20(tokenAddress); // provider read-only

    const [priceRaw, txFeeBpsRaw] = await Promise.all([c.price(), c.txFeeBps()]);
    const price = BigInt(priceRaw.toString());
    const txFeeBps = BigInt(txFeeBpsRaw.toString());

    // total = price * (1 + fee)
    const total = (price * (BigInt(10000) + txFeeBps)) / BigInt(10000);

    const allowance = await erc20.allowance(userWallet, c.target);
    const allow = BigInt(allowance.toString());

    if (allow < total) {
      return res.status(400).json({ error: "APPROVE_REQUIRED" });
    }

    // chama subscribe gasless
    const tx = await c.subscribe(userWallet, directReferrerWallet);
    const receipt = await tx.wait();

    // atualiza assinatura no Mongo
    const cycleSecondsRaw = await c.cycleSeconds();
    const cycleSeconds = Number(cycleSecondsRaw.toString());

    const now = new Date();
    const end = new Date(now.getTime() + cycleSeconds * 1000);

    await User.updateOne(
      { _id: userId },
      {
        $set: {
          "subscription.plan": "mensal",
          "subscription.status": "active",
          "subscription.currentPeriodEnd": end
        }
      }
    );

    return res.json({
      ok: true,
      txHash: receipt?.hash || tx?.hash,
      subscription: {
        plan: "mensal",
        status: "active",
        currentPeriodEnd: end
      }
    });
  } catch (e) {
    console.error("assinatura/subscribe error:", e?.message || e);
    return res.status(500).json({ error: "SUBSCRIBE_FAILED" });
  }
});

export default router;
