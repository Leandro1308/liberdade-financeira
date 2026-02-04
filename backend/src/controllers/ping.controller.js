// backend/src/controllers/ping.controller.js
import Ping from "../models/Ping.js";

export async function pingDb(req, res) {
  try {
    // Cria um registro no MongoDB
    const ping = await Ping.create({
      message: "Ping MongoDB OK",
    });

    // Conta quantos documentos existem
    const total = await Ping.countDocuments();

    return res.status(200).json({
      ok: true,
      lastPing: ping,
      totalDocuments: total,
    });
  } catch (error) {
    console.error("Erro no pingDb:", error);

    return res.status(500).json({
      ok: false,
      error: "Erro ao acessar o MongoDB",
    });
  }
}
