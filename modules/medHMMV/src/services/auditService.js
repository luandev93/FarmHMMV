// ============================================================
// services/auditService.js — Módulo Médico (medHMMV)
// Log imutável de ações médicas: criação permitida, sem update/delete.
// ============================================================

'use strict';

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function registrarAuditoria({
  acao,
  entidade,
  entidadeId = null,
  usuarioId,
  funcao,
  payload = null,
  correlationId,
  ip = null,
}) {
  return prisma.auditoria.create({
    data: {
      acao,
      entidade,
      entidadeId,
      usuarioId,
      funcao,
      payload: payload ? JSON.stringify(payload) : null,
      correlationId,
      ip,
    },
  });
}

module.exports = { registrarAuditoria };
