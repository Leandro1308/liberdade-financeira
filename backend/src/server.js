import express from "express";

const app = express();

// Middleware básico
app.use(express.json());

// Health check (OBRIGATÓRIO para Render)
app.get("/health", (req, res) => {
  res.status(200).json({
    ok: true,
    service: "liberdade-financeira-api",
    timestamp: new Date().toISOString()
  });
});

// Rota padrão (opcional, mas ajuda)
app.get("/", (req, res) => {
  res.json({ message: "API Liberdade Financeira online" });
});

// Porta (Render injeta automaticamente)
const PORT = process.env.PORT || 10000;

app.listen(PORT, () => {
  console.log(`🚀 Backend rodando na porta ${PORT}`);
});
