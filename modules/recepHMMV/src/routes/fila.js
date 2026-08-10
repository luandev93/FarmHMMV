// ============================================================
// routes/fila.js — gerenciamento da fila de espera Manchester
// ============================================================
'use strict';

const express    = require('express');
const router     = express.Router();
const { z }      = require('zod');

const { autenticar } = require('../middleware/auth');
const { autorizar }  = require('../middleware/rbac');
const { validar }    = require('../middleware/validate');

const { enfileirar, listarFila, removerDaFila } = require('../services/filaService');

const schemaFila = z.object({
  atendimentoId: z.string().uuid('ID do atendimento inválido.'),
  prioridade:    z.enum(['VERMELHO', 'LARANJA', 'AMARELO', 'VERDE', 'AZUL']),
  queixaTriagem: z.string().min(3, 'Queixa de triagem obrigatória.').optional(),
});

/**
 * POST /fila
 * Adiciona ou atualiza paciente na fila com prioridade Manchester.
 */
router.post(
  '/',
  autenticar,
  autorizar(['recepcao', 'adm', 'enf']),
  validar(schemaFila),
  async (req, res, next) => {
    try {
      const entrada = await enfileirar({
        ...req.body,
        usuarioId:     req.usuario.id,
        funcao:        req.usuario.funcao,
        correlationId: req.correlationId,
        ip:            req.ip,
      });
      res.status(200).json(entrada);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /fila
 * Lista a fila ordenada por prioridade e horário.
 */
router.get(
  '/',
  autenticar,
  autorizar(['recepcao', 'adm', 'enf', 'medico']),
  async (_req, res, next) => {
    try {
      const fila = await listarFila();
      res.json(fila);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * DELETE /fila/:atendimentoId
 * Remove paciente da fila (chamada pelo médico ou cancelamento).
 */
router.delete(
  '/:atendimentoId',
  autenticar,
  autorizar(['recepcao', 'adm', 'enf', 'medico']),
  async (req, res, next) => {
    try {
      const removido = await removerDaFila({
        atendimentoId: req.params.atendimentoId,
        usuarioId:     req.usuario.id,
        funcao:        req.usuario.funcao,
        correlationId: req.correlationId,
        ip:            req.ip,
      });
      res.json(removido);
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
