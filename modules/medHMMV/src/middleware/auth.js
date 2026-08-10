// ============================================================
// middleware/auth.js
// Autenticação JWT obrigatória para rotas protegidas.
// O token deve ser enviado no header: Authorization: ******
// ============================================================

'use strict';

const jwt = require('jsonwebtoken');

const SEGREDO_JWT = process.env.JWT_SECRET;

if (!SEGREDO_JWT && process.env.NODE_ENV !== 'test') {
  console.error('[SEGURANÇA] JWT_SECRET não definido! Configure a variável de ambiente.');
}

/**
 * Valida o JWT ****** injeta req.usuario com { id, nome, funcao, municipioId }.
 * Retorna 401 se o token estiver ausente, inválido ou expirado.
 */
function autenticar(req, res, next) {
  const cabecalho = req.headers['authorization'] || '';
  const partes    = cabecalho.split(' ');

  if (partes.length !== 2 || partes[0].toLowerCase() !== 'bearer') {
    return res.status(401).json({ erro: 'Token de autenticação ausente ou malformado.' });
  }

  const token = partes[1];

  try {
    const payload = jwt.verify(token, SEGREDO_JWT || 'dev-insecure-secret');
    req.usuario = {
      id:         payload.sub,
      nome:       payload.nome,
      funcao:     payload.funcao,    // ex.: 'recepcao', 'adm', 'medico', 'enf'
      municipioId: payload.municipioId,
    };
    next();
  } catch (err) {
    const mensagem = err.name === 'TokenExpiredError'
      ? 'Token expirado. Faça login novamente.'
      : 'Token inválido.';
    return res.status(401).json({ erro: mensagem });
  }
}

module.exports = { autenticar };
