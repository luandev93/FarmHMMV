import {
  collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, addDoc,
  query, where, orderBy, limit, writeBatch, increment, serverTimestamp, Timestamp
} from 'firebase/firestore'
import { db } from '../firebase'
import { chaveSaldo, ordemFEFO, idAleatorio } from './utils'
import catalogoPadrao from '../data/catalogo.json'

/* =========================================================
   Identificadores
   ========================================================= */

const limpo = t => String(t || '').replace(/[/\\.#$[\]\s]+/g, '-').slice(0, 60) || '-'

export const idLote = (estoqueId, itemId, lote, validade) =>
  `${estoqueId}__${itemId}__${limpo(lote || 'sem-lote')}__${validade || 'sem-validade'}`

/* =========================================================
   Auditoria
   ========================================================= */

export async function registrarLog (ctx, acao, detalhe, entidade = '', entidadeId = '') {
  try {
    await addDoc(collection(db, 'logs'), {
      acao,
      detalhe,
      entidade,
      entidadeId,
      usuarioUid: ctx.uid,
      usuarioNome: ctx.nome,
      usuarioFuncao: ctx.funcao,
      criadoEm: serverTimestamp()
    })
  } catch (e) {
    // A auditoria nunca deve impedir a operação principal.
    console.warn('log não gravado', e)
  }
}

/* =========================================================
   Configuração e primeira carga
   ========================================================= */

export const CONFIG_PADRAO = {
  nomeUnidade: 'Farmácia Hospitalar',
  diasCobertura: 30,
  fatorSeguranca: 1.2,
  diasHistoricoConsumo: 90,
  diasAlertaValidade: 90,
  permitirSaldoNegativo: false,
  exigirMotivoSaida: false
}

export async function lerConfig () {
  const s = await getDoc(doc(db, 'config', 'app'))
  return s.exists() ? { ...CONFIG_PADRAO, ...s.data() } : null
}

export async function salvarConfig (dados, ctx) {
  await setDoc(doc(db, 'config', 'app'), { ...dados, atualizadoEm: serverTimestamp() }, { merge: true })
  if (ctx) await registrarLog(ctx, 'configuracao', 'Configurações gerais alteradas', 'config', 'app')
}

const ESTOQUES_INICIAIS = [
  { nome: 'Farmácia Central', descricao: 'Estoque principal da unidade', ordem: 1 },
  { nome: 'Emergência', descricao: 'Posto de enfermagem da emergência', ordem: 2 },
  { nome: 'Enfermaria', descricao: 'Carrinho e armário da enfermaria', ordem: 3 },
  { nome: 'Centro Cirúrgico', descricao: 'Sala e carro de anestesia', ordem: 4 }
]

/** Carga inicial: catálogo padronizado + locais de estoque sugeridos. Saldos ficam zerados. */
export async function semear (ctx, { comEstoques = true, comCatalogo = true } = {}) {
  let itensCriados = 0

  if (comCatalogo) {
    const existentes = await getDocs(collection(db, 'itens'))
    const codigos = new Set(existentes.docs.map(d => d.data().codigo))
    let lote = writeBatch(db)
    let n = 0
    for (const item of catalogoPadrao) {
      if (codigos.has(item.codigo)) continue
      lote.set(doc(collection(db, 'itens')), {
        ...item,
        criadoEm: serverTimestamp(),
        criadoPor: ctx.nome
      })
      itensCriados++
      if (++n >= 400) { await lote.commit(); lote = writeBatch(db); n = 0 }
    }
    if (n > 0) await lote.commit()
  }

  if (comEstoques) {
    const atuais = await getDocs(collection(db, 'estoques'))
    if (atuais.empty) {
      const lote = writeBatch(db)
      ESTOQUES_INICIAIS.forEach(e => {
        lote.set(doc(collection(db, 'estoques')), { ...e, ativo: true, criadoEm: serverTimestamp() })
      })
      await lote.commit()
    }
  }

  await setDoc(doc(db, 'config', 'app'), { catalogoCarregado: true }, { merge: true })
  await registrarLog(ctx, 'carga-inicial', `Catálogo padrão carregado (${itensCriados} itens)`)
  return itensCriados
}

/* =========================================================
   Catálogo de itens
   ========================================================= */

export async function salvarItem (dados, ctx, id = null) {
  const corpo = {
    ...dados,
    descricao: String(dados.descricao || '').trim(),
    estoqueMinimo: Number(dados.estoqueMinimo) || 0,
    atualizadoEm: serverTimestamp()
  }
  if (id) {
    await updateDoc(doc(db, 'itens', id), corpo)
    await registrarLog(ctx, 'item-editado', corpo.descricao, 'itens', id)
    return id
  }
  const ref = await addDoc(collection(db, 'itens'), { ...corpo, criadoEm: serverTimestamp() })
  await registrarLog(ctx, 'item-criado', corpo.descricao, 'itens', ref.id)
  return ref.id
}

export async function excluirItem (item, ctx) {
  const comSaldo = await getDocs(query(collection(db, 'lotes'), where('itemId', '==', item.id), where('qtd', '>', 0)))
  if (!comSaldo.empty) {
    throw new Error('Este item ainda tem saldo em estoque. Zere o saldo antes de excluir, ou desative o item.')
  }
  await deleteDoc(doc(db, 'itens', item.id))
  await registrarLog(ctx, 'item-excluido', item.descricao, 'itens', item.id)
}

/* =========================================================
   Locais de estoque
   ========================================================= */

export async function salvarEstoque (dados, ctx, id = null) {
  const corpo = { ...dados, ordem: Number(dados.ordem) || 99, atualizadoEm: serverTimestamp() }
  if (id) {
    await updateDoc(doc(db, 'estoques', id), corpo)
    await registrarLog(ctx, 'estoque-editado', corpo.nome, 'estoques', id)
    return id
  }
  const ref = await addDoc(collection(db, 'estoques'), { ...corpo, criadoEm: serverTimestamp() })
  await registrarLog(ctx, 'estoque-criado', corpo.nome, 'estoques', ref.id)
  return ref.id
}

export async function excluirEstoque (estoque, ctx) {
  const comSaldo = await getDocs(
    query(collection(db, 'lotes'), where('estoqueId', '==', estoque.id), where('qtd', '>', 0))
  )
  if (!comSaldo.empty) throw new Error('Este local ainda tem itens com saldo. Transfira ou zere antes de excluir.')
  await deleteDoc(doc(db, 'estoques', estoque.id))
  await registrarLog(ctx, 'estoque-excluido', estoque.nome, 'estoques', estoque.id)
}

/* =========================================================
   Lotes e alocação PVPS (primeiro que vence, primeiro que sai)
   ========================================================= */

async function lotesDisponiveis (estoqueId) {
  const snap = await getDocs(
    query(collection(db, 'lotes'), where('estoqueId', '==', estoqueId), where('qtd', '>', 0))
  )
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

/** Distribui a quantidade entre os lotes disponíveis, do que vence primeiro para o último. */
export function alocarPVPS (lotes, itemId, quantidade, loteEscolhido = null) {
  const candidatos = lotes
    .filter(l => {
      if (l.itemId !== itemId || l.qtd <= 0) return false
      // No descarte de um lote específico, só aquele lote é consumido.
      if (loteEscolhido) {
        return (l.lote || '') === (loteEscolhido.lote || '') &&
               (l.validade || null) === (loteEscolhido.validade || null)
      }
      return true
    })
    .sort(ordemFEFO)

  const alocacoes = []
  let restante = quantidade

  for (const lote of candidatos) {
    if (restante <= 0) break
    const usar = Math.min(lote.qtd, restante)
    alocacoes.push({ lote, usar })
    restante -= usar
  }
  return { alocacoes, restante }
}

/* =========================================================
   Gravação dos lançamentos (entrada / saída / transferência)
   ========================================================= */

/**
 * @param {Array} linhas  itens do rascunho
 * @param {Object} ctx    { uid, nome, funcao }
 * @param {Object} opcoes { permitirNegativo }
 */
export async function salvarLancamentos (linhas, ctx, opcoes = {}) {
  if (!linhas.length) throw new Error('Não há lançamentos para salvar.')

  // Lotes atuais de cada local envolvido, lidos do servidor no momento de salvar.
  const locais = [...new Set(linhas.flatMap(l => [l.estoqueId, l.estoqueDestinoId].filter(Boolean)))]
  const porLocal = {}
  for (const id of locais) porLocal[id] = await lotesDisponiveis(id)

  const operacoes = []
  const carimbo = serverTimestamp()
  const grupo = idAleatorio()

  for (const linha of linhas) {
    const qtd = Number(linha.qtd)
    if (!(qtd > 0)) throw new Error(`Quantidade inválida em "${linha.itemDescricao}".`)

    const comum = {
      grupo,
      itemId: linha.itemId,
      itemCodigo: linha.itemCodigo,
      itemDescricao: linha.itemDescricao,
      itemUnidade: linha.itemUnidade,
      itemTipo: linha.itemTipo || '',
      itemGrupoATC: linha.itemGrupoATC || '',
      itemGrupoFarmacologico: linha.itemGrupoFarmacologico || '',
      itemControlado: linha.itemControlado || '',
      qtd,
      motivo: linha.motivo || '',
      observacao: linha.observacao || '',
      finalidade: linha.finalidade || '',
      pacienteNome: linha.pacienteNome || '',
      pacienteCPF: linha.pacienteCPF || '',
      prescritorNome: linha.prescritorNome || '',
      prescritorConselho: linha.prescritorConselho || '',
      responsavelNome: linha.responsavelNome || '',
      responsavelConselho: linha.responsavelConselho || '',
      destinoInterno: linha.destinoInterno || '',
      usuarioUid: ctx.uid,
      usuarioNome: ctx.nome,
      usuarioFuncao: ctx.funcao,
      criadoEm: carimbo
    }

    /* ---------- ENTRADA ---------- */
    if (linha.tipo === 'entrada') {
      const ref = idLote(linha.estoqueId, linha.itemId, linha.lote, linha.validade)
      operacoes.push({
        tipo: 'set',
        ref: doc(db, 'lotes', ref),
        dados: {
          estoqueId: linha.estoqueId,
          itemId: linha.itemId,
          itemDescricao: linha.itemDescricao,
          lote: linha.lote || '',
          validade: linha.validade || null,
          qtd: increment(qtd),
          atualizadoEm: carimbo
        },
        merge: true
      })
      operacoes.push(opSaldo(linha.estoqueId, linha.itemId, qtd, carimbo))
      operacoes.push({
        tipo: 'add',
        ref: collection(db, 'movimentos'),
        dados: {
          ...comum,
          tipo: 'entrada',
          estoqueId: linha.estoqueId,
          estoqueNome: linha.estoqueNome,
          lote: linha.lote || '',
          validade: linha.validade || null
        }
      })
      aplicarNaMemoria(porLocal[linha.estoqueId], ref, linha, qtd)
      continue
    }

    /* ---------- SAÍDA e TRANSFERÊNCIA (consomem por PVPS) ---------- */
    const origem = porLocal[linha.estoqueId] || []
    const { alocacoes, restante } = alocarPVPS(
      origem, linha.itemId, qtd,
      linha.loteEscolhido || null
    )

    if (restante > 0 && !opcoes.permitirNegativo) {
      const disponivel = qtd - restante
      throw new Error(
        `Saldo insuficiente de "${linha.itemDescricao}" em ${linha.estoqueNome}` +
        (linha.loteEscolhido ? ` no lote ${linha.loteEscolhido.lote || 'sem lote'}` : '') +
        `: há ${disponivel} e o lançamento pede ${qtd}.`
      )
    }

    // Quando se permite negativo, o excedente sai de um lote sem identificação.
    if (restante > 0) {
      const ref = idLote(linha.estoqueId, linha.itemId, '', null)
      alocacoes.push({
        lote: { id: ref, lote: '', validade: null, qtd: 0, itemId: linha.itemId, estoqueId: linha.estoqueId },
        usar: restante
      })
    }

    for (const { lote, usar } of alocacoes) {
      operacoes.push({
        tipo: 'set',
        ref: doc(db, 'lotes', lote.id),
        dados: {
          estoqueId: linha.estoqueId,
          itemId: linha.itemId,
          itemDescricao: linha.itemDescricao,
          lote: lote.lote || '',
          validade: lote.validade || null,
          qtd: increment(-usar),
          atualizadoEm: carimbo
        },
        merge: true
      })
      lote.qtd -= usar

      if (linha.tipo === 'transferencia') {
        const destino = idLote(linha.estoqueDestinoId, linha.itemId, lote.lote, lote.validade)
        operacoes.push({
          tipo: 'set',
          ref: doc(db, 'lotes', destino),
          dados: {
            estoqueId: linha.estoqueDestinoId,
            itemId: linha.itemId,
            itemDescricao: linha.itemDescricao,
            lote: lote.lote || '',
            validade: lote.validade || null,
            qtd: increment(usar),
            atualizadoEm: carimbo
          },
          merge: true
        })
        aplicarNaMemoria(porLocal[linha.estoqueDestinoId], destino, { ...linha, lote: lote.lote, validade: lote.validade }, usar)
      }
    }

    const detalheLotes = alocacoes
      .map(a => `${a.lote.lote || 'sem lote'}${a.lote.validade ? ' · ' + a.lote.validade : ''}: ${a.usar}`)
      .join(' | ')

    operacoes.push(opSaldo(linha.estoqueId, linha.itemId, -qtd, carimbo))

    if (linha.tipo === 'transferencia') {
      operacoes.push(opSaldo(linha.estoqueDestinoId, linha.itemId, qtd, carimbo))
      operacoes.push({
        tipo: 'add',
        ref: collection(db, 'movimentos'),
        dados: {
          ...comum,
          tipo: 'transferencia',
          estoqueId: linha.estoqueId,
          estoqueNome: linha.estoqueNome,
          estoqueDestinoId: linha.estoqueDestinoId,
          estoqueDestinoNome: linha.estoqueDestinoNome,
          lotesUsados: detalheLotes
        }
      })
    } else {
      operacoes.push({
        tipo: 'add',
        ref: collection(db, 'movimentos'),
        dados: {
          ...comum,
          tipo: linha.tipo,
          estoqueId: linha.estoqueId,
          estoqueNome: linha.estoqueNome,
          lotesUsados: detalheLotes
        }
      })
    }
  }

  await gravarEmBlocos(operacoes)
  await registrarLog(
    ctx,
    'movimentacao',
    `${linhas.length} lançamento(s) salvos: ` +
      linhas.map(l => `${l.tipo} ${l.qtd} × ${l.itemDescricao}`).join('; ').slice(0, 900)
  )
  return linhas.length
}

function opSaldo (estoqueId, itemId, delta, carimbo) {
  return {
    tipo: 'set',
    ref: doc(db, 'saldos', chaveSaldo(estoqueId, itemId)),
    dados: { estoqueId, itemId, qtd: increment(delta), atualizadoEm: carimbo },
    merge: true
  }
}

/* Mantém a lista em memória coerente quando o mesmo item aparece em várias linhas. */
function aplicarNaMemoria (lista, refId, linha, qtd) {
  if (!lista) return
  const achado = lista.find(l => l.id === refId)
  if (achado) achado.qtd += qtd
  else lista.push({
    id: refId,
    estoqueId: linha.estoqueId,
    itemId: linha.itemId,
    lote: linha.lote || '',
    validade: linha.validade || null,
    qtd
  })
}

async function gravarEmBlocos (operacoes) {
  const TAMANHO = 400
  for (let i = 0; i < operacoes.length; i += TAMANHO) {
    const bloco = writeBatch(db)
    for (const op of operacoes.slice(i, i + TAMANHO)) {
      if (op.tipo === 'add') bloco.set(doc(op.ref), op.dados)
      else if (op.merge) bloco.set(op.ref, op.dados, { merge: true })
      else bloco.set(op.ref, op.dados)
    }
    await bloco.commit()
  }
}

/* =========================================================
   Inventário — sobrescreve o saldo do item
   ========================================================= */

export async function salvarInventario (linhas, ctx) {
  if (!linhas.length) throw new Error('Não há contagens para salvar.')

  const locais = [...new Set(linhas.map(l => l.estoqueId))]
  const porLocal = {}
  for (const id of locais) {
    const snap = await getDocs(query(collection(db, 'lotes'), where('estoqueId', '==', id)))
    porLocal[id] = snap.docs.map(d => ({ id: d.id, ...d.data() }))
  }

  const operacoes = []
  const carimbo = serverTimestamp()
  const grupo = idAleatorio()

  for (const linha of linhas) {
    const contagem = Number(linha.qtd)
    if (!(contagem >= 0)) throw new Error(`Contagem inválida em "${linha.itemDescricao}".`)

    const lotesItem = (porLocal[linha.estoqueId] || []).filter(l => l.itemId === linha.itemId)
    const anterior = lotesItem.reduce((s, l) => s + (l.qtd || 0), 0)

    if (linha.lote || linha.validade) {
      // Contagem de um lote específico: só aquele lote é reescrito.
      const ref = idLote(linha.estoqueId, linha.itemId, linha.lote, linha.validade)
      const atual = lotesItem.find(l => l.id === ref)?.qtd || 0
      operacoes.push({
        tipo: 'set',
        ref: doc(db, 'lotes', ref),
        dados: {
          estoqueId: linha.estoqueId,
          itemId: linha.itemId,
          itemDescricao: linha.itemDescricao,
          lote: linha.lote || '',
          validade: linha.validade || null,
          qtd: contagem,
          atualizadoEm: carimbo
        },
        merge: true
      })
      operacoes.push(opSaldo(linha.estoqueId, linha.itemId, contagem - atual, carimbo))
    } else {
      // Contagem do item inteiro: os lotes anteriores são zerados e o total vira um lote único.
      for (const l of lotesItem) {
        if (l.qtd === 0) continue
        operacoes.push({
          tipo: 'set',
          ref: doc(db, 'lotes', l.id),
          dados: { qtd: 0, atualizadoEm: carimbo },
          merge: true
        })
      }
      const ref = idLote(linha.estoqueId, linha.itemId, '', null)
      operacoes.push({
        tipo: 'set',
        ref: doc(db, 'lotes', ref),
        dados: {
          estoqueId: linha.estoqueId,
          itemId: linha.itemId,
          itemDescricao: linha.itemDescricao,
          lote: '',
          validade: null,
          qtd: contagem,
          atualizadoEm: carimbo
        },
        merge: true
      })
      operacoes.push({
        tipo: 'set',
        ref: doc(db, 'saldos', chaveSaldo(linha.estoqueId, linha.itemId)),
        dados: {
          estoqueId: linha.estoqueId,
          itemId: linha.itemId,
          qtd: contagem,
          atualizadoEm: carimbo
        },
        merge: true
      })
    }

    operacoes.push({
      tipo: 'add',
      ref: collection(db, 'movimentos'),
      dados: {
        grupo,
        tipo: 'inventario',
        itemId: linha.itemId,
        itemCodigo: linha.itemCodigo,
        itemDescricao: linha.itemDescricao,
        itemUnidade: linha.itemUnidade,
        itemTipo: linha.itemTipo || '',
        itemGrupoATC: linha.itemGrupoATC || '',
        itemGrupoFarmacologico: linha.itemGrupoFarmacologico || '',
        itemControlado: linha.itemControlado || '',
        estoqueId: linha.estoqueId,
        estoqueNome: linha.estoqueNome,
        lote: linha.lote || '',
        validade: linha.validade || null,
        qtd: contagem,
        saldoAnterior: anterior,
        diferenca: contagem - anterior,
        motivo: linha.motivo || 'Contagem de inventário',
        observacao: linha.observacao || '',
        usuarioUid: ctx.uid,
        usuarioNome: ctx.nome,
        usuarioFuncao: ctx.funcao,
        criadoEm: carimbo
      }
    })
  }

  await gravarEmBlocos(operacoes)
  await registrarLog(ctx, 'inventario', `${linhas.length} item(ns) contados e sobrescritos`)
  return linhas.length
}

/* =========================================================
   Consultas
   ========================================================= */

export async function movimentosRecentes (filtros = {}) {
  const partes = [collection(db, 'movimentos')]
  const restricoes = []
  if (filtros.tipo) restricoes.push(where('tipo', '==', filtros.tipo))
  if (filtros.estoqueId) restricoes.push(where('estoqueId', '==', filtros.estoqueId))
  if (filtros.itemId) restricoes.push(where('itemId', '==', filtros.itemId))
  if (filtros.desde) restricoes.push(where('criadoEm', '>=', Timestamp.fromDate(filtros.desde)))
  const consulta = query(...partes, ...restricoes, orderBy('criadoEm', 'desc'), limit(filtros.limite || 300))
  const snap = await getDocs(consulta)
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

/** Consumo diário médio por item, a partir das saídas do período. */
export async function consumoPorItem (dias, { incluirDescarte = false } = {}) {
  const desde = new Date(Date.now() - dias * 86400000)
  const tipos = incluirDescarte ? ['consumo', 'saida', 'descarte'] : ['consumo', 'saida']
  const snap = await getDocs(query(
    collection(db, 'movimentos'),
    where('tipo', 'in', tipos),
    where('criadoEm', '>=', Timestamp.fromDate(desde)),
    orderBy('criadoEm', 'desc'),
    limit(4000)
  ))
  const total = {}
  snap.docs.forEach(d => {
    const m = d.data()
    total[m.itemId] = (total[m.itemId] || 0) + (m.qtd || 0)
  })
  const media = {}
  Object.entries(total).forEach(([id, soma]) => { media[id] = { total: soma, diario: soma / dias } })
  return media
}

export async function lerLogs (limite = 300) {
  const snap = await getDocs(query(collection(db, 'logs'), orderBy('criadoEm', 'desc'), limit(limite)))
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

/* =========================================================
   Usuários
   ========================================================= */

export async function salvarPerfilUsuario (uid, dados, ctx) {
  await setDoc(doc(db, 'usuarios', uid), { ...dados, atualizadoEm: serverTimestamp() }, { merge: true })
  if (ctx) await registrarLog(ctx, 'usuario-editado', `${dados.nome || uid}`, 'usuarios', uid)
}

export async function excluirPerfilUsuario (usuario, ctx) {
  await deleteDoc(doc(db, 'usuarios', usuario.id))
  await registrarLog(
    ctx,
    'usuario-removido',
    `${usuario.nome} — o acesso foi revogado. A conta de login precisa ser apagada no Console do Firebase.`,
    'usuarios',
    usuario.id
  )
}

/* =========================================================
   Profissionais — lista de referência para o preenchimento
   ========================================================= */

export async function salvarProfissional (dados, ctx, id = null) {
  const corpo = {
    ...dados,
    nome: String(dados.nome || '').trim(),
    numero: String(dados.numero || '').trim(),
    atualizadoEm: serverTimestamp()
  }
  if (id) {
    await updateDoc(doc(db, 'profissionais', id), corpo)
    await registrarLog(ctx, 'profissional-editado', corpo.nome, 'profissionais', id)
    return id
  }
  const ref = await addDoc(collection(db, 'profissionais'), { ...corpo, criadoEm: serverTimestamp() })
  await registrarLog(ctx, 'profissional-criado', corpo.nome, 'profissionais', ref.id)
  return ref.id
}

export async function excluirProfissional (profissional, ctx) {
  await deleteDoc(doc(db, 'profissionais', profissional.id))
  await registrarLog(ctx, 'profissional-excluido', profissional.nome, 'profissionais', profissional.id)
}

/* =========================================================
   Importação de catálogo por planilha
   ========================================================= */

const SEM_ACENTO = t => String(t || '')
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .toLowerCase().replace(/\s+/g, ' ').trim()

/** Nomes de coluna aceitos, para a planilha não precisar de formato exato. */
const COLUNAS = {
  codigo: ['codigo', 'cod', 'codigo do item'],
  descricao: ['descricao', 'descricao do catalogo', 'item do catalogo', 'nome'],
  precoContrato: ['preco de contrato', 'preco contrato', 'precocontrato', 'preco unitario', 'preco'],
  marca: ['marca', 'marca / fabricante', 'fabricante'],
  fornecedor: ['fornecedor'],
  contrato: ['contrato'],
  codigoContrato: ['item no contrato', 'item do contrato', 'codigo contrato'],
  estoqueMinimo: ['estoque minimo', 'minimo'],
  unidade: ['unidade', 'unidade de contagem'],
  tipo: ['tipo'],
  principioAtivo: ['principio ativo', 'principio ativo (dcb)', 'dcb'],
  concentracao: ['concentracao'],
  formaFarmaceutica: ['forma', 'forma farmaceutica'],
  grupoFarmacologico: ['grupo farmacologico'],
  grupoATC: ['grupo atc'],
  controlado: ['controle', 'controlado', 'controle especial']
}

const NUMERICOS = ['precoContrato', 'estoqueMinimo']

/** Lê texto CSV com separador ; ou , respeitando aspas. */
export function lerCSV (texto) {
  const limpo = texto.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n')
  const separador = (limpo.split('\n')[0].match(/;/g) || []).length >=
                    (limpo.split('\n')[0].match(/,/g) || []).length ? ';' : ','
  const linhas = []
  let campo = ''
  let linha = []
  let dentroDeAspas = false

  for (let i = 0; i < limpo.length; i++) {
    const c = limpo[i]
    if (dentroDeAspas) {
      if (c === '"') {
        if (limpo[i + 1] === '"') { campo += '"'; i++ } else dentroDeAspas = false
      } else campo += c
      continue
    }
    if (c === '"') { dentroDeAspas = true; continue }
    if (c === separador) { linha.push(campo); campo = ''; continue }
    if (c === '\n') { linha.push(campo); linhas.push(linha); linha = []; campo = ''; continue }
    campo += c
  }
  linha.push(campo)
  if (linha.some(v => v.trim())) linhas.push(linha)
  return linhas
}

/** Converte a planilha em alterações prontas, sem gravar nada ainda. */
export function prepararImportacao (linhas, itens) {
  if (!linhas.length) throw new Error('A planilha está vazia.')

  const cabecalho = linhas[0].map(SEM_ACENTO)
  const mapa = {}
  Object.entries(COLUNAS).forEach(([campo, nomes]) => {
    const pos = cabecalho.findIndex(h => nomes.includes(h))
    if (pos >= 0) mapa[campo] = pos
  })

  if (mapa.codigo === undefined) {
    throw new Error('A planilha precisa de uma coluna "Código" para identificar o item.')
  }

  const porCodigo = {}
  itens.forEach(i => { porCodigo[SEM_ACENTO(i.codigo)] = i })

  const atualizacoes = []
  const novos = []
  const ignoradas = []

  for (let n = 1; n < linhas.length; n++) {
    const linha = linhas[n]
    const codigo = String(linha[mapa.codigo] || '').trim()
    if (!codigo) continue

    const valores = {}
    Object.entries(mapa).forEach(([campo, pos]) => {
      if (campo === 'codigo') return
      let v = String(linha[pos] ?? '').trim()
      if (v === '') return
      if (NUMERICOS.includes(campo)) {
        const numero = Number(v.replace(/\./g, '').replace(',', '.'))
        if (!Number.isFinite(numero)) return
        v = numero
      }
      valores[campo] = v
    })

    const existente = porCodigo[SEM_ACENTO(codigo)]

    if (!existente) {
      if (valores.descricao) novos.push({ linha: n + 1, codigo, valores })
      else ignoradas.push({ linha: n + 1, codigo, motivo: 'código não existe e não há descrição para criar' })
      continue
    }

    // Só entra na lista o que realmente muda.
    const mudancas = {}
    Object.entries(valores).forEach(([campo, v]) => {
      const atual = existente[campo]
      const igual = NUMERICOS.includes(campo)
        ? Number(atual || 0) === Number(v)
        : String(atual || '') === String(v)
      if (!igual) mudancas[campo] = v
    })

    if (Object.keys(mudancas).length) {
      atualizacoes.push({ linha: n + 1, item: existente, mudancas })
    } else {
      ignoradas.push({ linha: n + 1, codigo, motivo: 'nada a alterar' })
    }
  }

  return { atualizacoes, novos, ignoradas, colunas: Object.keys(mapa) }
}

/** Grava as alterações preparadas. */
export async function aplicarImportacao ({ atualizacoes, novos }, ctx, { criarNovos = false } = {}) {
  let lote = writeBatch(db)
  let n = 0
  const comitar = async () => { if (n) { await lote.commit(); lote = writeBatch(db); n = 0 } }

  for (const a of atualizacoes) {
    lote.set(doc(db, 'itens', a.item.id), { ...a.mudancas, atualizadoEm: serverTimestamp() }, { merge: true })
    if (++n >= 400) await comitar()
  }

  let criados = 0
  if (criarNovos) {
    for (const item of novos) {
      lote.set(doc(collection(db, 'itens')), {
        codigo: item.codigo,
        tipo: 'MEDICAMENTO',
        unidade: 'UNIDADE',
        estoqueMinimo: 0,
        controlaLote: true,
        ativo: true,
        ...item.valores,
        criadoEm: serverTimestamp(),
        criadoPor: ctx.nome
      })
      criados++
      if (++n >= 400) await comitar()
    }
  }
  await comitar()

  await registrarLog(
    ctx, 'importacao-catalogo',
    `${atualizacoes.length} item(ns) atualizados e ${criados} criado(s) por planilha`
  )
  return { atualizados: atualizacoes.length, criados }
}
