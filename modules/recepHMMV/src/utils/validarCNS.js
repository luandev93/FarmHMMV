// ============================================================
// utils/validarCNS.js
// Validação do Cartão Nacional de Saúde (CNS) pelo algoritmo
// do Ministério da Saúde (PIS/PASEP e beneficiário).
// ============================================================

'use strict';

/**
 * Valida um CNS de 15 dígitos conforme algoritmo do DATASUS.
 * Aceita CNS de 1ª via (começa com 1 ou 2) e 2ª via (7, 8 ou 9).
 * @param {string} cns
 * @returns {boolean}
 */
function validarCNS(cns) {
  const limpo = String(cns).replace(/\D/g, '');
  if (limpo.length !== 15) return false;

  // CNS começa com 1 ou 2 → algoritmo PIS/PASEP
  if (['1', '2'].includes(limpo[0])) {
    return _validarPisPasep(limpo);
  }

  // CNS começa com 7, 8 ou 9 → algoritmo beneficiário
  if (['7', '8', '9'].includes(limpo[0])) {
    return _validarBeneficiario(limpo);
  }

  return false;
}

function _mod11(seq) {
  let soma = 0;
  for (let i = 0; i < seq.length; i++) {
    soma += parseInt(seq[i], 10) * (seq.length + 1 - i);
  }
  return soma % 11;
}

function _validarPisPasep(cns) {
  const pis = cns.substring(0, 11);
  let dsr    = _mod11(pis);
  let resto  = dsr;

  if (resto !== 0) {
    dsr = 11 - resto;
  }

  let resultado;
  if (dsr === 0) {
    resultado = `${pis}0001`;
  } else if (dsr === 1) {
    resultado = `${pis}0011`;
    const novoResto = _mod11(resultado.substring(0, 15));
    if (novoResto !== 0) return false;
    return cns === resultado;
  } else {
    const dsr2 = String(11 - resto).padStart(2, '0');
    resultado = `${pis}00${dsr2}`;
  }

  return cns === resultado.substring(0, 15);
}

function _validarBeneficiario(cns) {
  let soma = 0;
  for (let i = 0; i < 15; i++) {
    soma += parseInt(cns[i], 10) * (15 - i);
  }
  return soma % 11 === 0;
}

module.exports = { validarCNS };
