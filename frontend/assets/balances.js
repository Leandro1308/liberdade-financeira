// frontend/assets/balances.js
import { toast } from "/assets/ui.js";

// USDT (BEP20) na BNB Chain (mainnet)
const USDT_BSC = "0x55d398326f99059fF775485246999027B3197955";
const CHAIN_ID_BSC = "0x38"; // 56

function short(addr) {
  if (!addr || addr.length < 10) return addr || "";
  return addr.slice(0, 6) + "..." + addr.slice(-4);
}

function hexToBigInt(hex) {
  if (!hex) return 0n;
  return BigInt(hex);
}

function formatUnits(value, decimals) {
  const v = BigInt(value);
  const d = BigInt(decimals);
  const base = 10n ** d;
  const intPart = v / base;
  const fracPart = v % base;

  // 4 casas por padrão
  const fracStr = fracPart.toString().padStart(Number(decimals), "0").slice(0, 4);
  return `${intPart.toString()}.${fracStr}`;
}

function pad32(hexNo0x) {
  return hexNo0x.padStart(64, "0");
}

function encodeAddressAs32Bytes(addr) {
  const a = addr.toLowerCase().replace("0x", "");
  return pad32(a);
}

// ERC20 selectors
const SIG_BALANCE_OF = "0x70a08231"; // balanceOf(address)
const SIG_DECIMALS = "0x313ce567";   // decimals()

async function ethCall(to, data) {
  return await window.ethereum.request({
    method: "eth_call",
    params: [{ to, data }, "latest"],
  });
}

async function getDecimals(token) {
  const res = await ethCall(token, SIG_DECIMALS);
  // res é 32 bytes hex
  return Number(hexToBigInt(res));
}

async function getErc20Balance(token, owner) {
  const data = SIG_BALANCE_OF + encodeAddressAs32Bytes(owner);
  const res = await ethCall(token, data);
  return hexToBigInt(res);
}

async function getNativeBalance(owner) {
  const res = await window.ethereum.request({
    method: "eth_getBalance",
    params: [owner, "latest"],
  });
  return hexToBigInt(res);
}

async function ensureBscChain() {
  const chainId = await window.ethereum.request({ method: "eth_chainId" });
  if (chainId !== CHAIN_ID_BSC) {
    throw new Error("Conecte na rede BNB Chain (BSC) para verificar saldos.");
  }
}

export async function attachBalanceButtons({
  inputSelector = "#wallet",
  btnCheckSelector = "#btnCheckBalances",
  btnConnectSelector = "#btnConnectMetamask",
  outBnbSelector = "#outBnb",
  outUsdtSelector = "#outUsdt",
  outWalletSelector = "#outWalletSaved",
} = {}) {
  const input = document.querySelector(inputSelector);
  const btnCheck = document.querySelector(btnCheckSelector);
  const btnConnect = document.querySelector(btnConnectSelector);

  const outBnb = document.querySelector(outBnbSelector);
  const outUsdt = document.querySelector(outUsdtSelector);
  const outWalletSaved = document.querySelector(outWalletSelector);

  // Se a sua página tiver IDs diferentes, me diga quais são que eu ajusto.
  if (!input || !btnCheck) {
    console.warn("balances.js: Não achei input/botão. Verifique os IDs.", {
      inputSelector,
      btnCheckSelector,
    });
    return;
  }

  if (!window.ethereum) {
    btnCheck.addEventListener("click", () => {
      toast("MetaMask não encontrado. Abra no navegador do MetaMask ou instale a extensão.", "error");
    });
    return;
  }

  // Conectar MetaMask (opcional)
  if (btnConnect) {
    btnConnect.addEventListener("click", async () => {
      try {
        const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
        const addr = accounts?.[0];
        if (!addr) throw new Error("Nenhuma conta selecionada no MetaMask.");
        input.value = addr;
        if (outWalletSaved) outWalletSaved.textContent = `Carteira: ${short(addr)}`;
        toast("Carteira preenchida pelo MetaMask.");
      } catch (e) {
        toast(e?.message || "Falha ao conectar MetaMask", "error");
      }
    });
  }

  // Verificar saldos
  btnCheck.addEventListener("click", async () => {
    try {
      const addr = input.value.trim();
      if (!addr || !addr.startsWith("0x") || addr.length !== 42) {
        throw new Error("Cole um endereço válido (0x...).");
      }

      await ensureBscChain();

      // BNB (18 dec)
      const bnbWei = await getNativeBalance(addr);
      const bnb = formatUnits(bnbWei, 18);

      // USDT
      const usdtDecimals = await getDecimals(USDT_BSC); // normalmente 18 na BSC
      const usdtBal = await getErc20Balance(USDT_BSC, addr);
      const usdt = formatUnits(usdtBal, usdtDecimals);

      if (outBnb) outBnb.textContent = `BNB: ${bnb}`;
      if (outUsdt) outUsdt.textContent = `USDT: ${usdt}`;

      toast(`Saldos atualizados (${short(addr)}).`);
    } catch (e) {
      toast(e?.message || "Falha ao verificar saldos", "error");
    }
  });
}
