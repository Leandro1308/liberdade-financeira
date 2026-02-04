// backend/src/routes/ping.routes.js
import { Router } from "express";
import { pingDb } from "../controllers/ping.controller.js";

const router = Router();

// rota de teste com banco
router.get("/ping-db", pingDb);

export default router;
