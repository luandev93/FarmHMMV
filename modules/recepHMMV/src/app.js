// ============================================================
// app.js — ponto de entrada do módulo Recepção (recepHMMV)
// Carrega middlewares globais, rotas e inicia o servidor HTTP.
// ============================================================

'use strict';

require('dotenv').config();

const express = require('express');
const helmet  = require('helmet');
const cors    = require('cors');
const rateLimit = require('express-rate-limit');

const { correlationIdMiddleware } = require('./middleware/correlationId');
const rotaHealth      = require('./routes/health');
const rotaPacientes   = require('./routes/pacientes');
const rotaAtendimentos = require('./routes/atendimentos');
const rotaFila        = require('./routes/fila');

const app = express();

// ----------------------------------------------------------
// Segurança básica: helmet adiciona cabeçalhos HTTP seguros
// ----------------------------------------------------------
app.use(helmet());

// ----------------------------------------------------------
// CORS — ajuste as origens conforme ambiente (prod restringe)
// ----------------------------------------------------------
const origensPermitidas = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);

app.use(cors({
  origin: origensPermitidas.length > 0 ? origensPermitidas : false,
  methods: ['GET', 'POST', 'PUT', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Correlation-Id'],
}));

// ----------------------------------------------------------
// Rate limiting global — protege contra força bruta / DDoS
// ----------------------------------------------------------
app.use(rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: parseInt(process.env.RATE_LIMIT_MAX || '300', 10),
  standardHeaders: true,
  legacyHeaders: false,
  message: { erro: 'Muitas requisições. Tente novamente em alguns minutos.' },
}));

// ----------------------------------------------------------
// Parse de JSON e correlationId para rastreabilidade
// ----------------------------------------------------------
app.use(express.json({ limit: '512kb' }));
app.use(correlationIdMiddleware);

// ----------------------------------------------------------
// Rotas
// ----------------------------------------------------------
app.use('/health',       rotaHealth);
app.use('/pacientes',    rotaPacientes);
app.use('/atendimentos', rotaAtendimentos);
app.use('/fila',         rotaFila);

// ----------------------------------------------------------
// Handler de erro global (não vaza stack trace em produção)
// ----------------------------------------------------------
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, _next) => {
  const isProd = process.env.NODE_ENV === 'production';
  console.error('[ERRO GLOBAL]', err);
  res.status(err.status || 500).json({
    erro: isProd ? 'Erro interno do servidor.' : err.message,
    correlationId: req.correlationId,
  });
});

// ----------------------------------------------------------
// Inicialização
// ----------------------------------------------------------
const PORTA = parseInt(process.env.PORT || '3001', 10);

if (require.main === module) {
  app.listen(PORTA, () => {
    console.log(`[recepHMMV] Servidor iniciado na porta ${PORTA} — ${process.env.NODE_ENV || 'development'}`);
  });
}

module.exports = app; // exportado para testes
