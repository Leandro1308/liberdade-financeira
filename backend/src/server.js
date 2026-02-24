// backend/src/server.js
import "dotenv/config";
import mongoose from "mongoose";
import app from "./app.js";

import { User } from "./models/User.js";
import { getSubscriptionContract } from "./services/web3.js";

const PORT = process.env.PORT || 3000;

function isSrvDnsError(err) {
  const msg = String(err?.message || "");
  return err?.code === "ENOTFOUND" || msg.includes("querySrv") || msg.includes("_mongodb._tcp");
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

// ================================
// Worker: renovação gasless (C1)
// - DESLIGADO por padrão (Opção A)
// - Só liga se ENABLE_RENEWAL_WORKER=true e houver OPERATOR_PRIVATE_KEY
// ================================
let renewalRunning = false;

function isTrue(v) {
  return String(v || "").trim().toLowerCase() === "true";
}

function canRunRenewalWorker() {
  // Opção A: por padrão NÃO roda
  if (!isTrue(process.env.ENABLE_RENEWAL_WORKER)) return false;

  // Renovação "gasless" exige operador
  const hasWeb3 =
    !!process.env.BSC_RPC_URL &&
    !!process.env.OPERATOR_PRIVATE_KEY &&
    !!process.env.SUBSCRIPTION_CONTRACT;

  return hasWeb3;
}

async function runRenewalTick() {
  if (renewalRunning) return;
  renewalRunning = true;

  try {
    if (!canRunRenewalWorker()) return;

    const contract = await getSubscriptionContract();

    const cycleSecondsRaw = await contract.cycleSeconds();
    const cycleSeconds = Number(cycleSecondsRaw.toString());

    const now = new Date();

    const users = await User.find({
      "subscription.status": { $in: ["active", "past_due"] },
      "subscription.renovacaoAutomatica": true,
      "subscription.currentPeriodEnd": { $ne: null, $lte: now },
      walletAddress: { $ne: null },
    })
      .select("_id walletAddress subscription")
      .limit(50)
      .lean();

    if (!users.length) return;

    console.log(`🔁 RenewalTick: ${users.length} vencidos`);

    for (const u of users) {
      try {
        const tx = await contract.renew(u.walletAddress);
        await tx.wait();

        const newEnd = new Date(now.getTime() + cycleSeconds * 1000);

        await User.updateOne(
          { _id: u._id },
          {
            $set: {
              "subscription.status": "active",
              "subscription.currentPeriodEnd": newEnd,
            },
          }
        );

        console.log(`✅ Renew OK: ${u.walletAddress} -> ${newEnd.toISOString()}`);
      } catch (e) {
        await User.updateOne({ _id: u._id }, { $set: { "subscription.status": "past_due" } });
        console.log(`⚠️ Renew FAIL: ${u.walletAddress} :: ${e?.message || e}`);
      }
    }
  } catch (e) {
    console.log("⚠️ RenewalTick error:", e?.message || e);
  } finally {
    renewalRunning = false;
  }
}

function startRenewalWorker() {
  if (!canRunRenewalWorker()) {
    console.log("🧠 Renewal worker DESLIGADO (Opção A).");
    return;
  }

  setInterval(runRenewalTick, 10 * 60 * 1000); // 10 min
  setTimeout(runRenewalTick, 30 * 1000); // 30s após subir
  console.log("🧠 Renewal worker ATIVO (10min).");
}

async function start() {
  try {
    await connectDB();

    app.listen(PORT, () => {
      console.log(`✅ API rodando na porta ${PORT}`);
    });

    startRenewalWorker();
  } catch (err) {
    console.error("❌ Erro ao iniciar o servidor:", err);
    process.exit(1);
  }
}

start();
