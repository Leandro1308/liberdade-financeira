// backend/src/config/env.js (ESM)

export const env = {
  NODE_ENV: process.env.NODE_ENV || "production",
  PORT: process.env.PORT ? Number(process.env.PORT) : 3000,

  // Auth
  JWT_SECRET: process.env.JWT_SECRET || "",
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || "7d",

  // Mongo
  MONGO_URI: process.env.MONGO_URI || "",
  MONGO_URI_STANDARD: process.env.MONGO_URI_STANDARD || "",

  // Web3 (Opção A: usuário assina approve/subscribe/renew via MetaMask)
  // OPERATOR_PRIVATE_KEY fica reservado para uma fase futura (worker/gasless), não é obrigatório agora.
  BSC_RPC_URL: process.env.BSC_RPC_URL || "",
  OPERATOR_PRIVATE_KEY: process.env.OPERATOR_PRIVATE_KEY || "",
  SUBSCRIPTION_CONTRACT: process.env.SUBSCRIPTION_CONTRACT || "",
  USDT_ADDRESS: process.env.USDT_ADDRESS || "",

  // Web3 safety
  BSC_CHAIN_ID: process.env.BSC_CHAIN_ID ? Number(process.env.BSC_CHAIN_ID) : 56,
  WEB3_RPC_TIMEOUT_MS: process.env.WEB3_RPC_TIMEOUT_MS
    ? Number(process.env.WEB3_RPC_TIMEOUT_MS)
    : 2500,
  WEB3_COOLDOWN_MS: process.env.WEB3_COOLDOWN_MS
    ? Number(process.env.WEB3_COOLDOWN_MS)
    : 30000,
};

// Avisos (não derruba o servidor)
if (!env.JWT_SECRET) {
  console.warn("⚠️ ENV: JWT_SECRET não definido. Login/autenticação irão falhar.");
}

if (!env.MONGO_URI && !env.MONGO_URI_STANDARD) {
  console.warn("⚠️ ENV: MONGO_URI e MONGO_URI_STANDARD não definidos. Mongo irá falhar.");
}

// Opção A: mínimo necessário para ler estado on-chain e validar transações
if (!env.BSC_RPC_URL || !env.SUBSCRIPTION_CONTRACT || !env.USDT_ADDRESS) {
  console.warn(
    "⚠️ ENV: WEB3 incompleto (BSC_RPC_URL / SUBSCRIPTION_CONTRACT / USDT_ADDRESS). Rotas on-chain retornarão 503."
  );
}

// Operador é opcional nesta fase (só para worker/gasless no futuro)
if (!env.OPERATOR_PRIVATE_KEY) {
  console.warn(
    "ℹ️ ENV: OPERATOR_PRIVATE_KEY não definido (OK na Opção A). Worker/gasless ficará desabilitado."
  );
}
