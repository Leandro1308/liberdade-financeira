export const API_BASE = `${location.origin}`;

const TOKEN_KEY = "lf_token";

// Pega token da URL (?t=...) se existir
function getTokenFromUrl() {
  try {
    const u = new URL(location.href);
    const t = u.searchParams.get("t");
    return t && String(t).trim() ? String(t).trim() : null;
  } catch {
    return null;
  }
}

// Salva token e remove da URL (pra não ficar exposto)
function captureTokenOnce() {
  const t = getTokenFromUrl();
  if (!t) return;

  try {
    localStorage.setItem(TOKEN_KEY, t);
  } catch {}

  try {
    const u = new URL(location.href);
    u.searchParams.delete("t");
    history.replaceState({}, "", u.toString());
  } catch {}
}

function getStoredToken() {
  try {
    const t = localStorage.getItem(TOKEN_KEY);
    return t && String(t).trim() ? String(t).trim() : null;
  } catch {
    return null;
  }
}

export function setToken(token) {
  try {
    if (!token) localStorage.removeItem(TOKEN_KEY);
    else localStorage.setItem(TOKEN_KEY, String(token).trim());
  } catch {}
}

export function getToken() {
  return getStoredToken();
}

captureTokenOnce();

/**
 * API base (compatível com o que já existe)
 * - mantém Authorization Bearer
 * - anti-cache em GET
 * - não quebra nada do login atual
 */
export async function api(path, { method = "GET", token = null, body = null } = {}) {
  const headers = { "Content-Type": "application/json" };

  const autoToken = token || getStoredToken();
  if (autoToken) headers.Authorization = `Bearer ${autoToken}`;

  // anti-cache em GET
  const url = new URL(`${API_BASE}${path}`);
  if (method === "GET") url.searchParams.set("_t", Date.now().toString());

  const res = await fetch(url.toString(), {
    method,
    headers,
    credentials: "include",
    body: body ? JSON.stringify(body) : null,
  });

  const contentType = res.headers.get("content-type") || "";
  const data = contentType.includes("application/json")
    ? await res.json().catch(() => ({}))
    : await res.text().catch(() => "");

  if (!res.ok) {
    // prioriza mensagem do backend (se vier)
    const msg =
      (data && typeof data === "object" && (data.message || data.error)) ||
      (typeof data === "string" && data) ||
      "Erro na requisição";
    throw new Error(String(msg));
  }

  return data;
}

/* =========================================================
   ✅ Helpers (opcionais) para assinatura on-chain (Opção A)
   - Não interferem no restante do site
   ========================================================= */

export const assinaturaApi = {
  // Mantém compatibilidade com o endpoint antigo
  getParams() {
    return api("/api/assinatura/params");
  },

  // Novo (alias “profissional”)
  getContractInfo() {
    return api("/api/assinatura/contract/info");
  },

  // Status “interno” (Mongo) — mantém seu fluxo atual
  getMongoStatus() {
    return api("/api/assinatura/status");
  },

  // Status on-chain (active/due/nextDueAt)
  getOnchainStatus() {
    return api("/api/assinatura/subscription/status");
  },

  // ✅ NOVO: SYNC on-chain -> Mongo
  // IMPORTANTE: usa Bearer token automaticamente via api()
  syncSubscription() {
    return api("/api/assinatura/subscription/sync", { method: "POST" });
  },

  // Prepara dados para o frontend executar approve + subscribe(referrer)
  prepareSubscribe({ walletAddress = null, referrerCode = null } = {}) {
    return api("/api/assinatura/subscribe", {
      method: "POST",
      body: { walletAddress, referrerCode },
    });
  },

  // (Opcional) valida tx hash no backend
  validateTx({ txHash, walletAddress = null } = {}) {
    return api("/api/assinatura/subscription/validateTx", {
      method: "POST",
      body: { txHash, walletAddress },
    });
  },
};
