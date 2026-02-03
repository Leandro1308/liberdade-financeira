// backend/src/services/authService.js
const jwt = require("jsonwebtoken");
const { readDB, writeDB, generateId, nowISO } = require("../lib/db");

const JWT_SECRET = process.env.JWT_SECRET || "dev_secret_change_me";
const JWT_EXPIRES_IN = "7d";

// hash provisório (APENAS PARA ESTRUTURA INICIAL)
function weakHash(pwd) {
  return `weak_${Buffer.from(String(pwd)).toString("base64")}`;
}
function weakCompare(pwd, hashed) {
  return weakHash(pwd) === hashed;
}

function createUser({ email, password }) {
  const db = readDB();

  const normalizedEmail = String(email || "").trim().toLowerCase();
  if (!normalizedEmail || !password) {
    throw new Error("EMAIL_AND_PASSWORD_REQUIRED");
  }

  const exists = db.users.find(u => u.email === normalizedEmail);
  if (exists) throw new Error("EMAIL_ALREADY_USED");

  const userId = generateId("usr");
  const user = {
    id: userId,
    email: normalizedEmail,
    passwordHash: weakHash(password),
    createdAt: nowISO()
  };

  // assinatura simulada (inativa por padrão)
  const sub = {
    id: generateId("sub"),
    userId,
    status: "inactive",
    plan: "monthly",
    price: "1 USDT",
    createdAt: nowISO(),
    updatedAt: nowISO()
  };

  // afiliado
  const code = `ref_${Math.random().toString(36).slice(2, 8)}`;
  const affiliate = {
    id: generateId("aff"),
    userId,
    code,
    totalReferrals: 0,
    activeSubscriptions: 0,
    createdAt: nowISO(),
    updatedAt: nowISO()
  };

  db.users.push(user);
  db.subscriptions.push(sub);
  db.affiliates.push(affiliate);

  writeDB(db);
  return { id: user.id, email: user.email };
}

function login({ email, password }) {
  const db = readDB();
  const normalizedEmail = String(email || "").trim().toLowerCase();

  const user = db.users.find(u => u.email === normalizedEmail);
  if (!user) throw new Error("INVALID_CREDENTIALS");

  const ok = weakCompare(password, user.passwordHash);
  if (!ok) throw new Error("INVALID_CREDENTIALS");

  const token = jwt.sign(
    { sub: user.id, email: user.email },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );

  // registro simples (opcional)
  db.sessions.push({
    id: generateId("ses"),
    userId: user.id,
    createdAt: nowISO()
  });
  writeDB(db);

  return { token };
}

function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

module.exports = {
  createUser,
  login,
  verifyToken
};
