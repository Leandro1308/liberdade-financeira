// backend/src/config/env.js (ESM)
// Este arquivo existe para atender o import do middleware/auth.js

export const env = {
  NODE_ENV: process.env.NODE_ENV || "production",
  PORT: process.env.PORT ? Number(process.env.PORT) : 3000,

  // Auth
  JWT_SECRET: process.env.JWT_SECRET || "",
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || "7d", // ✅ ADICIONADO (fallback)

  // Web3 (usado na assinatura)
  BSC_RPC_URL: process.env.BSC_RPC_URL || "",
  OPERATOR_PRIVATE_KEY: process.env.OPERATOR_PRIVATE_KEY || "",
  SUBSCRIPTION_CONTRACT: process.env.SUBSCRIPTION_CONTRACT || "",
  USDT_ADDRESS: process.env.USDT_ADDRESS || "",
};

// Avisos (não derruba o servidor)
if (!env.JWT_SECRET) {
  console.warn("⚠️ ENV: JWT_SECRET não definido. Login/autenticação irão falhar.");
}
if (!env.JWT_EXPIRES_IN) {
  console.warn("⚠️ ENV: JWT_EXPIRES_IN não definido. Usando fallback.");
}
if (!env.BSC_RPC_URL || !env.OPERATOR_PRIVATE_KEY || !env.SUBSCRIPTION_CONTRACT) {
  console.warn(
    "⚠️ ENV: WEB3 incompleto (BSC_RPC_URL / OPERATOR_PRIVATE_KEY / SUBSCRIPTION_CONTRACT). Rotas on-chain não funcionarão."
  );
}
