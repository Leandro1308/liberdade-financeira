// backend/src/services/subscriptionOnchain.js (ESM)
import { ethers } from "ethers";
import { env } from "../config/env.js";
import { getProvider } from "./web3.js";

/**
 * Fonte da verdade: contrato on-chain (BNB Chain)
 * - Não depende do MongoDB para decidir acesso
 * - Cache curto em memória (30–60s) só para performance
 */

// ABI mínima para status de assinatura (leitura)
const SUBSCRIPTION_STATUS_ABI = [
  "function isActive(address user) view returns (bool)",
  "function nextDueAt(address user) view returns (uint256)",
  "function isDue(address user) view returns (bool)",
];

// cache em memória: wallet -> { expiresAt, data }
const memCache = new Map();

function ttlMs() {
  const raw = process.env.SUBSCRIPTION_ONCHAIN_CACHE_MS || process.env.ONCHAIN_CACHE_MS;
  const n = Number(raw);
  // default 45s (entre 30–60s como combinado)
  return Number.isFinite(n) && n > 0 ? n : 45_000;
}

function now() {
  return Date.now();
}

function normalizeWallet(addr) {
  try {
    return ethers.getAddress(addr);
  } catch {
    return null;
  }
}

function getContractAddress() {
  // usa o que você já usa no web3.js
  if (!env.SUBSCRIPTION_CONTRACT) throw new Error("ENV_SUBSCRIPTION_CONTRACT_MISSING");
  return env.SUBSCRIPTION_CONTRACT;
}

function getChainId() {
  return Number(env.BSC_CHAIN_ID || 56);
}

// contrato read-only (provider)
let _statusContract = null;
function getStatusContract() {
  if (_statusContract) return _statusContract;

  const provider = getProvider(); // reaproveita seu provider
  const address = getContractAddress();

  _statusContract = new ethers.Contract(address, SUBSCRIPTION_STATUS_ABI, provider);
  return _statusContract;
}

/**
 * Consulta on-chain com cache curto.
 * Retorna objeto padronizado:
 * { ok, active, nextDueAt, isDue, chainId, contract, checkedAt, cacheTtlMs }
 */
export async function getOnchainSubscriptionStatus(walletAddress, { bypassCache = false } = {}) {
  const wallet = normalizeWallet(walletAddress);

  const chainId = getChainId();
  const contract = getContractAddress();
  const checkedAt = new Date().toISOString();

  if (!wallet) {
    return {
      ok: false,
      active: false,
      walletAddress: walletAddress || null,
      chainId,
      contract,
      checkedAt,
      error: "WALLET_INVALID",
    };
  }

  const key = wallet.toLowerCase();
  const ttl = ttlMs();

  if (!bypassCache) {
    const hit = memCache.get(key);
    if (hit && hit.expiresAt > now()) return hit.data;
  }

  const c = getStatusContract();

  // isActive é obrigatório (fonte da verdade)
  let active = false;
  try {
    active = await c.isActive(wallet);
  } catch (e) {
    const data = {
      ok: false,
      active: false,
      walletAddress: wallet,
      chainId,
      contract,
      checkedAt,
      error: "ONCHAIN_CALL_FAILED",
      details: String(e?.message || e),
      cacheTtlMs: ttl,
      source: "rpc",
    };
    memCache.set(key, { expiresAt: now() + ttl, data });
    return data;
  }

  // opcionais (se o contrato não tiver, fica null)
  let nextDueAt = null;
  let isDue = null;

  try {
    const v = await c.nextDueAt(wallet);
    const asBig = typeof v === "bigint" ? v : BigInt(String(v));
    nextDueAt = Number(asBig);
  } catch {
    nextDueAt = null;
  }

  try {
    isDue = await c.isDue(wallet);
  } catch {
    isDue = null;
  }

  const data = {
    ok: true,
    active: Boolean(active),
    walletAddress: wallet,
    chainId,
    contract,
    checkedAt,
    nextDueAt, // unix seconds ou null
    isDue,     // boolean ou null
    cacheTtlMs: ttl,
    source: "rpc",
  };

  memCache.set(key, { expiresAt: now() + ttl, data });
  return data;
}

export function _dangerous_clearOnchainCache() {
  memCache.clear();
}
