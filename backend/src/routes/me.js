import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

router.get("/", requireAuth, async (req, res) => {
  return res.json({
    user: {
      name: req.user.name,
      email: req.user.email,
      affiliateCode: req.user.affiliateCode,
      referrerCode: req.user.referrerCode,
      subscription: req.user.subscription
    }
  });
});

export default router;
