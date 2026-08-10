// ============================================================
// middleware/correlationId.js
// Injeta ou propaga um ID de correlação em cada requisição.
// Facilita rastreamento de logs entre serviços.
// ============================================================

'use strict';

const { v4: uuidv4 } = require('uuid');

/**
 * Middleware que garante que toda requisição possua um correlationId único.
 * O valor pode ser enviado pelo cliente via header X-Correlation-Id,
 * ou é gerado automaticamente.
 */
function correlationIdMiddleware(req, res, next) {
  const id = req.headers['x-correlation-id'] || uuidv4();
  req.correlationId = id;
  res.setHeader('X-Correlation-Id', id);
  next();
}

module.exports = { correlationIdMiddleware };
