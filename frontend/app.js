// frontend/app.js
(() => {
  const API_BASE = window.LF_API_BASE || "http://localhost:3000";

  function getToken() {
    return localStorage.getItem("lf_token");
  }

  function setToken(token) {
    localStorage.setItem("lf_token", token);
  }

  function clearToken() {
    localStorage.removeItem("lf_token");
  }

  async function apiFetch(path, options = {}) {
    const url = `${API_BASE}${path}`;
    const headers = Object.assign(
      { "Content-Type": "application/json" },
      options.headers || {}
    );

    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;

    const res = await fetch(url, { ...options, headers });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const err = new Error(data?.error || "REQUEST_FAILED");
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  }

  function requireAuth() {
    const token = getToken();
    if (!token) {
      window.location.href = "./login.html";
      return false;
    }
    return true;
  }

  function attachLogout(selectorOrId = "#logoutLink") {
    const el = document.querySelector(selectorOrId);
    if (!el) return;
    el.addEventListener("click", (e) => {
      e.preventDefault();
      clearToken();
      window.location.href = "./index.html";
    });
  }

  // Helpers
  function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value ?? "";
  }

  async function login(email, password) {
    const { token } = await apiFetch("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password })
    });
    setToken(token);
    return token;
  }

  async function register(email, password) {
    const { user } = await apiFetch("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password })
    });
    return user;
  }

  window.LF = {
    API_BASE,
    getToken,
    setToken,
    clearToken,
    apiFetch,
    requireAuth,
    attachLogout,
    setText,
    login,
    register
  };
})();
