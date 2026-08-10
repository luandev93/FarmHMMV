// ============================================================
// utils/validarCPF.js
// Validação de CPF conforme algoritmo oficial da Receita Federal.
// ============================================================

'use strict';

/**
 * Remove pontuação e valida o CPF.
 * @param {string} cpf
 * @returns {boolean}
 */
function validarCPF(cpf) {
  const limpo = String(cpf).replace(/\D/g, '');

  if (limpo.length !== 11) return false;
  // Rejeita sequências iguais (ex.: 111.111.111-11)
  if (/^(\d)\1{10}$/.test(limpo)) return false;

  const calc = (limite) => {
    let soma = 0;
    for (let i = 0; i < limite; i++) {
      soma += parseInt(limpo[i], 10) * (limite + 1 - i);
    }
    const resto = (soma * 10) % 11;
    return resto === 10 || resto === 11 ? 0 : resto;
  };

  return calc(9) === parseInt(limpo[9], 10) && calc(10) === parseInt(limpo[10], 10);
}

module.exports = { validarCPF };
