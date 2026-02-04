// src/app.js (ESM)
import express from "express";

const app = express();

// --- Middlewares básicos
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

// --- Rotas básicas
app.get("/health", (req, res) => {
  res.status(200).json({
    ok: true,
    service: "liberdade-financeira-backend",
    timestamp: new Date().toISOString(),
  });
});

// 404 (opcional, mas útil)
app.use((req, res) => {
  res.status(404).json({ ok: false, error: "Rota não encontrada" });
});

export default app;
