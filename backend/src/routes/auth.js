// backend/src/routes/auth.js
const express = require("express");
const { createUser, login } = require("../services/authService");

const router = express.Router();

router.post("/register", (req, res) => {
  try {
    const { email, password } = req.body || {};
    const user = createUser({ email, password });
    res.status(201).json({ user });
  } catch (e) {
    const code = String(e.message || "ERROR");
    const status = code === "EMAIL_ALREADY_USED" ? 409 : 400;
    res.status(status).json({ error: code });
  }
});

router.post("/login", (req, res) => {
  try {
    const { email, password } = req.body || {};
    const result = login({ email, password });
    res.json(result);
  } catch (e) {
    res.status(401).json({ error: "INVALID_CREDENTIALS" });
  }
});

module.exports = router;
