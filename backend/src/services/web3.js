// backend/src/services/web3.js (ESM)
import { ethers } from "ethers";
import { env } from "../config/env.js";

/**
 * Objetivo:
 * - NÃO criar provider/contract no topo (durante import)
 * - Lazy init sob demanda
 * - Evitar loop infinito de "failed to detect network"
 * - Se RPC cair: rotas on-chain retornam 503 (sem derrubar servidor)
 */

const SUBSCRIPTION_ABI = [
  "function subscribe(address user, address directReferrer) external",
  "function renew(address user) external",
  "function cancel(address user) external",

  "function price() view returns (uint256)",
  "function txFeeBps() view returns (uint16)",
  "function cycleSeconds() view returns (uint256)",
  "function token() view returns (address)",
  "function treasury() view returns (address)",
  "function gasVault() view returns (address)",
];

const ERC20_ABI = [
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 value) returns (bool)",
  "function decimals() view returns (uint8)",
  "function balanceOf(address owner) view returns (uint256)",
];

const BSC_NETWORK = { name: "bsc", chainId: env.BSC_CHAIN_ID || 56 };

// cache (lazy)
let _provider = null;
let _operator = null;
let _subscription = null;

// cooldown de falha (pra não spammar logs / não criar provider a cada request)
let _lastRpcFailAt = 0;
let _lastRpcFailMsg = "";
let _failCount = 0;

function nowMs() {
  return Date.now();
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function withTimeout(promise, ms, code = "TIMEOUT") {
  let timer;
  const timeout = new Promise((_, rej) => {
    timer = setTimeout(() => rej(Object.assign(new Error(code), { code })), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

function isWeb3ReadyEnv() {
  return !!env.BSC_RPC_URL && !!env.OPERATOR_PRIVATE_KEY && !!env.SUBSCRIPTION_CONTRACT;
}

export function getWeb3State() {
  return {
    hasEnv: isWeb3ReadyEnv(),
    lastRpcFailAt: _lastRpcFailAt || null,
    lastRpcFailMsg: _lastRpcFailMsg || null,
    failCount: _failCount,
  };
}

function shouldCooldown() {
  const cooldownMs = env.WEB3_COOLDOWN_MS ?? 30_000;
  if (!_lastRpcFailAt) return false;
  return nowMs() - _lastRpcFailAt < cooldownMs;
}

function markRpcFail(err) {
  _lastRpcFailAt = nowMs();
  _lastRpcFailMsg = String(err?.message || err || "RPC_FAIL");
  _failCount += 1;
}

function clearRpcFail() {
  _lastRpcFailAt = 0;
  _lastRpcFailMsg = "";
  _failCount = 0;
}

/**
 * Lazy: cria provider só quando for realmente necessário.
 * Importante: passa network explícita para reduzir "detect network" agressivo.
 */
export function getProviderLazy() {
  if (!env.BSC_RPC_URL) throw new Error("ENV_BSC_RPC_URL_MISSING");

  if (_provider) return _provider;

  // network explícita evita parte do "startup detect network"
  _provider = new ethers.JsonRpcProvider(env.BSC_RPC_URL, BSC_NETWORK);
  return _provider;
}

/**
 * Healthcheck do RPC com timeout.
 * Se cair, não trava o servidor: apenas sinaliza indisponível.
 */
export async function assertRpcReady() {
  if (!isWeb3ReadyEnv()) throw new Error("WEB3_ENV_INCOMPLETE");
  if (shouldCooldown()) {
    const e = new Error("WEB3_RPC_COOLDOWN");
    e.code = "WEB3_RPC_COOLDOWN";
    throw e;
  }

  try {
    const provider = getProviderLazy();
    const timeoutMs = env.WEB3_RPC_TIMEOUT_MS ?? 2500;

    // operação leve para validar RPC (sem ficar em loop)
    await withTimeout(provider.getBlockNumber(), timeoutMs, "WEB3_RPC_TIMEOUT");

    clearRpcFail();
    return true;
  } catch (err) {
    markRpcFail(err);

    // limpa instâncias para tentar recriar depois (quando o RPC voltar)
    _provider = null;
    _operator = null;
    _subscription = null;

    const e = new Error("WEB3_UNAVAILABLE");
    e.code = "WEB3_UNAVAILABLE";
    e.details = String(err?.message || err);
    throw e;
  }
}

export function getOperatorWalletLazy() {
  if (!env.OPERATOR_PRIVATE_KEY) throw new Error("ENV_OPERATOR_PRIVATE_KEY_MISSING");
  if (_operator) return _operator;

  const provider = getProviderLazy();
  _operator = new ethers.Wallet(env.OPERATOR_PRIVATE_KEY, provider);
  return _operator;
}

/**
 * Retorna contrato PRONTO, mas só depois de validar RPC (com timeout).
 */
export async function getSubscriptionContract() {
  if (!env.SUBSCRIPTION_CONTRACT) throw new Error("ENV_SUBSCRIPTION_CONTRACT_MISSING");

  await assertRpcReady();

  if (_subscription) return _subscription;

  const signer = getOperatorWalletLazy();
  _subscription = new ethers.Contract(env.SUBSCRIPTION_CONTRACT, SUBSCRIPTION_ABI, signer);
  return _subscription;
}

/**
 * ERC20 pode ser com provider (read-only) ou signer.
 * Aqui mantemos lazy também. (sem cache de tokens por enquanto, mas dá pra adicionar depois)
 */
export async function getErc20(tokenAddress, signerOrProvider = null) {
  await assertRpcReady();
  const p = signerOrProvider || getProviderLazy();
  return new ethers.Contract(tokenAddress, ERC20_ABI, p);
}
