// ============================================================
// routes/pacientes.js — CRUD de pacientes
// ============================================================
'use strict';

const express    = require('express');
const router     = express.Router();
const { z }      = require('zod');

const { autenticar } = require('../middleware/auth');
const { autorizar }  = require('../middleware/rbac');
const { validar }    = require('../middleware/validate');

const {
  upsertPaciente,
  buscarPaciente,
} = require('../services/pacienteService');

// Schema Zod para criação/atualização de paciente
const schemaPaciente = z.object({
  cpf:            z.string().optional(),
  cns:            z.string().optional(),
  nome:           z.string().min(2, 'Nome obrigatório com ao menos 2 caracteres.'),
  dataNascimento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data no formato YYYY-MM-DD.').optional(),
  nomeMae:        z.string().optional(),
  municipio:      z.string().optional(),
  telefone:       z.string().optional(),
  email:          z.string().email().optional().or(z.literal('')),
  sexo:           z.enum(['M', 'F', 'I']).optional(), // M/F/Indeterminado
}).refine(d => d.cpf || d.cns, { message: 'CPF ou CNS é obrigatório.' });

/**
 * POST /pacientes
 * Cria ou atualiza (upsert) um paciente.
 * Exige papel: recepcao ou adm
 */
router.post(
  '/',
  autenticar,
  autorizar(['recepcao', 'adm']),
  validar(schemaPaciente),
  async (req, res, next) => {
    try {
      const paciente = await upsertPaciente({
        dados:         req.body,
        usuarioId:     req.usuario.id,
        funcao:        req.usuario.funcao,
        correlationId: req.correlationId,
        ip:            req.ip,
      });
      res.status(200).json(paciente);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /pacientes/:id
 * Busca paciente por ID interno, CPF ou CNS (via query ?cpf= ou ?cns=).
 */
router.get(
  '/:id',
  autenticar,
  autorizar(['recepcao', 'adm', 'medico', 'enf']),
  async (req, res, next) => {
    try {
      const paciente = await buscarPaciente({
        id:  req.params.id !== 'buscar' ? req.params.id : undefined,
        cpf: req.query.cpf,
        cns: req.query.cns,
      });
      if (!paciente) return res.status(404).json({ erro: 'Paciente não encontrado.' });
      res.json(paciente);
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
