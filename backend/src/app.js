// backend/src/app.js (ESM)
import express from "express";
import path from "path";
import { fileURLToPath } from "url";

import pingRoutes from "./routes/ping.routes.js";
import assinaturaRoutes from "./routes/assinatura.js"; // ✅ assinatura

const app = express();

// =========================
// Helpers de path (ESM)
// =========================
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// (backend/src) -> (backend) -> (repo root) -> (frontend)
const FRONTEND_DIR = path.join(__dirname, "..", "..", "frontend");

// =========================
// Middlewares básicos
// =========================
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

// log simples
app.use((req, res, next) => {
  console.log(`➡️ ${req.method} ${req.url}`);
  next();
});

// =========================
// Servir FRONTEND
// =========================
app.use(express.static(FRONTEND_DIR));

// =========================
// Rotas da API
// =========================
// ✅ IMPORTANTE: assinatura vem ANTES de /api
// para não ser "engolida" por um 404 interno do router /api
app.use("/api/assinatura", assinaturaRoutes);
app.use("/api", pingRoutes);

// =========================
// Rotas públicas
// =========================
app.get("/", (req, res) => {
  res.sendFile(path.join(FRONTEND_DIR, "index.html"));
});

app.get("/health", (req, res) => {
  res.status(200).json({
    ok: true,
    service: "liberdade-financeira-backend",
    timestamp: new Date().toISOString(),
  });
});

// =========================
// 404
// =========================
app.use((req, res) => {
  const accept = req.headers.accept || "";
  if (accept.includes("text/html")) {
    return res.status(404).sendFile(path.join(FRONTEND_DIR, "index.html"));
  }

  res.status(404).json({
    ok: false,
    error: "Rota não encontrada",
  });
});

export default app;
