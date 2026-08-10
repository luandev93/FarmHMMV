// ============================================================
// services/consultaService.js
// Início, encerramento e evolução SOAP de consultas médicas.
// ============================================================

'use strict';

const { PrismaClient } = require('@prisma/client');
const { registrarAuditoria } = require('./auditService');

const prisma = new PrismaClient();

/**
 * Inicia uma consulta a partir de um atendimento existente.
 * O atendimento deve estar no estado AGUARDANDO_MEDICO.
 */
async function iniciarConsulta({ atendimentoId, medicoId, usuarioId, funcao, correlationId, ip }) {
  // Verifica duplicidade: um atendimento só pode ter uma consulta ativa
  const existente = await prisma.consulta.findFirst({
    where: { atendimentoId, estado: { in: ['EM_ANDAMENTO'] } },
  });
  if (existente) {
    const err = new Error('Já existe uma consulta em andamento para este atendimento.');
    err.status = 409;
    throw err;
  }

  const consulta = await prisma.consulta.create({
    data: {
      atendimentoId,
      medicoId,
      estado: 'EM_ANDAMENTO',
      iniciadaEm: new Date(),
      correlationId,
    },
  });

  await registrarAuditoria({
    acao: 'CONSULTA_INICIADA',
    entidade: 'Consulta',
    entidadeId: consulta.id,
    usuarioId, funcao, payload: { atendimentoId, medicoId }, correlationId, ip,
  });

  return consulta;
}

/**
 * Finaliza a consulta com desfecho: ALTA | INTERNACAO | RETORNO | ENCAMINHAMENTO
 */
async function finalizarConsulta({ consultaId, desfecho, observacao, usuarioId, funcao, correlationId, ip }) {
  const DESFECHOS_VALIDOS = ['ALTA', 'INTERNACAO', 'RETORNO', 'ENCAMINHAMENTO'];
  if (!DESFECHOS_VALIDOS.includes(desfecho)) {
    const err = new Error(`Desfecho inválido: '${desfecho}'.`);
    err.status = 422;
    throw err;
  }

  const consulta = await prisma.consulta.findUnique({ where: { id: consultaId } });
  if (!consulta) {
    const err = new Error('Consulta não encontrada.');
    err.status = 404;
    throw err;
  }
  if (consulta.estado !== 'EM_ANDAMENTO') {
    const err = new Error('Consulta não está em andamento.');
    err.status = 422;
    throw err;
  }

  const finalizada = await prisma.consulta.update({
    where: { id: consultaId },
    data: {
      estado: 'FINALIZADA',
      desfecho,
      observacao,
      finalizadaEm: new Date(),
    },
  });

  await registrarAuditoria({
    acao: 'CONSULTA_FINALIZADA',
    entidade: 'Consulta',
    entidadeId: consultaId,
    usuarioId, funcao, payload: { desfecho }, correlationId, ip,
  });

  return finalizada;
}

/**
 * Registra evolução SOAP vinculada a uma consulta.
 * S = Subjetivo, O = Objetivo, A = Avaliação, P = Plano
 */
async function registrarEvolucao({ consultaId, subjetivo, objetivo, avaliacao, plano, usuarioId, funcao, correlationId, ip }) {
  const consulta = await prisma.consulta.findUnique({ where: { id: consultaId } });
  if (!consulta || consulta.estado !== 'EM_ANDAMENTO') {
    const err = new Error('Consulta não está em andamento ou não existe.');
    err.status = 422;
    throw err;
  }

  const evolucao = await prisma.evolucao.create({
    data: {
      consultaId,
      subjetivo,
      objetivo,
      avaliacao,
      plano,
      criadoPor: usuarioId,
    },
  });

  await registrarAuditoria({
    acao: 'EVOLUCAO_REGISTRADA',
    entidade: 'Evolucao',
    entidadeId: evolucao.id,
    usuarioId, funcao, payload: { consultaId }, correlationId, ip,
  });

  return evolucao;
}

module.exports = { iniciarConsulta, finalizarConsulta, registrarEvolucao };
