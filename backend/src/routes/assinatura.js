// backend/src/routes/assinatura.js (ESM)
import { Router } from "express";
import { z } from "zod";
import { ethers } from "ethers";

import { requireAuth } from "../middleware/auth.js";
import { User } from "../models/User.js";
import {
  getSubscriptionContract,
  getErc20,
  getWeb3State,
  getProvider,
} from "../services/web3.js";

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
    message:
      "Rede blockchain indisponível no momento. Tente novamente em instantes.",
    details: extra || state?.error || null,
  });
}

/**
 * ---------------------------------------------------------
 * ✅ 1) PARAMS PÚBLICOS
 * ---------------------------------------------------------
 */
router.get("/params", async (req, res) => {
  try {
    const c = getSubscriptionContract();

    const [price, txFeeBps, cycleSeconds, token, treasury, gasVault] =
      await Promise.all([
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
    if (
      code === "WEB3_UNAVAILABLE" ||
      code === "WEB3_RPC_COOLDOWN" ||
      code === "WEB3_RPC_TIMEOUT"
    ) {
      return web3Unavailable(res, e?.details || e?.message);
    }
    console.error("assinatura/params error:", e?.message || e);
    return res.status(500).json({ ok: false, error: "PARAMS_UNAVAILABLE" });
  }
});

/**
 * ---------------------------------------------------------
 * ✅ 2) /api/assinatura/contract/info
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
 * ✅ 3) STATUS (Mongo) - compatibilidade
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
 * ✅ 4) STATUS ON-CHAIN (tolerante)
 * GET /api/assinatura/subscription/status
 * ---------------------------------------------------------
 */
router.get("/subscription/status", requireAuth, async (req, res) => {
  try {
    const userId = req.user._id.toString();

    let userWalletRaw = (req.user.walletAddress || "").trim();

    if (!userWalletRaw) {
      return res.json({
        ok: true,
        walletAddress: null,
        onchain: {
          active: false,
          due: null,
          nextDueAt: null,
          nextDueAtISO: null,
        },
      });
    }

    let userWallet;
    try {
      userWallet = ethers.getAddress(userWalletRaw);
    } catch {
      return res.status(400).json({ ok: false, error: "WALLET_INVALID" });
    }

    // normaliza checksum
    await User.updateOne({ _id: userId }, { $set: { walletAddress: userWallet } });

    const provider = getProvider();
    const base = getSubscriptionContract();
    const contractAddress = base.target;

    const STATUS_ABI = [
      "function isActive(address user) view returns (bool)",
      "function isDue(address user) view returns (bool)",
      "function nextDueAt(address user) view returns (uint256)",
    ];

    const c = new ethers.Contract(contractAddress, STATUS_ABI, provider);

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
      onchain: { active, due, nextDueAt, nextDueAtISO },
    });
  } catch (e) {
    const code = e?.code || e?.message;
    if (
      code === "WEB3_UNAVAILABLE" ||
      code === "WEB3_RPC_COOLDOWN" ||
      code === "WEB3_RPC_TIMEOUT"
    ) {
      return web3Unavailable(res, e?.details || e?.message);
    }
    console.error("assinatura/subscription/status error:", e?.message || e);
    return res.status(500).json({ ok: false, error: "STATUS_UNAVAILABLE" });
  }
});

/**
 * ---------------------------------------------------------
 * ✅ 4.1) SYNC ON-CHAIN -> Mongo
 * POST /api/assinatura/subscription/sync
 * ---------------------------------------------------------
 * Lê (isActive/nextDueAt) e atualiza req.user.subscription no Mongo,
 * para o /api/me refletir "active" imediatamente (sem worker).
 */
router.post("/subscription/sync", requireAuth, async (req, res) => {
  try {
    const userId = req.user._id.toString();

    let userWalletRaw = (req.user.walletAddress || "").trim();
    if (!userWalletRaw) {
      return res.status(400).json({ ok: false, error: "SALVE_SUA_CARTEIRA" });
    }

    let userWallet;
    try {
      userWallet = ethers.getAddress(userWalletRaw);
    } catch {
      return res.status(400).json({ ok: false, error: "WALLET_INVALID" });
    }

    const provider = getProvider();
    const base = getSubscriptionContract();
    const contractAddress = base.target;

    const STATUS_ABI = [
      "function isActive(address user) view returns (bool)",
      "function nextDueAt(address user) view returns (uint256)",
    ];

    const c = new ethers.Contract(contractAddress, STATUS_ABI, provider);

    // tolerante
    const safeCall = async (fn, fallback = null) => {
      try {
        const v = await c[fn](userWallet);
        return v;
      } catch {
        return fallback;
      }
    };

    const [activeRaw, nextDueAtRaw] = await Promise.all([
      safeCall("isActive", null),
      safeCall("nextDueAt", null),
    ]);

    const active = activeRaw === null ? null : Boolean(activeRaw);

    let nextDueAtISO = null;
    if (nextDueAtRaw !== null && nextDueAtRaw !== undefined) {
      try {
        const sec = Number(nextDueAtRaw.toString());
        if (Number.isFinite(sec) && sec > 0) {
          nextDueAtISO = new Date(sec * 1000).toISOString();
        }
      } catch {
        nextDueAtISO = null;
      }
    }

    // Se não conseguimos ler active, não alteramos nada (evita “desativar” por RPC falha)
    if (active === null) {
      return res.json({
        ok: true,
        synced: false,
        reason: "ONCHAIN_UNAVAILABLE",
        onchain: { active: null, nextDueAtISO },
      });
    }

    // Atualiza Mongo apenas com dados confiáveis
    const update = {
      walletAddress: userWallet, // mantém checksum
    };

    const sub = req.user.subscription || {};
    const newSub = {
      ...sub,
      status: active ? "active" : "inactive",
      renovacaoAutomatica:
        typeof sub.renovacaoAutomatica === "boolean" ? sub.renovacaoAutomatica : true,
    };

    // Se temos próxima data, colocamos em currentPeriodEnd
    if (nextDueAtISO) {
      newSub.currentPeriodEnd = nextDueAtISO;
    }

    update.subscription = newSub;

    await User.updateOne({ _id: userId }, { $set: update });

    return res.json({
      ok: true,
      synced: true,
      subscription: newSub,
      onchain: { active, nextDueAtISO },
    });
  } catch (e) {
    const code = e?.code || e?.message;
    if (
      code === "WEB3_UNAVAILABLE" ||
      code === "WEB3_RPC_COOLDOWN" ||
      code === "WEB3_RPC_TIMEOUT"
    ) {
      return web3Unavailable(res, e?.details || e?.message);
    }
    console.error("assinatura/subscription/sync error:", e?.message || e);
    return res.status(500).json({ ok: false, error: "SYNC_FAILED" });
  }
});

/**
 * ---------------------------------------------------------
 * ✅ 5) POST /subscribe (Opção A: preparar dados p/ MetaMask)
 * ---------------------------------------------------------
 */
router.post("/subscribe", requireAuth, async (req, res) => {
  const parsed = SubscribeSchema.safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ ok: false, error: "INVALID_DATA" });

  const userId = req.user._id.toString();

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

  await User.updateOne({ _id: userId }, { $set: { walletAddress: userWallet } });

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

    const total = (price * (BigInt(10000) + txFeeBps)) / BigInt(10000);

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
      calls: {
        approve: {
          to: tokenAddress,
          spender: c.target,
          amount: total.toString(),
        },
        subscribe: {
          to: c.target,
          method: "subscribe",
          args: [directReferrerWallet],
        },
      },
    });
  } catch (e) {
    const code = e?.code || e?.message;
    if (
      code === "WEB3_UNAVAILABLE" ||
      code === "WEB3_RPC_COOLDOWN" ||
      code === "WEB3_RPC_TIMEOUT"
    ) {
      return web3Unavailable(res, e?.details || e?.message);
    }
    console.error("assinatura/subscribe (prepare) error:", e?.message || e);
    return res.status(500).json({ ok: false, error: "SUBSCRIBE_PREPARE_FAILED" });
  }
});

/**
 * ---------------------------------------------------------
 * ✅ 6) validar tx hash (subscribe/renew)
 * ---------------------------------------------------------
 */
router.post("/subscription/validateTx", requireAuth, async (req, res) => {
  const parsed = ValidateTxSchema.safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ ok: false, error: "INVALID_DATA" });

  const txHash = parsed.data.txHash.trim();
  const provider = getProvider();
  const c = getSubscriptionContract();
  const contractAddress = c.target;

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
      checks: { toOk, statusOk, fromOk },
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
