// ============================================================
// routes/atendimentos.js — criação e transição de atendimentos
// ============================================================
'use strict';

const express    = require('express');
const router     = express.Router();
const { z }      = require('zod');

const { autenticar } = require('../middleware/auth');
const { autorizar }  = require('../middleware/rbac');
const { validar }    = require('../middleware/validate');

const {
  criarAtendimento,
  transicionarEstado,
} = require('../services/atendimentoService');

const schemaAtendimento = z.object({
  pacienteId:      z.string().uuid('ID do paciente inválido.'),
  tipo:            z.enum(['CONSULTA', 'URGENCIA', 'EMERGENCIA', 'RETORNO']).default('CONSULTA'),
  queixaPrincipal: z.string().min(3, 'Queixa principal obrigatória.'),
});

const schemaTransicao = z.object({
  novoEstado: z.enum(['AGUARDANDO', 'EM_TRIAGEM', 'AGUARDANDO_MEDICO', 'TRANSFERIDO', 'CANCELADO']),
});

/**
 * POST /atendimentos
 * Cria atendimento inicial para um paciente.
 */
router.post(
  '/',
  autenticar,
  autorizar(['recepcao', 'adm']),
  validar(schemaAtendimento),
  async (req, res, next) => {
    try {
      const atendimento = await criarAtendimento({
        ...req.body,
        usuarioId:     req.usuario.id,
        funcao:        req.usuario.funcao,
        correlationId: req.correlationId,
        ip:            req.ip,
      });
      res.status(201).json(atendimento);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * PATCH /atendimentos/:id/estado
 * Transição segura de estado do atendimento.
 */
router.patch(
  '/:id/estado',
  autenticar,
  autorizar(['recepcao', 'adm', 'enf']),
  validar(schemaTransicao),
  async (req, res, next) => {
    try {
      const atualizado = await transicionarEstado({
        atendimentoId: req.params.id,
        novoEstado:    req.body.novoEstado,
        usuarioId:     req.usuario.id,
        funcao:        req.usuario.funcao,
        correlationId: req.correlationId,
        ip:            req.ip,
      });
      res.json(atualizado);
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
