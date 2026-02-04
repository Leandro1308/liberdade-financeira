// backend/src/app.js (ESM)
import express from "express";
import path from "path";
import { fileURLToPath } from "url";

import pingRoutes from "./routes/ping.routes.js";

const app = express();

// =========================
// Helpers de path (ESM)
// =========================
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ✅ Ajuste: repo root -> /frontend
// (backend/src) -> (backend) -> (repo root) -> (frontend)
const FRONTEND_DIR = path.join(__dirname, "..", "..", "frontend");

// =========================
// Middlewares básicos
// =========================
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

// (Opcional) log simples de requisições — útil no Render
app.use((req, res, next) => {
  console.log(`➡️ ${req.method} ${req.url}`);
  next();
});

// =========================
// Servir FRONTEND (arquivos estáticos)
// =========================
// Isso permite acessar: /assets/app.css, /login.html, /assinatura.html etc.
app.use(express.static(FRONTEND_DIR));

// =========================
// Rotas da API
// =========================
app.use("/api", pingRoutes);

// =========================
// Rotas públicas
// =========================
// Agora "/" serve o frontend bonito (index.html)
app.get("/", (req, res) => {
  res.sendFile(path.join(FRONTEND_DIR, "index.html"));
});

// Mantém health como JSON (útil pra monitoramento do Render)
app.get("/health", (req, res) => {
  res.status(200).json({
    ok: true,
    service: "liberdade-financeira-backend",
    timestamp: new Date().toISOString(),
  });
});

// =========================
// 404 (rota não encontrada)
// =========================
app.use((req, res) => {
  const accept = req.headers.accept || "";
  if (accept.includes("text/html")) {
    // devolve o index pra navegação do navegador
    return res.status(404).sendFile(path.join(FRONTEND_DIR, "index.html"));
  }

  res.status(404).json({
    ok: false,
    error: "Rota não encontrada",
  });
});

export default app;
