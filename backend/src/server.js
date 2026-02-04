// backend/src/server.js
import "dotenv/config";
import mongoose from "mongoose";
import app from "./app.js";

const PORT = process.env.PORT || 3000;

function isSrvDnsError(err) {
  const msg = String(err?.message || "");
  return (
    err?.code === "ENOTFOUND" ||
    msg.includes("querySrv") ||
    msg.includes("_mongodb._tcp")
  );
}

async function connectDB() {
  const uriSrv = process.env.MONGO_URI;
  const uriStd = process.env.MONGO_URI_STANDARD;

  if (!uriSrv && !uriStd) {
    throw new Error("❌ Defina MONGO_URI e/ou MONGO_URI_STANDARD no Render.");
  }

  // 1) tenta SRV primeiro
  if (uriSrv) {
    try {
      await mongoose.connect(uriSrv, {
        serverSelectionTimeoutMS: 15000,
        autoIndex: false,
      });
      console.log("✅ MongoDB conectado via SRV (mongodb+srv).");
      return;
    } catch (err) {
      console.log("⚠️ Falha ao conectar via SRV:", err?.message);

      // só cai pro standard se for erro de DNS/SRV
      if (!isSrvDnsError(err)) throw err;

      console.log("🧩 Erro SRV/DNS detectado. Tentando STANDARD...");
    }
  }

  // 2) fallback STANDARD
  if (!uriStd) {
    throw new Error("❌ Falha SRV/DNS e MONGO_URI_STANDARD não está definida.");
  }

  await mongoose.connect(uriStd, {
    serverSelectionTimeoutMS: 15000,
    autoIndex: false,
  });
  console.log("✅ MongoDB conectado via STANDARD (mongodb://).");
}

async function start() {
  try {
    await connectDB();

    app.listen(PORT, () => {
      console.log(`✅ API rodando na porta ${PORT}`);
    });
  } catch (err) {
    console.error("❌ Erro ao iniciar o servidor:", err);
    process.exit(1);
  }
}

start();
