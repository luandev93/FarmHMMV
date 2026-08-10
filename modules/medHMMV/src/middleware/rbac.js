// ============================================================
// middleware/rbac.js
// Controle de acesso baseado em função (Role-Based Access Control).
// Usado como middleware adicional após autenticação.
// ============================================================

'use strict';

/**
 * Retorna um middleware que só permite funções listadas em `funcoes`.
 *
 * Exemplo de uso na rota:
 *   router.post('/', autenticar, autorizar(['recepcao', 'adm']), controller)
 */
function autorizar(funcoes = []) {
  return (req, res, next) => {
    if (!req.usuario) {
      return res.status(401).json({ erro: 'Não autenticado.' });
    }
    if (!funcoes.includes(req.usuario.funcao)) {
      return res.status(403).json({
        erro: `Acesso negado. Função '${req.usuario.funcao}' não autorizada para esta operação.`,
      });
    }
    next();
  };
}

module.exports = { autorizar };
