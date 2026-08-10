// ============================================================
// routes/health.js — rota de healthcheck (pública)
// ============================================================
'use strict';

const express = require('express');
const router  = express.Router();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

/**
 * GET /health
 * Retorna status do serviço e conectividade com o banco.
 * Esta rota é pública (sem autenticação) para uso em probes de saúde.
 */
router.get('/', async (req, res) => {
  const status = { servico: 'recepHMMV', status: 'ok', banco: 'desconhecido' };

  try {
    await prisma.$queryRaw`SELECT 1`;
    status.banco = 'ok';
    res.status(200).json(status);
  } catch {
    status.status = 'degradado';
    status.banco  = 'erro';
    res.status(503).json(status);
  }
});

module.exports = router;
