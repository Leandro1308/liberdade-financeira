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
  "function gasVault() view returns (address)"
];

const ERC20_ABI = [
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 value) returns (bool)",
  "function decimals() view returns (uint8)"
];

// ✅ cache para não recriar provider/signer toda hora
let _provider = null;
let _operatorWallet = null;
let _subscriptionContract = null;

// ✅ BNB Smart Chain Mainnet
const BSC_NETWORK = { chainId: 56, name: "bsc" };

export function getProvider() {
  if (_provider) return _provider;
  if (!env.BSC_RPC_URL) throw new Error("ENV_BSC_RPC_URL_MISSING");

  // ✅ Passando a rede fixa evita "failed to detect network" + retry infinito
  _provider = new ethers.JsonRpcProvider(env.BSC_RPC_URL, BSC_NETWORK);

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
  _subscriptionContract = new ethers.Contract(env.SUBSCRIPTION_CONTRACT, SUBSCRIPTION_ABI, signer);

  return _subscriptionContract;
}

export function getErc20(tokenAddress, signerOrProvider) {
  const p = signerOrProvider || getProvider();
  return new ethers.Contract(tokenAddress, ERC20_ABI, p);
}
