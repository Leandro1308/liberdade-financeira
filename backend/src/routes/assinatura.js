// backend/src/routes/assinatura.js (ESM)
import { Router } from "express";
import { z } from "zod";
import { ethers } from "ethers";

import { requireAuth } from "../middleware/auth.js";
import { User } from "../models/User.js";
import { getSubscriptionContract, getErc20, getWeb3State, getProvider } from "../services/web3.js";

const router = Router();

const SubscribeSchema = z.object({
  walletAddress: z.string().min(10).optional().nullable(),
  referrerCode: z.string().min(3).max(40).optional().nullable(),
});

const ValidateTxSchema = z.object({
  txHash: z.string().min(10),
  walletAddress: z.string().min(10).optional().nullable(),
});

// helper: resposta padronizada quando Web3/RPC estiver fora
async function web3Unavailable(res, extra = null) {
  let state = null;
  try {
    state = await getWeb3State();
  } catch {
    state = null;
  }

  return res.status(503).json({
    ok: false,
    error: "WEB3_UNAVAILABLE",
    message: "Rede blockchain indisponível no momento. Tente novamente em instantes.",
    details: extra || state?.error || null,
  });
}

/**
 * ---------------------------------------------------------
 * ✅ 1) PARAMS PÚBLICOS (mantém compatibilidade)
 * ---------------------------------------------------------
 */
router.get("/params", async (req, res) => {
  try {
    const c = getSubscriptionContract();

    const [price, txFeeBps, cycleSeconds, token, treasury, gasVault] = await Promise.all([
      c.price(),
      c.txFeeBps(),
      c.cycleSeconds(),
      c.token(),
      c.treasury(),
      c.gasVault(),
    ]);

    return res.json({
      ok: true,
      contractAddress: c.target, // ethers v6
      token,
      treasury,
      gasVault,
      price: price.toString(),
      txFeeBps: Number(txFeeBps),
      cycleSeconds: cycleSeconds.toString(),
    });
  } catch (e) {
    const code = e?.code || e?.message;
    if (code === "WEB3_UNAVAILABLE" || code === "WEB3_RPC_COOLDOWN" || code === "WEB3_RPC_TIMEOUT") {
      return web3Unavailable(res, e?.details || e?.message);
    }
    console.error("assinatura/params error:", e?.message || e);
    return res.status(500).json({ ok: false, error: "PARAMS_UNAVAILABLE" });
  }
});

/**
 * ---------------------------------------------------------
 * ✅ 2) NOVO: /api/contract/info (alias “profissional”)
 * ---------------------------------------------------------
 */
router.get("/contract/info", async (req, res) => {
  try {
    const state = await getWeb3State();
    if (!state?.ok) {
      return res.status(503).json({
        ok: false,
        error: "WEB3_UNAVAILABLE",
        details: state?.error || null,
      });
    }
    return res.json(state);
  } catch (e) {
    return web3Unavailable(res, e?.message);
  }
});

/**
 * ---------------------------------------------------------
 * ✅ 3) STATUS (compatibilidade): baseado no Mongo (não remove)
 * ---------------------------------------------------------
 */
router.get("/status", requireAuth, async (req, res) => {
  return res.json({
    ok: true,
    subscription: req.user.subscription,
    walletAddress: req.user.walletAddress || null,
  });
});

/**
 * ---------------------------------------------------------
 * ✅ 4) NOVO: STATUS ON-CHAIN (ativo/due/nextDueAt)
 * GET /api/subscription/status  (e também /api/assinatura/subscription/status)
 * ---------------------------------------------------------
 *
 * ⚠️ Importante: como não temos certeza 100% do nome exato dos métodos
 * no SubscriptionSplitV3, esta rota é “tolerante”:
 * - tenta isActive(address)
 * - tenta isDue(address)
 * - tenta nextDueAt(address)
 * - se algum não existir/reverter, devolve null no campo, sem quebrar.
 */
router.get("/subscription/status", requireAuth, async (req, res) => {
  try {
    const userId = req.user._id.toString();

    // resolve wallet (Mongo é a fonte)
    let userWalletRaw = (req.user.walletAddress || "").trim();

    // se não tiver salva, não dá pra ler on-chain
    if (!userWalletRaw) {
      return res.json({
        ok: true,
        walletAddress: null,
        onchain: {
          active: false,
          due: null,
          nextDueAt: null,
        },
      });
    }

    let userWallet;
    try {
      userWallet = ethers.getAddress(userWalletRaw);
    } catch {
      return res.status(400).json({ ok: false, error: "WALLET_INVALID" });
    }

    // (Opcional) normaliza e salva checksum
    await User.updateOne({ _id: userId }, { $set: { walletAddress: userWallet } });

    const provider = getProvider();
    const base = getSubscriptionContract(); // mantém target/address certo
    const contractAddress = base.target;

    // ABI “tolerante” só para leitura do status
    const STATUS_ABI = [
      "function isActive(address user) view returns (bool)",
      "function isDue(address user) view returns (bool)",
      "function nextDueAt(address user) view returns (uint256)",
    ];

    const c = new ethers.Contract(contractAddress, STATUS_ABI, provider);

    // chama de forma tolerante: se não existir, retorna null
    const safeCall = async (fn, fallback = null) => {
      try {
        const v = await c[fn](userWallet);
        return v;
      } catch {
        return fallback;
      }
    };

    const [activeRaw, dueRaw, nextDueAtRaw] = await Promise.all([
      safeCall("isActive", null),
      safeCall("isDue", null),
      safeCall("nextDueAt", null),
    ]);

    const active = activeRaw === null ? null : Boolean(activeRaw);
    const due = dueRaw === null ? null : Boolean(dueRaw);

    // nextDueAt: seconds -> ISO
    let nextDueAt = null;
    let nextDueAtISO = null;
    if (nextDueAtRaw !== null && nextDueAtRaw !== undefined) {
      try {
        const sec = Number(nextDueAtRaw.toString());
        if (Number.isFinite(sec) && sec > 0) {
          nextDueAt = sec;
          nextDueAtISO = new Date(sec * 1000).toISOString();
        }
      } catch {
        nextDueAt = null;
        nextDueAtISO = null;
      }
    }

    return res.json({
      ok: true,
      walletAddress: userWallet,
      contractAddress,
      onchain: {
        active,
        due,
        nextDueAt,
        nextDueAtISO,
      },
    });
  } catch (e) {
    const code = e?.code || e?.message;
    if (code === "WEB3_UNAVAILABLE" || code === "WEB3_RPC_COOLDOWN" || code === "WEB3_RPC_TIMEOUT") {
      return web3Unavailable(res, e?.details || e?.message);
    }
    console.error("assinatura/subscription/status error:", e?.message || e);
    return res.status(500).json({ ok: false, error: "STATUS_UNAVAILABLE" });
  }
});

/**
 * Alias extra (caso você queira separar /api/subscription/... fora de /assinatura)
 * -> sem quebrar nada, apenas reaproveita o mesmo handler.
 */
router.get("/subscription/status", requireAuth, router.stack.find(r => r.route?.path === "/subscription/status")?.route?.stack?.[0]?.handle);

/**
 * ---------------------------------------------------------
 * ✅ 5) COMPAT: POST /subscribe (agora: preparar dados p/ MetaMask)
 * ---------------------------------------------------------
 *
 * Antes: o backend assinava uma tx gasless (operador).
 * Agora (Opção A): o backend só:
 * - valida/salva a wallet
 * - resolve o referrer on-chain (wallet do afiliado)
 * - devolve o “plano de ação” pro frontend executar:
 *   1) approve(exato)
 *   2) subscribe(referrer)
 *
 * Isso mantém o endpoint vivo e evita quebrar o fluxo atual do frontend.
 */
router.post("/subscribe", requireAuth, async (req, res) => {
  const parsed = SubscribeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ ok: false, error: "INVALID_DATA" });

  const userId = req.user._id.toString();

  // resolve wallet (body -> ou já salva)
  let userWalletRaw = (parsed.data.walletAddress || "").trim();
  if (!userWalletRaw) userWalletRaw = (req.user.walletAddress || "").trim();

  if (!userWalletRaw) {
    return res.status(400).json({ ok: false, error: "SALVE_SUA_CARTEIRA" });
  }

  let userWallet;
  try {
    userWallet = ethers.getAddress(userWalletRaw);
  } catch {
    return res.status(400).json({ ok: false, error: "WALLET_INVALID" });
  }

  // garante wallet salva
  await User.updateOne({ _id: userId }, { $set: { walletAddress: userWallet } });

  // resolve referrer wallet (se existir no sistema e tiver wallet)
  let directReferrerWallet = ethers.ZeroAddress;
  const refCode = parsed.data.referrerCode || req.user.referrerCode || null;
  if (refCode) {
    const refUser = await User.findOne({ affiliateCode: refCode }).lean();
    if (refUser?.walletAddress) {
      try {
        directReferrerWallet = ethers.getAddress(refUser.walletAddress);
      } catch {
        directReferrerWallet = ethers.ZeroAddress;
      }
    }
  }

  try {
    const c = getSubscriptionContract();

    const [tokenAddress, priceRaw, txFeeBpsRaw] = await Promise.all([
      c.token(),
      c.price(),
      c.txFeeBps(),
    ]);

    const erc20 = getErc20(tokenAddress);

    const price = BigInt(priceRaw.toString());
    const txFeeBps = BigInt(txFeeBpsRaw.toString());

    // total = price * (1 + fee)
    const total = (price * (BigInt(10000) + txFeeBps)) / BigInt(10000);

    // allowance (para UX: dizer se vai precisar approve)
    let allowance = 0n;
    try {
      const allowanceRaw = await erc20.allowance(userWallet, c.target);
      allowance = BigInt(allowanceRaw.toString());
    } catch {
      allowance = 0n;
    }

    return res.json({
      ok: true,
      mode: "optionA_user_signed",
      message:
        "Pronto para ativar assinatura. No frontend, execute approve (se necessário) e depois subscribe(referrer) via MetaMask.",
      walletAddress: userWallet,
      contractAddress: c.target,
      tokenAddress,
      referrerAddress: directReferrerWallet,
      price: price.toString(),
      txFeeBps: Number(txFeeBps),
      total: total.toString(),
      needsApprove: allowance < total,
      // ajuda o frontend a mostrar texto e chamar o método certo
      calls: {
        approve: {
          to: tokenAddress,
          spender: c.target,
          amount: total.toString(),
        },
        subscribe: {
          to: c.target,
          // assinatura típica: subscribe(address referrer)
          // (se o contrato tiver outra assinatura, a UI ajusta, mas este é o padrão que você vinha usando)
          method: "subscribe",
          args: [directReferrerWallet],
        },
      },
    });
  } catch (e) {
    const code = e?.code || e?.message;
    if (code === "WEB3_UNAVAILABLE" || code === "WEB3_RPC_COOLDOWN" || code === "WEB3_RPC_TIMEOUT") {
      return web3Unavailable(res, e?.details || e?.message);
    }
    console.error("assinatura/subscribe (prepare) error:", e?.message || e);
    return res.status(500).json({ ok: false, error: "SUBSCRIBE_PREPARE_FAILED" });
  }
});

/**
 * ---------------------------------------------------------
 * ✅ 6) NOVO (opcional): validar tx hash (subscribe/renew)
 * ---------------------------------------------------------
 *
 * Nesta fase (sem indexer), é uma validação básica:
 * - receipt existe e status=1
 * - tx.to == contrato
 * - (opcional) tx.from == wallet salva (se existir)
 */
router.post("/subscription/validateTx", requireAuth, async (req, res) => {
  const parsed = ValidateTxSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ ok: false, error: "INVALID_DATA" });

  const txHash = parsed.data.txHash.trim();
  const provider = getProvider();
  const c = getSubscriptionContract();
  const contractAddress = c.target;

  // wallet esperada (preferência: Mongo)
  let expectedWallet = (req.user.walletAddress || "").trim();
  if (!expectedWallet) expectedWallet = (parsed.data.walletAddress || "").trim();

  let expected = null;
  if (expectedWallet) {
    try {
      expected = ethers.getAddress(expectedWallet);
    } catch {
      expected = null;
    }
  }

  try {
    const [tx, receipt] = await Promise.all([
      provider.getTransaction(txHash),
      provider.getTransactionReceipt(txHash),
    ]);

    if (!tx || !receipt) {
      return res.json({
        ok: true,
        valid: false,
        reason: "TX_NOT_FOUND_OR_PENDING",
      });
    }

    const toOk = (tx.to || "").toLowerCase() === contractAddress.toLowerCase();
    const statusOk = receipt.status === 1;

    let fromOk = null;
    if (expected) {
      fromOk = (tx.from || "").toLowerCase() === expected.toLowerCase();
    }

    const valid = Boolean(toOk && statusOk && (fromOk === null ? true : fromOk));

    return res.json({
      ok: true,
      valid,
      checks: {
        toOk,
        statusOk,
        fromOk, // null quando não tinha wallet pra comparar
      },
      contractAddress,
      tx: {
        hash: tx.hash,
        from: tx.from,
        to: tx.to,
        blockNumber: receipt.blockNumber,
        status: receipt.status,
      },
    });
  } catch (e) {
    return web3Unavailable(res, e?.message);
  }
});

export default router;
