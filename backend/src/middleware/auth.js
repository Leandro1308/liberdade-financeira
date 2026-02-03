import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { User } from "../models/User.js";

export async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;

    if (!token) return res.status(401).json({ error: "Não autenticado" });

    const payload = jwt.verify(token, env.JWT_SECRET);
    const user = await User.findById(payload.sub).select("-passwordHash");

    if (!user) return res.status(401).json({ error: "Sessão inválida" });

    req.user = user;
    return next();
  } catch {
    return res.status(401).json({ error: "Token inválido" });
  }
}

// Bloqueia conteúdo premium se assinatura não estiver ativa
export function requireActiveSubscription(req, res, next) {
  const sub = req.user?.subscription;
  if (!sub || sub.status !== "active") {
    return res.status(403).json({ error: "Assinatura inativa" });
  }
  return next();
}
