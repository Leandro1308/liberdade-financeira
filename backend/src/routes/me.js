// backend/src/routes/me.js
import { Router } from "express";
import { z } from "zod";
import { ethers } from "ethers";

import { requireAuth } from "../middleware/auth.js";
import { User } from "../models/User.js";

const router = Router();

router.get("/", requireAuth, async (req, res) => {
  const user = {
    name: req.user.name,
    email: req.user.email,
    affiliateCode: req.user.affiliateCode,
    referrerCode: req.user.referrerCode,
    walletAddress: req.user.walletAddress || null,
    subscription: req.user.subscription,
  };

  // ✅ mantém o formato atual (user:{...})
  // ✅ e espelha no topo para não quebrar telas antigas
  return res.json({
    user,
    ...user,
  });
});

const WalletSchema = z.object({
  walletAddress: z.string().min(10).optional(),
  wallet: z.string().min(10).optional(),
});

router.post("/wallet", requireAuth, async (req, res) => {
  const parsed = WalletSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Dados inválidos" });

  const raw = (parsed.data.walletAddress || parsed.data.wallet || "").trim();
  if (!raw) return res.status(400).json({ error: "Dados inválidos" });

  let wallet;
  try {
    wallet = ethers.getAddress(raw);
  } catch {
    return res.status(400).json({ error: "Wallet inválida" });
  }

  await User.updateOne({ _id: req.user._id }, { $set: { walletAddress: wallet } });

  return res.json({ ok: true, walletAddress: wallet });
});

export default router;
