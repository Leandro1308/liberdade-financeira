import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Serve arquivos estáticos do /frontend (fora da pasta backend)
const FRONTEND_DIR = path.join(__dirname, "..", "..", "frontend");
app.use(express.static(FRONTEND_DIR));
const express = require("express");
const app = express();

// Middleware básico
app.use(express.json());

// Health check (Render)
app.get("/health", (req, res) => {
  res.status(200).json({
    ok: true,
    service: "liberdade-financeira-api",
    timestamp: new Date().toISOString(),
  });
});

// Rota raiz (para não ficar Not Found)
app.get("/", (req, res) => {
  res.status(200).json({ message: "API Liberdade Financeira online" });
});

// Fallback 404 em JSON (opcional, mas bom)
app.use((req, res) => {
  res.status(404).json({ error: "Not Found" });
});

const PORT = process.env.PORT || 10000;

app.listen(PORT, () => {
  console.log(`🚀 Backend rodando na porta ${PORT}`);
});
