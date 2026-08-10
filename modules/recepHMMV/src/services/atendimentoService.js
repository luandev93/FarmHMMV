// ============================================================
// services/atendimentoService.js
// Criação de atendimento inicial vinculado ao paciente.
// ============================================================

'use strict';

const { PrismaClient } = require('@prisma/client');
const { registrarAuditoria } = require('./auditService');

const prisma = new PrismaClient();

// Estados válidos do atendimento neste módulo
const ESTADOS_VALIDOS = ['AGUARDANDO', 'EM_TRIAGEM', 'AGUARDANDO_MEDICO', 'TRANSFERIDO', 'CANCELADO'];

/**
 * Cria um atendimento vinculado a um paciente existente.
 * @returns {Promise<object>} atendimento criado
 */
async function criarAtendimento({ pacienteId, tipo, queixaPrincipal, usuarioId, funcao, correlationId, ip }) {
  // Garante que o paciente existe antes de criar o atendimento
  const paciente = await prisma.paciente.findUnique({ where: { id: pacienteId } });
  if (!paciente) {
    const err = new Error('Paciente não encontrado.');
    err.status = 404;
    throw err;
  }

  const atendimento = await prisma.atendimento.create({
    data: {
      pacienteId,
      tipo:           tipo || 'CONSULTA',
      queixaPrincipal,
      estado:         'AGUARDANDO',
      criadoPor:      usuarioId,
      correlationId,
    },
  });

  await registrarAuditoria({
    acao: 'ATENDIMENTO_CRIADO',
    entidade: 'Atendimento',
    entidadeId: atendimento.id,
    usuarioId,
    funcao,
    payload: { pacienteId, tipo, estado: 'AGUARDANDO' },
    correlationId,
    ip,
  });

  return atendimento;
}

/**
 * Transição segura de estado do atendimento.
 * Só permite transições definidas no mapa abaixo.
 */
const TRANSICOES_PERMITIDAS = {
  AGUARDANDO:          ['EM_TRIAGEM', 'CANCELADO'],
  EM_TRIAGEM:          ['AGUARDANDO_MEDICO', 'CANCELADO'],
  AGUARDANDO_MEDICO:   ['TRANSFERIDO', 'CANCELADO'],
  TRANSFERIDO:         [],
  CANCELADO:           [],
};

async function transicionarEstado({ atendimentoId, novoEstado, usuarioId, funcao, correlationId, ip }) {
  if (!ESTADOS_VALIDOS.includes(novoEstado)) {
    const err = new Error(`Estado inválido: ${novoEstado}`);
    err.status = 422;
    throw err;
  }

  const atendimento = await prisma.atendimento.findUnique({ where: { id: atendimentoId } });
  if (!atendimento) {
    const err = new Error('Atendimento não encontrado.');
    err.status = 404;
    throw err;
  }

  const permitidos = TRANSICOES_PERMITIDAS[atendimento.estado] || [];
  if (!permitidos.includes(novoEstado)) {
    const err = new Error(
      `Transição inválida: '${atendimento.estado}' → '${novoEstado}'.`
    );
    err.status = 422;
    throw err;
  }

  const atualizado = await prisma.atendimento.update({
    where: { id: atendimentoId },
    data: { estado: novoEstado, atualizadoEm: new Date() },
  });

  await registrarAuditoria({
    acao: 'ATENDIMENTO_TRANSICAO',
    entidade: 'Atendimento',
    entidadeId: atendimentoId,
    usuarioId,
    funcao,
    payload: { estadoAnterior: atendimento.estado, novoEstado },
    correlationId,
    ip,
  });

  return atualizado;
}

module.exports = { criarAtendimento, transicionarEstado };
