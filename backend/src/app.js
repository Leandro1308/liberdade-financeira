// app.js (ESM)
import dns from "node:dns/promises";

async function dnsDiagnostics() {
  const host = "curadamente.b9dsw01.mongodb.net";
  const srv = `_mongodb._tcp.${host}`;

  try {
    const srvRecords = await dns.resolveSrv(srv);
    console.log("✅ DNS SRV OK:", srvRecords);
  } catch (e) {
    console.log("❌ DNS SRV FALHOU:", { code: e.code, hostname: e.hostname, message: e.message });
  }

  try {
    const a = await dns.resolve4(host);
    console.log("✅ DNS A OK:", a);
  } catch (e) {
    console.log("⚠️ DNS A falhou:", { code: e.code, message: e.message });
  }

  try {
    const aaaa = await dns.resolve6(host);
    console.log("✅ DNS AAAA OK:", aaaa);
  } catch (e) {
    console.log("⚠️ DNS AAAA falhou:", { code: e.code, message: e.message });
  }
}
