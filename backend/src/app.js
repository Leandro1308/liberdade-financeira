// backend/src/app.js
import express from "express";

const app = express();

// Healthcheck simples (Render usa muito)
app.get("/health", (req, res) => {
  res.status(200).json({ ok: true, service: "liberdade-financeira-backend" });
});

export default app;
