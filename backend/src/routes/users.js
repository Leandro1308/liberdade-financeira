// backend/src/routes/users.js (ESM)
import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

/**
 * Alias simples para dados do usuário logado.
 * Mantém compatibilidade caso alguma tela chame /api/users/me
 * Sem depender do db.json legado.
 */
router.get("/me", requireAuth, (req, res) => {
  const u = req.user || {};

  return res.json({
    ok: true,
    user: {
      id: u._id?.toString?.() || u.id || null,
      email: u.email || null,
      createdAt: u.createdAt || null,
    },
  });
});

export default router;
