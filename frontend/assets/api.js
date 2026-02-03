export const API_BASE = `${location.origin}`;

export async function api(path, { method="GET", token=null, body=null } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : null
  });

  const contentType = res.headers.get("content-type") || "";
  const data = contentType.includes("application/json") ? await res.json() : await res.text();

  if (!res.ok) {
    const msg = (data && data.error) ? data.error : "Erro na requisição";
    throw new Error(msg);
  }
  return data;
}
