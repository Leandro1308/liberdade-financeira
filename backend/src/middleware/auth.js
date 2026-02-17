import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { User } from "../models/User.js";

function extractToken(req) {
  // 1) Authorization: Bearer <token>
  const header = req.headers.authorization || "";
  const bearer = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (bearer) return bearer;

  // 2) Token via querystring (?t=...)
  const t = req.query?.t;
  if (t && typeof t === "string" && t.trim()) return t.trim();

  // 3) (Opcional) Token via cookie (se você usar cookie em algum lugar)
  const c = req.cookies?.token;
  if (c && typeof c === "string" && c.trim()) return c.trim();

  return null;
}

export async function requireAuth(req, res, next) {
  try {
    const token = extractToken(req);
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
