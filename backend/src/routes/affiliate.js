import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { User } from "../models/User.js";

const router = Router();

router.get("/summary", requireAuth, async (req, res) => {
  // Quantos usuários usaram meu code como referrer
  const totalIndicados = await User.countDocuments({ referrerCode: req.user.affiliateCode });

  return res.json({
    affiliateCode: req.user.affiliateCode,
    link: `/criar-conta.html?ref=${req.user.affiliateCode}`,
    totalIndicados
  });
});

export default router;
