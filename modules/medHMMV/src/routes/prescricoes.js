// ============================================================
// routes/prescricoes.js — criação de prescrições médicas
// ============================================================
'use strict';

const express    = require('express');
const router     = express.Router();
const { z }      = require('zod');

const { autenticar } = require('../middleware/auth');
const { autorizar }  = require('../middleware/rbac');
const { validar }    = require('../middleware/validate');
const { criarPrescricao } = require('../services/prescricaoService');

const schemaItem = z.object({
  medicamento: z.string().min(2, 'Nome do medicamento obrigatório.'),
  dose:        z.string().min(1, 'Dose obrigatória.'),
  via:         z.string().optional(), // oral, EV, IM, SC, etc.
  frequencia:  z.string().optional(), // 8/8h, 12/12h, etc.
  duracao:     z.string().optional(), // 7 dias, etc.
  observacao:  z.string().optional(),
});

const schemaPrescricao = z.object({
  consultaId: z.string().uuid('ID da consulta inválido.'),
  itens:      z.array(schemaItem).min(1, 'Ao menos um item é obrigatório.'),
});

/**
 * POST /prescricoes
 * Cria prescrição com itens e envia para farmácia.
 */
router.post(
  '/',
  autenticar,
  autorizar(['medico', 'adm']),
  validar(schemaPrescricao),
  async (req, res, next) => {
    try {
      const prescricao = await criarPrescricao({
        ...req.body,
        usuarioId:     req.usuario.id,
        funcao:        req.usuario.funcao,
        correlationId: req.correlationId,
        ip:            req.ip,
      });
      res.status(201).json(prescricao);
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
