// backend/src/routes/afiliados.js
const express = require("express");
const { authRequired } = require("../middlewares/auth");
const { readDB } = require("../lib/db");

const router = express.Router();

router.get("/me", authRequired, (req, res) => {
  const db = readDB();
  const aff = db.affiliates.find(a => a.userId === req.user.id);
  if (!aff) return res.status(404).json({ error: "AFFILIATE_NOT_FOUND" });

  // URL base fictícia por enquanto
  const referralLink = `https://liberdade-financeira.app/?ref=${aff.code}`;

  res.json({
    code: aff.code,
    referralLink,
    totalReferrals: aff.totalReferrals,
    activeSubscriptions: aff.activeSubscriptions,
    earnings: null // em breve
  });
});

module.exports = router;
