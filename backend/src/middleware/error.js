import { logger } from "../utils/logger.js";

export function notFound(req, res, next) {
  if (req.path.startsWith("/api")) {
    return res.status(404).json({ error: "Not Found" });
  }
  return next();
}

export function errorHandler(err, req, res, next) {
  logger.error("Erro:", err);

  if (req.path.startsWith("/api")) {
    return res.status(500).json({ error: "Erro interno" });
  }

  return res.status(500).send("Erro interno");
}
