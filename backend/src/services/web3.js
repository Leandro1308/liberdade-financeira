// backend/src/services/web3.js (ESM)
import { ethers } from "ethers";
import { env } from "../config/env.js";

// ABI mínimo (só o que precisamos aqui)
const SUBSCRIPTION_ABI = [
  "function price() view returns (uint256)",
  "function txFeeBps() view returns (uint16)",
  "function cycleSeconds() view returns (uint256)",
  "function token() view returns (address)",
  "function treasury() view returns (address)",
  "function gasVault() view returns (address)"
];

const ERC20_ABI = [
  "function allowance(address owner, address spender) view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
  "function approve(address spender, uint256 value) returns (bool)",
  "function decimals() view returns (uint8)"
];

// ✅ cache (não muda o comportamento externo; só evita recriar)
let _provider = null;
let _operatorWallet = null;
let _subscriptionContract = null;

// ✅ BNB Smart Chain Mainnet (fixa a rede para evitar "failed to detect network")
const BSC_NETWORK = { chainId: 56, name: "bsc" };

function assertEnv() {
  if (!env.BSC_RPC_URL) throw new Error("ENV_BSC_RPC_URL_MISSING");
  if (!env.SUBSCRIPTION_CONTRACT) throw new Error("ENV_SUBSCRIPTION_CONTRACT_MISSING");
  if (!env.OPERATOR_PRIVATE_KEY) throw new Error("ENV_OPERATOR_PRIVATE_KEY_MISSING");
}

export function getProvider() {
  if (_provider) return _provider;
  assertEnv();

  // ✅ rede fixa => reduz erros de detecção no provider
  _provider = new ethers.JsonRpcProvider(env.BSC_RPC_URL, BSC_NETWORK);
  return _provider;
}

export function getOperatorWallet() {
  if (_operatorWallet) return _operatorWallet;
  assertEnv();

  const provider = getProvider();
  _operatorWallet = new ethers.Wallet(env.OPERATOR_PRIVATE_KEY, provider);
  return _operatorWallet;
}

// ✅ ESTE EXPORT JÁ ERA USADO PELO SEU CÓDIGO
export function getSubscriptionContract() {
  if (_subscriptionContract) return _subscriptionContract;
  assertEnv();

  const signer = getOperatorWallet();
  _subscriptionContract = new ethers.Contract(env.SUBSCRIPTION_CONTRACT, SUBSCRIPTION_ABI, signer);
  return _subscriptionContract;
}

// ✅ ESTE EXPORT JÁ ERA USADO PELO SEU CÓDIGO
export function getErc20(tokenAddress, signerOrProvider) {
  const p = signerOrProvider || getProvider();
  return new ethers.Contract(tokenAddress, ERC20_ABI, p);
}

/**
 * ✅ ESTE EXPORT ERA O QUE ESTAVA FALTANDO (E QUEBROU O DEPLOY)
 * Mantém compatibilidade com o route: assinatura.js importa getWeb3State.
 *
 * Retorna parâmetros do contrato para usar em /api/assinatura/params
 * sem depender do frontend hardcode.
 */
export async function getWeb3State() {
  assertEnv();

  const contract = getSubscriptionContract();

  // Busca dados on-chain (se algo falhar, devolve o mínimo seguro)
  try {
    const [price, txFeeBps, cycleSeconds, token, treasury, gasVault] = await Promise.all([
      contract.price(),
      contract.txFeeBps(),
      contract.cycleSeconds(),
      contract.token(),
      contract.treasury(),
      contract.gasVault()
    ]);

    return {
      ok: true,
      chainId: 56,
      rpcUrl: env.BSC_RPC_URL,
      contractAddress: env.SUBSCRIPTION_CONTRACT,
      price: String(price),
      txFeeBps: Number(txFeeBps),
      cycleSeconds: Number(cycleSeconds),
      token,
      treasury,
      gasVault
    };
  } catch (err) {
    return {
      ok: false,
      chainId: 56,
      rpcUrl: env.BSC_RPC_URL,
      contractAddress: env.SUBSCRIPTION_CONTRACT,
      error: err?.message || "FAILED_TO_LOAD_WEB3_STATE"
    };
  }
}
