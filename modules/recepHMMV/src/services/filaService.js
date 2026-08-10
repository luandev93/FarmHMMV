// ============================================================
// services/filaService.js
// Enfileiramento por prioridade — protocolo de Manchester simplificado.
// Prioridades: VERMELHO(1) > LARANJA(2) > AMARELO(3) > VERDE(4) > AZUL(5)
// ============================================================

'use strict';

const { PrismaClient } = require('@prisma/client');
const { registrarAuditoria } = require('./auditService');

const prisma = new PrismaClient();

// Mapeamento de cor → nível numérico (menor = mais urgente)
const PRIORIDADE_MANCHESTER = {
  VERMELHO: 1, // Emergência — atendimento imediato
  LARANJA:  2, // Muito urgente — até 10 min
  AMARELO:  3, // Urgente — até 60 min
  VERDE:    4, // Pouco urgente — até 120 min
  AZUL:     5, // Não urgente — até 240 min
};

/**
 * Adiciona paciente à fila com prioridade Manchester.
 */
async function enfileirar({ atendimentoId, prioridade, queixaTriagem, usuarioId, funcao, correlationId, ip }) {
  if (!PRIORIDADE_MANCHESTER[prioridade]) {
    const err = new Error(`Prioridade inválida: '${prioridade}'. Use: ${Object.keys(PRIORIDADE_MANCHESTER).join(', ')}`);
    err.status = 422;
    throw err;
  }

  // Garante idempotência: um atendimento só pode estar na fila uma vez
  const existente = await prisma.filaEspera.findUnique({ where: { atendimentoId } });
  if (existente) {
    // Atualiza prioridade se já enfileirado
    const atualizado = await prisma.filaEspera.update({
      where: { atendimentoId },
      data: { prioridade, nivelNumerico: PRIORIDADE_MANCHESTER[prioridade], queixaTriagem },
    });
    await registrarAuditoria({
      acao: 'FILA_PRIORIDADE_ATUALIZADA',
      entidade: 'FilaEspera',
      entidadeId: atualizado.id,
      usuarioId, funcao, payload: { prioridade }, correlationId, ip,
    });
    return atualizado;
  }

  const fila = await prisma.filaEspera.create({
    data: {
      atendimentoId,
      prioridade,
      nivelNumerico: PRIORIDADE_MANCHESTER[prioridade],
      queixaTriagem,
    },
  });

  await registrarAuditoria({
    acao: 'FILA_ENFILEIRADO',
    entidade: 'FilaEspera',
    entidadeId: fila.id,
    usuarioId, funcao, payload: { atendimentoId, prioridade }, correlationId, ip,
  });

  return fila;
}

/**
 * Retorna a fila ordenada por prioridade (Manchester) e horário de chegada.
 */
async function listarFila() {
  return prisma.filaEspera.findMany({
    where: { saidaEm: null }, // apenas aguardando
    orderBy: [
      { nivelNumerico: 'asc' },
      { criadoEm: 'asc' },
    ],
    include: {
      atendimento: {
        include: { paciente: true },
      },
    },
  });
}

/**
 * Remove da fila (quando chamado pelo médico ou por cancelamento).
 */
async function removerDaFila({ atendimentoId, usuarioId, funcao, correlationId, ip }) {
  const fila = await prisma.filaEspera.findUnique({ where: { atendimentoId } });
  if (!fila) {
    const err = new Error('Paciente não está na fila.');
    err.status = 404;
    throw err;
  }

  const removido = await prisma.filaEspera.update({
    where: { atendimentoId },
    data: { saidaEm: new Date() },
  });

  await registrarAuditoria({
    acao: 'FILA_SAIDA',
    entidade: 'FilaEspera',
    entidadeId: fila.id,
    usuarioId, funcao, payload: { atendimentoId }, correlationId, ip,
  });

  return removido;
}

module.exports = { enfileirar, listarFila, removerDaFila };
