// backend/src/app.js (ESM)
import express from "express";
import pingRoutes from "./routes/ping.routes.js";

const app = express();

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
// Rotas da API
// =========================
app.use("/api", pingRoutes);

// =========================
// Rotas públicas
// =========================
app.get("/", (req, res) => {
  res.status(200).json({
    ok: true,
    message: "API Liberdade Financeira / Curadamente online",
  });
});

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
  res.status(404).json({
    ok: false,
    error: "Rota não encontrada",
  });
});

// =========================
// Export default (NECESSÁRIO)
// =========================
export default app;
