// ============================================================
// services/auditService.js
// Registro de auditoria imutável: criação permitida a todos,
// update e delete bloqueados em nível de serviço e banco.
// ============================================================

'use strict';

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Registra uma entrada de auditoria.
 * @param {object} params
 * @param {string} params.acao       — Nome da ação (ex.: 'PACIENTE_CRIADO')
 * @param {string} params.entidade   — Nome da tabela/entidade afetada
 * @param {string|null} params.entidadeId — ID da entidade afetada (opcional)
 * @param {string} params.usuarioId  — ID do usuário que realizou a ação
 * @param {string} params.funcao     — Função/papel do usuário
 * @param {object|null} params.payload — Dados relevantes (sem campos sensíveis)
 * @param {string} params.correlationId
 * @param {string|null} params.ip    — IP do cliente (opcional)
 */
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
