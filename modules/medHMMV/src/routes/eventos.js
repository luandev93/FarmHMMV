// ============================================================
// routes/eventos.js
// Receptor de eventos de integração vindos de outros módulos.
// Garante idempotência por correlationId.
// ============================================================
'use strict';

const express    = require('express');
const router     = express.Router();
const { z }      = require('zod');
const { validar } = require('../middleware/validate');
const { registrarAuditoria } = require('../services/auditService');

// Autenticação por API Key entre serviços (não JWT de usuário final)
function autenticarApiKey(req, res, next) {
  const chave    = req.headers['x-api-key'] || '';
  const esperada = process.env.MED_API_KEY || '';

  if (!esperada || chave !== esperada) {
    return res.status(401).json({ erro: 'API Key inválida ou ausente.' });
  }
  next();
}

const schemaEvento = z.object({
  evento:  z.string().min(1),
  payload: z.record(z.unknown()).optional(),
});

// Registro simples de eventos recebidos para idempotência (em memória; em produção usar Redis/DB)
const eventosRecebidos = new Set();

/**
 * POST /eventos
 * Recebe eventos de outros módulos (recepção, farmácia).
 */
router.post(
  '/',
  autenticarApiKey,
  validar(schemaEvento),
  async (req, res, next) => {
    const { evento, payload } = req.body;
    const correlationId = req.correlationId;

    // Idempotência: ignora evento já processado
    if (eventosRecebidos.has(correlationId)) {
      return res.status(200).json({ status: 'ja_processado', correlationId });
    }
    eventosRecebidos.add(correlationId);

    try {
      await registrarAuditoria({
        acao:          `EVENTO_RECEBIDO:${evento}`,
        entidade:      'Evento',
        entidadeId:    correlationId,
        usuarioId:     'sistema',
        funcao:        'integracao',
        payload,
        correlationId,
        ip:            req.ip,
      });

      // Processamento específico por tipo de evento
      switch (evento) {
        case 'PATIENT_TRANSFERRED':
          // Aqui pode-se atualizar estado interno ou notificar médico de plantão
          console.log(`[medHMMV] Paciente transferido: ${JSON.stringify(payload)}`);
          break;
        case 'PRESCRIPTION_DISPENSED':
          // Farmácia confirmou dispensação
          console.log(`[medHMMV] Prescrição dispensada: ${JSON.stringify(payload)}`);
          break;
        default:
          console.log(`[medHMMV] Evento recebido (sem handler): ${evento}`);
      }

      res.status(200).json({ status: 'recebido', evento, correlationId });
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
