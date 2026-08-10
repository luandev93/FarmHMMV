// ============================================================
// app.js — ponto de entrada do módulo Médico (medHMMV)
// Carrega middlewares globais, rotas e inicia o servidor HTTP.
// ============================================================

'use strict';

require('dotenv').config();

const express   = require('express');
const helmet    = require('helmet');
const cors      = require('cors');
const rateLimit = require('express-rate-limit');

const { correlationIdMiddleware } = require('./middleware/correlationId');
const rotaHealth    = require('./routes/health');
const rotaConsultas = require('./routes/consultas');
const rotaPrescricoes = require('./routes/prescricoes');
const rotaEventos   = require('./routes/eventos');

const app = express();

// Segurança básica
app.use(helmet());

// CORS
const origensPermitidas = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);

app.use(cors({
  origin: origensPermitidas.length > 0 ? origensPermitidas : false,
  methods: ['GET', 'POST', 'PUT', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Correlation-Id', 'X-Api-Key'],
}));

// Rate limiting global
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX || '300', 10),
  standardHeaders: true,
  legacyHeaders: false,
  message: { erro: 'Muitas requisições. Tente novamente em alguns minutos.' },
}));

app.use(express.json({ limit: '512kb' }));
app.use(correlationIdMiddleware);

// Rotas
app.use('/health',     rotaHealth);
app.use('/consultas',  rotaConsultas);
app.use('/prescricoes', rotaPrescricoes);
app.use('/eventos',    rotaEventos);

// Handler de erro global
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, _next) => {
  const isProd = process.env.NODE_ENV === 'production';
  console.error('[ERRO GLOBAL]', err);
  res.status(err.status || 500).json({
    erro: isProd ? 'Erro interno do servidor.' : err.message,
    correlationId: req.correlationId,
  });
});

const PORTA = parseInt(process.env.PORT || '3002', 10);

if (require.main === module) {
  app.listen(PORTA, () => {
    console.log(`[medHMMV] Servidor iniciado na porta ${PORTA} — ${process.env.NODE_ENV || 'development'}`);
  });
}

module.exports = app;
