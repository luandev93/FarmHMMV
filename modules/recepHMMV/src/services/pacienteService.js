// ============================================================
// services/pacienteService.js
// Cadastro e atualização de pacientes com validação de CNS/CPF.
// ============================================================

'use strict';

const { PrismaClient } = require('@prisma/client');
const { validarCPF }   = require('../utils/validarCPF');
const { validarCNS }   = require('../utils/validarCNS');
const { registrarAuditoria } = require('./auditService');

const prisma = new PrismaClient();

/**
 * Cria ou atualiza um paciente por CPF.
 * CPF ou CNS devem ser fornecidos (pelo menos um).
 * Validações críticas ficam neste serviço (camada confiável).
 */
async function upsertPaciente({ dados, usuarioId, funcao, correlationId, ip }) {
  const { cpf, cns, nome, dataNascimento, nomeMae, municipio, telefone, email, sexo } = dados;

  // Validação de CPF (quando fornecido)
  if (cpf && !validarCPF(cpf)) {
    const err = new Error('CPF inválido.');
    err.status = 422;
    throw err;
  }

  // Validação de CNS (quando fornecido)
  if (cns && !validarCNS(cns)) {
    const err = new Error('CNS inválido.');
    err.status = 422;
    throw err;
  }

  if (!cpf && !cns) {
    const err = new Error('CPF ou CNS é obrigatório.');
    err.status = 422;
    throw err;
  }

  // Upsert por CPF (identificador principal); CNS é alternativo
  const chave = cpf ? { cpf: cpf.replace(/\D/g, '') } : { cns: cns.replace(/\D/g, '') };

  const paciente = await prisma.paciente.upsert({
    where: chave,
    update: {
      cns:           cns  ? cns.replace(/\D/g, '')  : undefined,
      nome,
      dataNascimento: dataNascimento ? new Date(dataNascimento) : undefined,
      nomeMae,
      municipio,
      telefone,
      email,
      sexo,
      atualizadoEm: new Date(),
    },
    create: {
      cpf:           cpf  ? cpf.replace(/\D/g, '')  : undefined,
      cns:           cns  ? cns.replace(/\D/g, '')  : undefined,
      nome,
      dataNascimento: dataNascimento ? new Date(dataNascimento) : undefined,
      nomeMae,
      municipio,
      telefone,
      email,
      sexo,
    },
  });

  await registrarAuditoria({
    acao: 'PACIENTE_UPSERT',
    entidade: 'Paciente',
    entidadeId: paciente.id,
    usuarioId,
    funcao,
    payload: { cpf: cpf ? '***' : null, cns: cns ? '***' : null, nome },
    correlationId,
    ip,
  });

  return paciente;
}

/**
 * Busca paciente por CPF, CNS ou ID.
 */
async function buscarPaciente({ id, cpf, cns }) {
  if (id)  return prisma.paciente.findUnique({ where: { id } });
  if (cpf) return prisma.paciente.findUnique({ where: { cpf: cpf.replace(/\D/g, '') } });
  if (cns) return prisma.paciente.findUnique({ where: { cns: cns.replace(/\D/g, '') } });
  return null;
}

module.exports = { upsertPaciente, buscarPaciente };
