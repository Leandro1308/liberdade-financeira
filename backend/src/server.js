// backend/src/server.js
const express = require("express");
const helmet = require("helmet");
const cors = require("cors");

const authRoutes = require("./routes/auth");
const usersRoutes = require("./routes/users");
const afiliadosRoutes = require("./routes/afiliados");
const assinaturaRoutes = require("./routes/assinatura");

const app = express();

// Middlewares básicos
app.use(helmet());
app.use(cors({ origin: "*", methods: ["GET", "POST", "PUT", "PATCH", "DELETE"] }));
app.use(express.json({ limit: "200kb" }));

// Health check
app.get("/health", (req, res) => {
  res.json({ ok: true, name: "liberdade-financeira-backend" });
});

// Rotas API
app.use("/api/auth", authRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/afiliados", afiliadosRoutes);
app.use("/api/assinatura", assinaturaRoutes);

// 404
app.use((req, res) => {
  res.status(404).json({ error: "Not Found" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`[LF] Backend rodando na porta ${PORT}`);
});
