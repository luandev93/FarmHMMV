/* Utilidades gerais */

export function semAcento (texto) {
  return String(texto || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

export function idAleatorio () {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
}

export function formatarNumero (n) {
  const v = Number(n || 0)
  return Number.isInteger(v) ? String(v) : v.toFixed(2).replace('.', ',')
}

export function formatarMoeda (n) {
  if (n === null || n === undefined || n === '') return '—'
  return Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

/** Data ISO (AAAA-MM-DD) para exibição brasileira. */
export function dataBR (iso) {
  if (!iso) return '—'
  const [a, m, d] = String(iso).slice(0, 10).split('-')
  return `${d}/${m}/${a}`
}

export function hojeISO () {
  const d = new Date()
  const p = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

export function diasAte (iso) {
  if (!iso) return null
  const alvo = new Date(String(iso).slice(0, 10) + 'T12:00:00')
  const hoje = new Date()
  hoje.setHours(12, 0, 0, 0)
  return Math.round((alvo - hoje) / 86400000)
}

export function dataHora (valor) {
  if (!valor) return '—'
  const d = valor.toDate ? valor.toDate() : new Date(valor)
  return d.toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit'
  })
}

/** Dias até o próximo aniversário (0 = hoje). */
export function diasParaAniversario (nascimento) {
  if (!nascimento) return null
  const [, m, d] = String(nascimento).slice(0, 10).split('-').map(Number)
  if (!m || !d) return null
  const hoje = new Date()
  hoje.setHours(12, 0, 0, 0)
  let prox = new Date(hoje.getFullYear(), m - 1, d, 12)
  if (prox < hoje) prox = new Date(hoje.getFullYear() + 1, m - 1, d, 12)
  return Math.round((prox - hoje) / 86400000)
}

export function idade (nascimento) {
  if (!nascimento) return null
  const [a, m, d] = String(nascimento).slice(0, 10).split('-').map(Number)
  const hoje = new Date()
  let anos = hoje.getFullYear() - a
  if (hoje.getMonth() + 1 < m || (hoje.getMonth() + 1 === m && hoje.getDate() < d)) anos--
  return anos
}

export const chaveSaldo = (estoqueId, itemId) => `${estoqueId}__${itemId}`

/** Ordenação por validade — sem validade vai para o fim (consome por último). */
export function ordemFEFO (a, b) {
  const va = a.validade || '9999-12-31'
  const vb = b.validade || '9999-12-31'
  if (va !== vb) return va < vb ? -1 : 1
  return (a.criadoOrdem || 0) - (b.criadoOrdem || 0)
}

export function baixarCSV (nomeArquivo, linhas) {
  const escapar = v => {
    const s = v === null || v === undefined ? '' : String(v)
    return /[";\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s
  }
  const texto = linhas.map(l => l.map(escapar).join(';')).join('\r\n')
  const blob = new Blob(['\ufeff' + texto], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nomeArquivo
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1500)
}

export function vibrar (ms = 12) {
  if (navigator.vibrate) { try { navigator.vibrate(ms) } catch (e) { /* opcional */ } }
}

export const NOMES_FUNCAO = {
  adm: 'Administrador',
  farmaceutico: 'Farmacêutico',
  auxiliar: 'Auxiliar'
}

export const TIPOS_MOVIMENTO = {
  entrada: { nome: 'Entrada', sinal: '+' },
  saida: { nome: 'Saída', sinal: '−' },
  transferencia: { nome: 'Transferência', sinal: '⇄' },
  inventario: { nome: 'Inventário', sinal: '=' }
}

export const CLASSES_CONTROLE = {
  A1: 'A1 — entorpecente (receita amarela)',
  A2: 'A2 — entorpecente de uso permitido',
  A3: 'A3 — psicotrópico (receita amarela)',
  B1: 'B1 — psicotrópico (receita azul)',
  B2: 'B2 — psicotrópico anorexígeno',
  C1: 'C1 — outras substâncias sob controle'
}

export const GRUPOS_ATC = {
  A: 'Aparelho Digestivo e Metabolismo',
  B: 'Sangue e Órgãos Hematopoiéticos',
  C: 'Aparelho Cardiovascular',
  D: 'Medicamentos Dermatológicos',
  H: 'Preparações Hormonais Sistêmicas',
  J: 'Anti-infecciosos para Uso Sistêmico',
  M: 'Sistema Músculo-Esquelético',
  N: 'Sistema Nervoso',
  P: 'Antiparasitários e Repelentes',
  R: 'Aparelho Respiratório',
  V: 'Vários'
}

export const UNIDADES = [
  'AMPOLA', 'BISNAGA', 'BOLSA', 'CAIXA', 'CÁPSULA', 'COMPRIMIDO', 'FRASCO',
  'FRASCO-AMPOLA', 'KIT', 'LITRO', 'METRO', 'PACOTE', 'PAR', 'ROLO', 'SACHÊ',
  'SERINGA', 'TUBO', 'UNIDADE'
]

export const TIPOS_ITEM = {
  MEDICAMENTO: 'Medicamento',
  MATERIAL: 'Material',
  NUTRICAO: 'Nutrição / dieta',
  IMUNOBIOLOGICO: 'Imunobiológico',
  OUTRO: 'Outro'
}

export const MOTIVOS_SAIDA = [
  'Dispensação ao paciente',
  'Atendimento de setor',
  'Perda por vencimento',
  'Perda por avaria',
  'Devolução ao fornecedor',
  'Empréstimo a outra unidade',
  'Outro'
]

export const MOTIVOS_ENTRADA = [
  'Compra / contrato',
  'Doação',
  'Devolução de setor',
  'Empréstimo recebido',
  'Ajuste inicial',
  'Outro'
]
