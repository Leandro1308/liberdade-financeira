import { api } from "./api.js";

const KEY = "LF_TOKEN";

export function getToken() {
  return localStorage.getItem(KEY);
}

export function setToken(token) {
  localStorage.setItem(KEY, token);
}

export function clearToken() {
  localStorage.removeItem(KEY);
}

export async function me() {
  const token = getToken();
  if (!token) return null;
  return api("/api/me", { token });
}

export async function login(email, password) {
  const data = await api("/api/auth/login", { method:"POST", body:{ email, password } });
  setToken(data.token);
  return data;
}

export async function register(name, email, password, ref=null) {
  const data = await api("/api/auth/register", { method:"POST", body:{ name, email, password, ref } });
  setToken(data.token);
  return data;
}

// ✅ NOVO: salva carteira no backend
export async function saveWallet(walletAddress) {
  const token = getToken();
  return api("/api/me/wallet", { method:"POST", token, body:{ walletAddress } });
}

export function requireLogged() {
  const token = getToken();
  if (!token) {
    location.href = "/login.html";
    return null;
  }
  return token;
}

export function requireActive(sub) {
  if (!sub || sub.status !== "active") {
    location.href = "/assinatura.html";
    return false;
  }
  return true;
}
