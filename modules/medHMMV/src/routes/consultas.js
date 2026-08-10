// ============================================================
// routes/consultas.js — início, evolução SOAP e finalização
// ============================================================
'use strict';

const express    = require('express');
const router     = express.Router();
const { z }      = require('zod');

const { autenticar } = require('../middleware/auth');
const { autorizar }  = require('../middleware/rbac');
const { validar }    = require('../middleware/validate');
const { notificarDesfecho } = require('../integrations/recepHMMV');

const {
  iniciarConsulta,
  finalizarConsulta,
  registrarEvolucao,
} = require('../services/consultaService');

const schemaIniciar = z.object({
  atendimentoId: z.string().uuid('ID do atendimento inválido.'),
});

const schemaFinalizar = z.object({
  desfecho:   z.enum(['ALTA', 'INTERNACAO', 'RETORNO', 'ENCAMINHAMENTO']),
  observacao: z.string().optional(),
});

const schemaEvolucao = z.object({
  subjetivo: z.string().min(2, 'Subjetivo obrigatório (S do SOAP).'),
  objetivo:  z.string().optional(),
  avaliacao: z.string().optional(),
  plano:     z.string().optional(),
});

/**
 * POST /consultas
 * Inicia uma consulta para um atendimento.
 */
router.post(
  '/',
  autenticar,
  autorizar(['medico', 'adm']),
  validar(schemaIniciar),
  async (req, res, next) => {
    try {
      const consulta = await iniciarConsulta({
        atendimentoId: req.body.atendimentoId,
        medicoId:      req.usuario.id,
        usuarioId:     req.usuario.id,
        funcao:        req.usuario.funcao,
        correlationId: req.correlationId,
        ip:            req.ip,
      });
      res.status(201).json(consulta);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * PATCH /consultas/:id/finalizar
 * Finaliza a consulta com desfecho clínico.
 */
router.patch(
  '/:id/finalizar',
  autenticar,
  autorizar(['medico', 'adm']),
  validar(schemaFinalizar),
  async (req, res, next) => {
    try {
      const finalizada = await finalizarConsulta({
        consultaId:    req.params.id,
        ...req.body,
        usuarioId:     req.usuario.id,
        funcao:        req.usuario.funcao,
        correlationId: req.correlationId,
        ip:            req.ip,
      });

      // Notifica recepção sobre desfecho (não-bloqueante)
      notificarDesfecho(
        'WORKFLOW_UPDATED',
        { consultaId: finalizada.id, desfecho: finalizada.desfecho },
        req.correlationId
      ).catch(() => {}); // falha silenciosa — recepção verifica periodicamente

      res.json(finalizada);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /consultas/:id/evolucoes
 * Registra evolução SOAP durante a consulta.
 */
router.post(
  '/:id/evolucoes',
  autenticar,
  autorizar(['medico', 'adm']),
  validar(schemaEvolucao),
  async (req, res, next) => {
    try {
      const evolucao = await registrarEvolucao({
        consultaId: req.params.id,
        ...req.body,
        usuarioId:     req.usuario.id,
        funcao:        req.usuario.funcao,
        correlationId: req.correlationId,
        ip:            req.ip,
      });
      res.status(201).json(evolucao);
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
