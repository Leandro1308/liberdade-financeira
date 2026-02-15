import { Router } from "express";
import { z } from "zod";
import { ethers } from "ethers";

import { requireAuth } from "../middleware/auth.js";
import { User } from "../models/User.js";

const router = Router();

router.get("/", requireAuth, async (req, res) => {
  return res.json({
    user: {
      name: req.user.name,
      email: req.user.email,
      affiliateCode: req.user.affiliateCode,
      referrerCode: req.user.referrerCode,
      walletAddress: req.user.walletAddress || null,
      subscription: req.user.subscription
    }
  });
});

const WalletSchema = z.object({
  walletAddress: z.string().min(10)
});

router.post("/wallet", requireAuth, async (req, res) => {
  const parsed = WalletSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Dados inválidos" });

  let wallet;
  try {
    wallet = ethers.getAddress(parsed.data.walletAddress);
  } catch {
    return res.status(400).json({ error: "Wallet inválida" });
  }

  await User.updateOne({ _id: req.user._id }, { $set: { walletAddress: wallet } });

  return res.json({ ok: true, walletAddress: wallet });
});

export default router;
