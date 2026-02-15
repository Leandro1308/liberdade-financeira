// backend/src/services/web3.js (ESM)
import { ethers } from "ethers";
import { env } from "../config/env.js";

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
];

// =========================
// Lazy singletons (NUNCA no topo com chamadas RPC)
// =========================
let _provider = null;
let _operatorWallet = null;
let _subscriptionContract = null;

// Timeout helper (não depende do ethers)
function withTimeout(promise, ms, label = "timeout") {
  let t;
  const timeout = new Promise((_, reject) => {
    t = setTimeout(() => reject(new Error(label)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(t));
}

/**
 * ✅ Provider lazy + rede fixa (BSC mainnet)
 * staticNetwork evita "detect network" em loop.
 * NÃO faz chamadas RPC aqui (não trava boot).
 */
export function getProvider() {
  if (_provider) return _provider;

  if (!env.BSC_RPC_URL) throw new Error("ENV_BSC_RPC_URL_MISSING");

  const network = { chainId: 56, name: "bsc" };

  // Ethers v6
  _provider = new ethers.JsonRpcProvider(env.BSC_RPC_URL, network, {
    staticNetwork: true,
  });

  return _provider;
}

export function getOperatorWallet() {
  if (_operatorWallet) return _operatorWallet;

  if (!env.OPERATOR_PRIVATE_KEY) throw new Error("ENV_OPERATOR_PRIVATE_KEY_MISSING");

  const provider = getProvider();
  _operatorWallet = new ethers.Wallet(env.OPERATOR_PRIVATE_KEY, provider);
  return _operatorWallet;
}

export function getSubscriptionContract() {
  if (_subscriptionContract) return _subscriptionContract;

  if (!env.SUBSCRIPTION_CONTRACT) throw new Error("ENV_SUBSCRIPTION_CONTRACT_MISSING");

  const signer = getOperatorWallet();
  _subscriptionContract = new ethers.Contract(
    env.SUBSCRIPTION_CONTRACT,
    SUBSCRIPTION_ABI,
    signer
  );

  return _subscriptionContract;
}

export function getErc20(tokenAddress, signerOrProvider) {
  const p = signerOrProvider || getProvider();
  return new ethers.Contract(tokenAddress, ERC20_ABI, p);
}

/**
 * ✅ Checa se o RPC está saudável com timeout.
 * Isso é chamado SOMENTE sob demanda (rotas/worker).
 * Se cair, retorna ok:false e a aplicação continua viva.
 */
export async function checkRpcHealthy({ timeoutMs } = {}) {
  const ms =
    typeof timeoutMs === "number" && Number.isFinite(timeoutMs)
      ? timeoutMs
      : env.BSC_RPC_TIMEOUT_MS || 3500;

  try {
    const provider = getProvider();
    const bn = await withTimeout(provider.getBlockNumber(), ms, "rpc_timeout");
    return { ok: true, blockNumber: bn };
  } catch (e) {
    return { ok: false, error: e?.message || String(e) };
  }
}

/**
 * Opcional para debug (não usado pelo app)
 */
export function resetWeb3() {
  _provider = null;
  _operatorWallet = null;
  _subscriptionContract = null;
}
