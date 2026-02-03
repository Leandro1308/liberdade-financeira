import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";

import { env } from "../config/env.js";
import { User } from "../models/User.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();

const RegisterSchema = z.object({
  name: z.string().min(2).max(80),
  email: z.string().email().max(120),
  password: z.string().min(8).max(72),
  ref: z.string().min(3).max(40).optional().nullable()
});

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(72)
});

function makeAffiliateCode() {
  // curto, sem caracteres confusos
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 8; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

function signToken(userId) {
  return jwt.sign(
    { sub: userId },
    env.JWT_SECRET,
    { expiresIn: env.JWT_EXPIRES_IN }
  );
}

router.post("/register", asyncHandler(async (req, res) => {
  const parsed = RegisterSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Dados inválidos" });

  const { name, email, password, ref } = parsed.data;

  const exists = await User.findOne({ email });
  if (exists) return res.status(409).json({ error: "E-mail já cadastrado" });

  const passwordHash = await bcrypt.hash(password, 12);

  // gera affiliateCode único
  let affiliateCode = makeAffiliateCode();
  while (await User.findOne({ affiliateCode })) affiliateCode = makeAffiliateCode();

  const user = await User.create({
    name,
    email,
    passwordHash,
    affiliateCode,
    referrerCode: ref || null,
    subscription: {
      plan: "mensal",
      status: "inactive",
      renovacaoAutomatica: true,
      currentPeriodEnd: null
    }
  });

  const token = signToken(user._id.toString());
  return res.status(201).json({
    token,
    user: {
      name: user.name,
      email: user.email,
      affiliateCode: user.affiliateCode,
      subscription: user.subscription
    }
  });
}));

router.post("/login", asyncHandler(async (req, res) => {
  const parsed = LoginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Dados inválidos" });

  const { email, password } = parsed.data;

  const user = await User.findOne({ email });
  if (!user) return res.status(401).json({ error: "Credenciais inválidas" });

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(401).json({ error: "Credenciais inválidas" });

  const token = signToken(user._id.toString());
  return res.json({
    token,
    user: {
      name: user.name,
      email: user.email,
      affiliateCode: user.affiliateCode,
      subscription: user.subscription
    }
  });
}));

// Endpoint para simular ativação (somente enquanto pagamento não entrou)
// Depois você remove isso e só ativa via webhook do gateway.
router.post("/activate", asyncHandler(async (req, res) => {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Não autenticado" });

  const payload = jwt.verify(token, env.JWT_SECRET);
  const user = await User.findById(payload.sub);
  if (!user) return res.status(401).json({ error: "Sessão inválida" });

  const now = new Date();
  const end = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  user.subscription.status = "active";
  user.subscription.currentPeriodEnd = end;
  await user.save();

  return res.json({ ok: true, subscription: user.subscription });
}));

export default router;
