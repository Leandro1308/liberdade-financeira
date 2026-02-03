/* backend/src/server.js */
const express = require("express");
const path = require("path");

const app = express();

// ---- Middlewares básicos
app.use(express.json({ limit: "1mb" }));

// ---- Health check (Render / Cloudflare)
app.get("/health", (req, res) => {
  return res.status(200).json({ message: "API Liberdade Financeira online" });
});

// ---- Servir o FRONTEND (pasta ../frontend)
const frontendDir = path.join(__dirname, "..", "..", "frontend");
app.use(express.static(frontendDir, { extensions: ["html"] }));

// Se alguém abrir "/", manda para o index.html
app.get("/", (req, res) => {
  return res.sendFile(path.join(frontendDir, "index.html"));
});

// Fallback: qualquer rota que não seja /api... tenta cair no frontend (SPA friendly)
app.get(/^\/(?!api\/).*/, (req, res) => {
  // Se a pessoa pedir /login.html, /dashboard.html etc, o express.static já resolve.
  // Aqui é só um fallback para rotas “sem .html”
  return res.sendFile(path.join(frontendDir, "index.html"));
});

// ---- 404 final (para rotas /api que não existirem)
app.use("/api", (req, res) => {
  return res.status(404).json({ error: "Not Found" });
});

// ---- Start
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`[LF] Backend rodando na porta ${PORT}`);
});
