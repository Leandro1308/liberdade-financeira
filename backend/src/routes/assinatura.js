// backend/src/routes/assinatura.js
const express = require("express");
const { authRequired } = require("../middlewares/auth");
const { readDB, writeDB, nowISO } = require("../lib/db");

const router = express.Router();

router.get("/status", authRequired, (req, res) => {
  const db = readDB();
  const sub = db.subscriptions.find(s => s.userId === req.user.id);
  if (!sub) return res.status(404).json({ error: "SUBSCRIPTION_NOT_FOUND" });

  res.json({
    status: sub.status,
    plan: sub.plan,
    price: sub.price,
    updatedAt: sub.updatedAt
  });
});

// (apenas para teste interno agora) alterna ativo/inativo
router.post("/toggle", authRequired, (req, res) => {
  const db = readDB();
  const sub = db.subscriptions.find(s => s.userId === req.user.id);
  if (!sub) return res.status(404).json({ error: "SUBSCRIPTION_NOT_FOUND" });

  sub.status = sub.status === "active" ? "inactive" : "active";
  sub.updatedAt = nowISO();

  writeDB(db);
  res.json({ status: sub.status });
});

module.exports = router;
