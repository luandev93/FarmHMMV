// ============================================================
// integrations/farmHMMV.js
// Cliente de integração com o módulo Farmácia (FarmHMMV).
// Envia prescrições com retry e backoff exponencial.
// Falha na integração NÃO bloqueia o fluxo médico.
// ============================================================

'use strict';

const https  = require('https');
const http   = require('http');
const { URL } = require('url');

const BASE_URL       = process.env.FARMHMMV_URL || 'http://localhost:3003';
const API_KEY        = process.env.FARMHMMV_API_KEY || '';
const MAX_TENTATIVAS = parseInt(process.env.INTEGRATION_MAX_RETRY || '3', 10);
const DELAY_BASE_MS  = parseInt(process.env.INTEGRATION_RETRY_DELAY_MS || '500', 10);

function aguardar(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function requisicao(metodo, caminho, corpo, correlationId) {
  return new Promise((resolve, reject) => {
    const url    = new URL(caminho, BASE_URL);
    const modulo = url.protocol === 'https:' ? https : http;
    const dados  = corpo ? JSON.stringify(corpo) : null;

    const opcoes = {
      hostname: url.hostname,
      port:     url.port || (url.protocol === 'https:' ? 443 : 80),
      path:     url.pathname + url.search,
      method:   metodo,
      headers: {
        'Content-Type':    'application/json',
        'X-Api-Key':       API_KEY,
        'X-Correlation-Id': correlationId,
        ...(dados ? { 'Content-Length': Buffer.byteLength(dados) } : {}),
      },
      timeout: 10_000,
    };

    const req = modulo.request(opcoes, (res) => {
      let buffer = '';
      res.on('data', chunk => { buffer += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(buffer) });
        } catch {
          resolve({ status: res.statusCode, body: buffer });
        }
      });
    });

    req.on('timeout', () => { req.destroy(new Error('Timeout na integração farmHMMV.')); });
    req.on('error', reject);
    if (dados) req.write(dados);
    req.end();
  });
}

/**
 * Envia uma prescrição para a farmácia com retry.
 * @param {object} prescricao — objeto completo com itens
 * @param {string} correlationId
 * @returns {Promise<boolean>} true se enviado com sucesso
 */
async function enviarPrescricao(prescricao, correlationId) {
  let tentativa = 0;

  while (tentativa < MAX_TENTATIVAS) {
    try {
      const resp = await requisicao(
        'POST',
        '/prescricoes/receber',
        {
          evento: 'PRESCRIPTION_SENT',
          prescricaoId:  prescricao.id,
          consultaId:    prescricao.consultaId,
          itens:         (prescricao.itens || []).map(i => ({
            medicamento: i.medicamento,
            dose:        i.dose,
            via:         i.via,
            frequencia:  i.frequencia,
            duracao:     i.duracao,
          })),
        },
        correlationId
      );

      if (resp.status >= 200 && resp.status < 300) {
        return true;
      }

      // 4xx → não retenta
      if (resp.status >= 400 && resp.status < 500) {
        console.error(`[integração farmHMMV] Prescrição rejeitada: HTTP ${resp.status}`);
        return false;
      }
    } catch (err) {
      console.warn(`[integração farmHMMV] Erro na tentativa ${tentativa + 1}: ${err.message}`);
    }

    tentativa++;
    if (tentativa < MAX_TENTATIVAS) {
      const delay = DELAY_BASE_MS * Math.pow(2, tentativa - 1);
      await aguardar(delay);
    }
  }

  console.error(`[integração farmHMMV] Prescrição ${prescricao.id} não entregue após ${MAX_TENTATIVAS} tentativas.`);
  return false;
}

module.exports = { enviarPrescricao };
