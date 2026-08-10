// ============================================================
// integrations/recepHMMV.js
// Cliente para notificar o módulo Recepção sobre desfechos.
// ============================================================

'use strict';

const https  = require('https');
const http   = require('http');
const { URL } = require('url');

const BASE_URL       = process.env.RECEPHMMV_URL || 'http://localhost:3001';
const API_KEY        = process.env.RECEPHMMV_API_KEY || '';
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
        'Content-Type': 'application/json',
        'X-Api-Key':    API_KEY,
        'X-Correlation-Id': correlationId,
        ...(dados ? { 'Content-Length': Buffer.byteLength(dados) } : {}),
      },
      timeout: 10_000,
    };

    const req = modulo.request(opcoes, (res) => {
      let buffer = '';
      res.on('data', chunk => { buffer += chunk; });
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(buffer) }); }
        catch { resolve({ status: res.statusCode, body: buffer }); }
      });
    });

    req.on('timeout', () => req.destroy(new Error('Timeout na integração recepHMMV.')));
    req.on('error', reject);
    if (dados) req.write(dados);
    req.end();
  });
}

/**
 * Notifica a recepção sobre o desfecho de um atendimento.
 */
async function notificarDesfecho(evento, payload, correlationId) {
  let tentativa = 0;
  while (tentativa < MAX_TENTATIVAS) {
    try {
      const resp = await requisicao('POST', '/eventos', { evento, payload }, correlationId);
      if (resp.status >= 200 && resp.status < 300) return true;
      if (resp.status >= 400 && resp.status < 500) {
        console.error(`[integração recepHMMV] Evento rejeitado: HTTP ${resp.status}`);
        return false;
      }
    } catch (err) {
      console.warn(`[integração recepHMMV] Erro tentativa ${tentativa + 1}: ${err.message}`);
    }
    tentativa++;
    if (tentativa < MAX_TENTATIVAS) {
      await aguardar(DELAY_BASE_MS * Math.pow(2, tentativa - 1));
    }
  }
  console.error(`[integração recepHMMV] Evento '${evento}' não entregue após ${MAX_TENTATIVAS} tentativas.`);
  return false;
}

module.exports = { notificarDesfecho };
