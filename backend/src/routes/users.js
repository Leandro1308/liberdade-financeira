// backend/src/routes/users.js
const express = require("express");
const { authRequired } = require("../middlewares/auth");
const { readDB } = require("../lib/db");

const router = express.Router();

router.get("/me", authRequired, (req, res) => {
  const db = readDB();
  const user = db.users.find(u => u.id === req.user.id);

  if (!user) return res.status(404).json({ error: "USER_NOT_FOUND" });

  res.json({
    id: user.id,
    email: user.email,
    createdAt: user.createdAt
  });
});

module.exports = router;
