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
  auxiliar: 'Auxiliar',
  enfermagem: 'Enfermagem (solicita pelo app de plantão)'
}

/** Quem opera o estoque. A enfermagem fica de fora: ela só cria solicitações. */
export const FUNCOES_OPERACIONAIS = ['adm', 'farmaceutico', 'auxiliar']

export const SITUACOES_SOLICITACAO = {
  pendente: 'Aguardando a farmácia',
  atendida: 'Atendida',
  parcial: 'Atendida em parte',
  recusada: 'Recusada'
}

export const MOTIVOS_RECUSA = [
  'Item sem saldo na farmácia',
  'Prescrição não localizada',
  'Quantidade acima do necessário',
  'Solicitação duplicada',
  'Dados do paciente incompletos',
  'Outro'
]

export const VERSAO = '1.4'

/**
 * Preço usado para valorar estoque e pedido: apenas o preço de contrato,
 * que é o que a unidade efetivamente paga. O PMVG é teto de venda ao governo
 * e não representa custo, por isso nunca entra em nenhum total.
 */
export function precoDe (item) {
  const v = Number(item?.precoContrato)
  return Number.isFinite(v) && v > 0 ? v : null
}

export const TIPOS_MOVIMENTO = {
  entrada: { nome: 'Entrada', sinal: '+' },
  consumo: { nome: 'Consumo', sinal: '−' },
  descarte: { nome: 'Descarte', sinal: '−' },
  transferencia: { nome: 'Transferência', sinal: '⇄' },
  inventario: { nome: 'Inventário', sinal: '=' },
  saida: { nome: 'Saída', sinal: '−' }
}

/** Ações que um local de estoque pode aceitar. */
export const ACOES_ESTOQUE = {
  entrada: 'Adicionar',
  consumo: 'Consumir',
  transferencia: 'Transferir',
  descarte: 'Descartar'
}

export const ACOES_PADRAO = ['entrada', 'consumo', 'transferencia', 'descarte']

/** Tipos de movimento que retiram saldo do local. */
export const TIPOS_QUE_CONSOMEM = ['consumo', 'descarte', 'saida', 'transferencia']

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

export const MOTIVOS_DESCARTE = [
  'Vencido',
  'Danificado / avariado',
  'Quebra ou derramamento',
  'Falha na cadeia de frio',
  'Recolhimento / recall',
  'Devolução ao fornecedor',
  'Extravio',
  'Outro'
]

export const FINALIDADES_CONSUMO = {
  paciente: 'Dispensação a paciente',
  interno: 'Consumo interno do setor'
}

export const TIPOS_PROFISSIONAL = {
  prescritor: 'Prescritor',
  enfermeiro: 'Enfermeiro',
  tecnico: 'Técnico de enfermagem',
  farmaceutico: 'Farmacêutico',
  outro: 'Outro'
}

export const CONSELHOS = ['CRM', 'COREN', 'CRF', 'CRO', 'CRMV', 'CRN', 'CRP', 'Outro']

export const UFS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG',
  'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
]

/** Formata o CPF conforme a pessoa digita. */
export function mascaraCPF (valor) {
  const d = String(valor || '').replace(/\D/g, '').slice(0, 11)
  if (d.length <= 3) return d
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`
}

/** Verificação dos dígitos do CPF — só avisa, nunca bloqueia o lançamento. */
export function cpfValido (valor) {
  const d = String(valor || '').replace(/\D/g, '')
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false
  const digito = ate => {
    let soma = 0
    for (let i = 0; i < ate; i++) soma += Number(d[i]) * (ate + 1 - i)
    const r = (soma * 10) % 11
    return r === 10 ? 0 : r
  }
  return digito(9) === Number(d[9]) && digito(10) === Number(d[10])
}

export const MOTIVOS_ENTRADA = [
  'Compra / contrato',
  'Doação',
  'Devolução de setor',
  'Empréstimo recebido',
  'Ajuste inicial',
  'Outro'
]
