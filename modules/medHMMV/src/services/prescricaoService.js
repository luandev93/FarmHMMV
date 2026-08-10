// ============================================================
// services/prescricaoService.js
// Criação de prescrição e itens + envio para farmácia.
// A escrita é feita neste módulo; farmácia apenas recebe o evento.
// ============================================================

'use strict';

const { PrismaClient } = require('@prisma/client');
const { registrarAuditoria } = require('./auditService');
const { enviarPrescricao }   = require('../integrations/farmHMMV');

const prisma = new PrismaClient();

/**
 * Cria prescrição com itens de medicamento.
 * @param {object} params
 * @param {string} params.consultaId
 * @param {Array}  params.itens — [{ medicamento, dose, via, frequencia, duracao, observacao }]
 */
async function criarPrescricao({ consultaId, itens = [], usuarioId, funcao, correlationId, ip }) {
  if (!itens || itens.length === 0) {
    const err = new Error('A prescrição deve ter ao menos um item.');
    err.status = 422;
    throw err;
  }

  const consulta = await prisma.consulta.findUnique({ where: { id: consultaId } });
  if (!consulta || consulta.estado !== 'EM_ANDAMENTO') {
    const err = new Error('Consulta não está em andamento ou não existe.');
    err.status = 422;
    throw err;
  }

  // Cria prescrição e itens em transação atômica
  const prescricao = await prisma.$transaction(async (tx) => {
    const presc = await tx.prescricao.create({
      data: {
        consultaId,
        estado: 'PENDENTE',
        criadoPor: usuarioId,
        correlationId,
      },
    });

    await tx.itemPrescricao.createMany({
      data: itens.map(item => ({
        prescricaoId: presc.id,
        medicamento:  item.medicamento,
        dose:         item.dose,
        via:          item.via,
        frequencia:   item.frequencia,
        duracao:      item.duracao,
        observacao:   item.observacao,
      })),
    });

    return tx.prescricao.findUnique({
      where: { id: presc.id },
      include: { itens: true },
    });
  });

  await registrarAuditoria({
    acao: 'PRESCRICAO_CRIADA',
    entidade: 'Prescricao',
    entidadeId: prescricao.id,
    usuarioId, funcao, payload: { consultaId, totalItens: itens.length }, correlationId, ip,
  });

  // Envia prescrição para farmácia com retry (falha não bloqueia retorno médico)
  const enviada = await enviarPrescricao(prescricao, correlationId);
  if (enviada) {
    await prisma.prescricao.update({
      where: { id: prescricao.id },
      data: { estado: 'ENVIADA_FARMACIA' },
    });
    await registrarAuditoria({
      acao: 'PRESCRICAO_ENVIADA_FARMACIA',
      entidade: 'Prescricao',
      entidadeId: prescricao.id,
      usuarioId, funcao, payload: { estado: 'ENVIADA_FARMACIA' }, correlationId, ip,
    });
  }

  return prescricao;
}

module.exports = { criarPrescricao };
