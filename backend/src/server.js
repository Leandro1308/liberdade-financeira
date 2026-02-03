import http from "http";
import { app } from "./app.js";
import { connectMongo } from "./db/mongo.js";
import { env } from "./config/env.js";
import { logger } from "./utils/logger.js";

async function start() {
  await connectMongo();

  const server = http.createServer(app);

  server.listen(env.PORT, () => {
    logger.info(`🚀 Server online na porta ${env.PORT}`);
  });

  // Encerramento seguro
  process.on("SIGTERM", () => {
    logger.warn("SIGTERM recebido. Encerrando...");
    server.close(() => process.exit(0));
  });
  process.on("SIGINT", () => {
    logger.warn("SIGINT recebido. Encerrando...");
    server.close(() => process.exit(0));
  });
}

start().catch((err) => {
  logger.error("Falha ao iniciar servidor:", err);
  process.exit(1);
});
