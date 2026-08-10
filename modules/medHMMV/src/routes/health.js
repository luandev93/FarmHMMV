// ============================================================
// routes/health.js — healthcheck do módulo Médico
// ============================================================
'use strict';

const express = require('express');
const router  = express.Router();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

router.get('/', async (req, res) => {
  const status = { servico: 'medHMMV', status: 'ok', banco: 'desconhecido' };
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
