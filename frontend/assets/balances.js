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

  // 4 casas
  const fracStr = fracPart
    .toString()
    .padStart(Number(decimals), "0")
    .slice(0, 4);

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
    throw new Error("Conecte na rede BNB Smart Chain (BSC) para verificar saldos.");
  }
}

function isAddress(addr) {
  return typeof addr === "string" && addr.startsWith("0x") && addr.length === 42;
}

async function getConnectedAddressNoPrompt() {
  const accounts = await window.ethereum.request({ method: "eth_accounts" });
  return accounts?.[0] || null;
}

async function connectAndGetAddress() {
  const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
  return accounts?.[0] || null;
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
    if (btnConnect) {
      btnConnect.addEventListener("click", () => {
        toast("MetaMask não encontrado. Abra no navegador do MetaMask ou instale a extensão.", "error");
      });
    }
    return;
  }

  const setWalletUI = (addr) => {
    if (addr && isAddress(addr)) {
      input.value = addr;
      if (outWalletSaved) outWalletSaved.textContent = `Carteira: ${short(addr)}`;
    }
  };

  const fetchAndRender = async (addr) => {
    if (!addr || !isAddress(addr)) throw new Error("Nenhuma carteira válida conectada.");
    await ensureBscChain();

    const [bnbWei, usdtDecimals, usdtBal] = await Promise.all([
      getNativeBalance(addr),
      getDecimals(USDT_BSC),
      getErc20Balance(USDT_BSC, addr),
    ]);

    const bnb = formatUnits(bnbWei, 18);
    const usdt = formatUnits(usdtBal, usdtDecimals);

    if (outBnb) outBnb.textContent = `BNB: ${bnb}`;
    if (outUsdt) outUsdt.textContent = `USDT: ${usdt}`;

    return { bnb, usdt };
  };

  // ✅ tenta puxar conta conectada sem popup (melhor UX)
  try {
    const connected = await getConnectedAddressNoPrompt();
    if (connected) {
      setWalletUI(connected);
      // atualiza saldo automaticamente
      try {
        await fetchAndRender(connected);
      } catch (e) {
        // se estiver na rede errada, só avisa (sem travar)
        toast(e?.message || "Falha ao verificar saldos.", "error");
      }
    }
  } catch (_) {}

  // Conectar MetaMask (botão)
  if (btnConnect) {
    btnConnect.addEventListener("click", async () => {
      try {
        const addr = await connectAndGetAddress();
        if (!addr) throw new Error("Nenhuma conta selecionada no MetaMask.");
        setWalletUI(addr);

        await fetchAndRender(addr);
        toast(`Carteira conectada e saldos atualizados (${short(addr)}).`);
      } catch (e) {
        toast(e?.message || "Falha ao conectar MetaMask", "error");
      }
    });
  }

  // Verificar saldos (botão)
  btnCheck.addEventListener("click", async () => {
    try {
      // ✅ prioridade: conta conectada
      const connected = await getConnectedAddressNoPrompt();

      // se não tiver conectada, tenta usar o input (mas avisa)
      const typed = input.value.trim();

      let addrToUse = connected || typed;

      if (!addrToUse || !isAddress(addrToUse)) {
        throw new Error("Conecte o MetaMask para ver o saldo real (ou cole um endereço válido).");
      }

      // Se a pessoa colou um endereço diferente do conectado, isso causa “saldo errado”
      if (connected && isAddress(typed) && typed.toLowerCase() !== connected.toLowerCase()) {
        toast(
          `Atenção: o endereço colado é diferente do MetaMask conectado. Vou usar o conectado (${short(connected)}).`,
          "error"
        );
        addrToUse = connected;
        setWalletUI(connected);
      } else if (connected) {
        setWalletUI(connected);
      }

      await fetchAndRender(addrToUse);
      toast(`Saldos atualizados (${short(addrToUse)}).`);
    } catch (e) {
      toast(e?.message || "Falha ao verificar saldos", "error");
    }
  });

  // ✅ atualiza automático quando troca de conta/rede
  window.ethereum.on?.("accountsChanged", async (accounts) => {
    const addr = accounts?.[0];
    if (!addr) return;
    setWalletUI(addr);
    try {
      await fetchAndRender(addr);
      toast(`Conta alterada: ${short(addr)}. Saldos atualizados.`);
    } catch (e) {
      toast(e?.message || "Falha ao atualizar saldos após trocar de conta.", "error");
    }
  });

  window.ethereum.on?.("chainChanged", async () => {
    const addr = await getConnectedAddressNoPrompt();
    if (!addr) return;
    setWalletUI(addr);
    try {
      await fetchAndRender(addr);
      toast("Rede alterada. Saldos atualizados.");
    } catch (e) {
      toast(e?.message || "Conecte na BNB Smart Chain (BSC).", "error");
    }
  });
}
