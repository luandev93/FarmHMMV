// ============================================================
// middleware/validate.js
// Validação de payload com Zod.
// Retorna 422 com lista de erros descritivos se falhar.
// ============================================================

'use strict';

const { ZodError } = require('zod');

/**
 * Retorna um middleware que valida req.body contra um schema Zod.
 * Em caso de falha retorna HTTP 422 com os campos inválidos.
 *
 * @param {import('zod').ZodTypeAny} schema
 */
function validar(schema) {
  return (req, res, next) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        return res.status(422).json({
          erro: 'Dados inválidos.',
          detalhes: err.errors.map(e => ({
            campo: e.path.join('.'),
            mensagem: e.message,
          })),
        });
      }
      next(err);
    }
  };
}

module.exports = { validar };
