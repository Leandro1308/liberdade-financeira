// backend/src/server.js
import "dotenv/config";
import mongoose from "mongoose";
import app from "./app.js";

const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
  console.error("❌ MONGO_URI não definida nas variáveis de ambiente.");
  process.exit(1);
}

async function start() {
  try {
    // Conexão MongoDB (Mongoose)
    await mongoose.connect(MONGO_URI, {
      // Node 22 + mongoose moderno: opções são opcionais, mas ok assim
      autoIndex: false, // boa prática em produção (evita index auto sem controle)
    });

    console.log("✅ MongoDB conectado");

    // Sobe o servidor
    app.listen(PORT, () => {
      console.log(`✅ API rodando na porta ${PORT}`);
    });
  } catch (err) {
    console.error("❌ Erro ao iniciar o servidor:", err);
    process.exit(1);
  }
}

start();
