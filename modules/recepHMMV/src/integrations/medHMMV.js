// ============================================================
// integrations/medHMMV.js
// Cliente de integração com o módulo Médico (medHMMV).
// Implementa retry com backoff exponencial para envio de eventos.
// A escrita crítica (prescrição, alta) fica SEMPRE no médico;
// este cliente apenas NOTIFICA, nunca assume sucesso silencioso.
// ============================================================

'use strict';

const https  = require('https');
const http   = require('http');
const { URL } = require('url');

const BASE_URL       = process.env.MEDHMMV_URL || 'http://localhost:3002';
const API_KEY        = process.env.MEDHMMV_API_KEY || '';
const MAX_TENTATIVAS = parseInt(process.env.INTEGRATION_MAX_RETRY || '3', 10);
const DELAY_BASE_MS  = parseInt(process.env.INTEGRATION_RETRY_DELAY_MS || '500', 10);

/**
 * Aguarda `ms` milissegundos.
 */
function aguardar(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Envia uma requisição HTTP para o medHMMV.
 * @param {string} metodo  — GET, POST, PATCH
 * @param {string} caminho — ex.: '/eventos'
 * @param {object|null} corpo
 * @param {string} correlationId
 * @returns {Promise<{status: number, body: any}>}
 */
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

    req.on('timeout', () => { req.destroy(new Error('Timeout na integração medHMMV.')); });
    req.on('error', reject);

    if (dados) req.write(dados);
    req.end();
  });
}

/**
 * Envia evento com retry e backoff exponencial.
 * @param {string} evento   — ex.: 'PATIENT_TRANSFERRED'
 * @param {object} payload
 * @param {string} correlationId
 */
async function enviarEvento(evento, payload, correlationId) {
  let tentativa = 0;
  let ultimoErro;

  while (tentativa < MAX_TENTATIVAS) {
    try {
      const resp = await requisicao('POST', '/eventos', { evento, payload }, correlationId);

      if (resp.status >= 200 && resp.status < 300) {
        return resp.body;
      }

      // Erros 4xx não têm retry (dados inválidos, não erro transitório)
      if (resp.status >= 400 && resp.status < 500) {
        const err = new Error(`medHMMV rejeitou o evento ${evento}: HTTP ${resp.status}`);
        err.status = resp.status;
        throw err;
      }

      ultimoErro = new Error(`medHMMV retornou HTTP ${resp.status}`);
    } catch (err) {
      ultimoErro = err;
      if (err.status >= 400 && err.status < 500) throw err; // sem retry para 4xx
    }

    tentativa++;
    if (tentativa < MAX_TENTATIVAS) {
      const delay = DELAY_BASE_MS * Math.pow(2, tentativa - 1);
      console.warn(`[integração medHMMV] tentativa ${tentativa}/${MAX_TENTATIVAS} falhou. Aguardando ${delay}ms...`);
      await aguardar(delay);
    }
  }

  // Falhou após todas as tentativas — loga, mas não propaga erro crítico
  // (evitar que falha de integração derrube o fluxo de recepção)
  console.error(`[integração medHMMV] Evento '${evento}' não entregue após ${MAX_TENTATIVAS} tentativas.`, ultimoErro);
  return null;
}

module.exports = { enviarEvento };
