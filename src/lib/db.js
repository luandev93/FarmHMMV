import {
  collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, addDoc,
  query, where, orderBy, limit, writeBatch, increment, serverTimestamp, Timestamp, onSnapshot
} from 'firebase/firestore'
import { db } from '../firebase'
import { chaveSaldo, ordemFEFO, idAleatorio, semIndefinidos } from './utils'
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
  const ehAdm = ctx.funcao === 'adm'
  const corpo = {
    ...dados,
    descricao: String(dados.descricao || '').trim(),
    estoqueMinimo: Number(dados.estoqueMinimo) || 0,
    atualizadoEm: serverTimestamp()
  }

  if (id) {
    if (!ehAdm) throw new Error('Só o administrador altera o cadastro de um item já existente.')
    await updateDoc(doc(db, 'itens', id), corpo)
    await espelharItem(id, { ...dados, ...corpo })
    await registrarLog(ctx, 'item-editado', corpo.descricao, 'itens', id)
    return id
  }

  // Item proposto por quem não é administrador espera aprovação antes de circular.
  const pendente = !ehAdm
  const ref = await addDoc(collection(db, 'itens'), {
    ...corpo,
    pendente,
    propostoPor: pendente ? ctx.nome : '',
    propostoEm: pendente ? serverTimestamp() : null,
    criadoEm: serverTimestamp()
  })
  if (!pendente) await espelharItem(ref.id, corpo)
  await registrarLog(
    ctx,
    pendente ? 'item-proposto' : 'item-criado',
    corpo.descricao, 'itens', ref.id
  )
  return ref.id
}

/** O administrador libera o item proposto para uso. */
export async function aprovarItem (item, ctx) {
  await updateDoc(doc(db, 'itens', item.id), {
    pendente: false,
    aprovadoPor: ctx.nome,
    aprovadoEm: serverTimestamp()
  })
  await espelharItem(item.id, { ...item, pendente: false })
  await registrarLog(
    ctx, 'item-aprovado',
    `${item.descricao} — proposto por ${item.propostoPor || 'não informado'}`,
    'itens', item.id
  )
}

/** Descarte da proposta: item duplicado ou cadastrado por engano. */
export async function descartarProposta (item, ctx, motivo) {
  await deleteDoc(doc(db, 'itens', item.id))
  await registrarLog(
    ctx, 'item-descartado',
    `${item.descricao} — proposto por ${item.propostoPor || 'não informado'} · ${motivo || 'sem motivo'}`,
    'itens', item.id
  )
}

/** Itens que tiveram alguma movimentação no período, para achar os parados. */
export async function itensComMovimento (dias = 90) {
  const desde = new Date(Date.now() - dias * 86400000)
  const snap = await getDocs(query(
    collection(db, 'movimentos'),
    where('criadoEm', '>=', Timestamp.fromDate(desde)),
    orderBy('criadoEm', 'desc'),
    limit(4000)
  ))
  const mapa = {}
  snap.docs.forEach(d => {
    const m = d.data()
    const q = m.criadoEm?.toMillis ? m.criadoEm.toMillis() : 0
    if (!mapa[m.itemId] || q > mapa[m.itemId]) mapa[m.itemId] = q
  })
  return mapa
}

export async function excluirItem (item, ctx) {
  const comSaldo = await getDocs(query(collection(db, 'lotes'), where('itemId', '==', item.id), where('qtd', '>', 0)))
  if (!comSaldo.empty) {
    throw new Error('Este item ainda tem saldo em estoque. Zere o saldo antes de excluir, ou desative o item.')
  }
  await deleteDoc(doc(db, 'itens', item.id))
  try { await deleteDoc(doc(db, 'catalogoPublico', item.id)) } catch (e) { /* já não existia */ }
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

  // Estorno não pode devolver mais do que a saída original, nem repetir.
  const comEstorno = linhas.filter(l => l.estornoDe)
  if (comEstorno.length) {
    const jaEstornado = await estornosPorMovimento()
    for (const l of comEstorno) {
      const original = await getDoc(doc(db, 'movimentos', l.estornoDe))
      if (!original.exists()) throw new Error('A movimentação que você quer estornar não existe mais.')
      const saiu = original.data().qtd || 0
      const restante = saiu - (jaEstornado[l.estornoDe] || 0)
      if (Number(l.qtd) > restante) {
        throw new Error(
          restante <= 0
            ? `"${l.itemDescricao}" já foi estornado por completo.`
            : `Só restam ${restante} para estornar de "${l.itemDescricao}".`
        )
      }
    }
  }

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
      reverteMovimento: linha.reverteMovimento || '',
      usuarioUid: ctx.uid,
      usuarioNome: ctx.nome,
      usuarioFuncao: ctx.funcao,
      criadoEm: carimbo
    }

    /* ---------- ENTRADA e DEVOLUÇÃO ---------- */
    if (linha.tipo === 'entrada' || linha.tipo === 'devolucao') {
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
          tipo: linha.tipo,
          estoqueId: linha.estoqueId,
          estoqueNome: linha.estoqueNome,
          lote: linha.lote || '',
          validade: linha.validade || null,
          // Quando é estorno, guarda a qual movimentação se refere.
          estornoDe: linha.estornoDe || ''
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
      const dados = semIndefinidos(op.dados)
      if (op.tipo === 'add') bloco.set(doc(op.ref), dados)
      else if (op.merge) bloco.set(op.ref, dados, { merge: true })
      else bloco.set(op.ref, dados)
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

  // O que voltou por devolução não foi consumido de fato.
  const devolvido = await getDocs(query(
    collection(db, 'movimentos'),
    where('tipo', '==', 'devolucao'),
    where('criadoEm', '>=', Timestamp.fromDate(desde)),
    orderBy('criadoEm', 'desc'),
    limit(2000)
  ))
  devolvido.docs.forEach(d => {
    const m = d.data()
    if (total[m.itemId]) total[m.itemId] = Math.max(0, total[m.itemId] - (m.qtd || 0))
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
  controlado: ['controle', 'controlado', 'controle especial'],
  ativo: ['ativo', 'item ativo']
}

/** Colunas que chegam como "sim"/"não" e viram verdadeiro ou falso. */
const BOOLEANOS = ['ativo']

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
      if (BOOLEANOS.includes(campo)) {
        const t = SEM_ACENTO(v)
        v = ['sim', 'true', '1', 'x', 'verdadeiro'].includes(t)
      } else if (NUMERICOS.includes(campo)) {
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
      const igual = BOOLEANOS.includes(campo)
        ? Boolean(atual !== false) === Boolean(v)
        : NUMERICOS.includes(campo)
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

/* =========================================================
   Catálogo público — o que a enfermagem enxerga
   ========================================================= */

/** Só o essencial para escolher o item. Nunca preço, nunca saldo. */
const enxugar = item => ({
  pendente: false,
  codigo: item.codigo || '',
  descricao: item.descricao || '',
  unidade: item.unidade || 'UNIDADE',
  tipo: item.tipo || '',
  principioAtivo: item.principioAtivo || '',
  controlado: item.controlado || '',
  exigePaciente: Boolean(item.exigePaciente),
  consumoInterno: Boolean(item.consumoInterno),
  ativo: item.ativo !== false
})

/** Reescreve o espelho inteiro a partir do catálogo. */
export async function sincronizarCatalogoPublico (ctx) {
  const [itens, espelho] = await Promise.all([
    getDocs(collection(db, 'itens')),
    getDocs(collection(db, 'catalogoPublico'))
  ])

  const atuais = new Set(itens.docs.map(d => d.id))
  let lote = writeBatch(db)
  let n = 0
  const comitar = async () => { if (n) { await lote.commit(); lote = writeBatch(db); n = 0 } }

  for (const d of itens.docs) {
    // Item pendente de aprovação não é oferecido à enfermagem.
    if (d.data().pendente) { atuais.delete(d.id); continue }
    lote.set(doc(db, 'catalogoPublico', d.id), { ...enxugar(d.data()), atualizadoEm: serverTimestamp() })
    if (++n >= 400) await comitar()
  }
  // remove do espelho o que saiu do catálogo
  for (const d of espelho.docs) {
    if (atuais.has(d.id)) continue
    lote.delete(doc(db, 'catalogoPublico', d.id))
    if (++n >= 400) await comitar()
  }
  await comitar()

  if (ctx) await registrarLog(ctx, 'catalogo-publico', `Espelho sincronizado com ${itens.size} itens`)
  return itens.size
}

/** Mantém uma linha do espelho em dia, chamada junto com o salvamento do item. */
export async function espelharItem (id, dados) {
  try {
    await setDoc(doc(db, 'catalogoPublico', id), { ...enxugar(dados), atualizadoEm: serverTimestamp() }, { merge: true })
  } catch (e) {
    console.warn('espelho não atualizado', e)
  }
}

/* =========================================================
   Solicitações da enfermagem
   ========================================================= */

export function assinarSolicitacoes (aoReceber, aoFalhar) {
  return onSnapshot(
    query(collection(db, 'solicitacoes'), orderBy('criadoEm', 'desc'), limit(300)),
    s => aoReceber(s.docs.map(d => ({ id: d.id, ...d.data() }))),
    e => aoFalhar && aoFalhar(e)
  )
}

/**
 * Atende a solicitação: baixa o estoque da farmácia de dispensação e
 * carimba quem pediu e quem liberou. Quantidade zero significa item não atendido.
 */
export async function atenderSolicitacao (solicitacao, linhasAtendidas, ctx, opcoes = {}) {
  const estoqueId = opcoes.estoqueId
  if (!estoqueId) throw new Error('Defina a farmácia de dispensação em Configurações antes de atender.')

  const aBaixar = linhasAtendidas.filter(l => Number(l.qtdAtendida) > 0)
  if (!aBaixar.length) throw new Error('Nenhuma quantidade foi liberada. Use "Recusar" se for o caso.')

  // Controlado exige paciente e prescritor identificados, mesmo que o pedido tenha vindo sem.
  const exigeIdentificacao = aBaixar.some(l => l.controlado || l.exigePaciente) &&
    !aBaixar.every(l => l.consumoInterno)
  if (solicitacao.paraConsumo !== false && exigeIdentificacao &&
      (!solicitacao.pacienteNome || !solicitacao.prescritorNome)) {
    throw new Error('Há item que exige paciente e prescritor identificados. Recuse e peça o reenvio.')
  }

  /* Quando a enfermagem não marcou "será consumido", o item não sai do hospital:
     ele muda de lugar, do estoque da farmácia para o do setor. */
  const paraConsumo = solicitacao.paraConsumo !== false
  const destino = solicitacao.setorEstoqueId

  if (!paraConsumo && !destino) {
    throw new Error(
      'A solicitação pede reposição de estoque, mas o setor não está vinculado a um local. ' +
      'Vincule em Mais › Locais de estoque.'
    )
  }

  const lancamentos = aBaixar.map(l => ({
    tipo: paraConsumo ? 'consumo' : 'transferencia',
    estoqueId,
    estoqueNome: opcoes.estoqueNome || '',
    estoqueDestinoId: paraConsumo ? null : destino,
    estoqueDestinoNome: paraConsumo ? null : (solicitacao.setor || ''),
    itemId: l.itemId,
    itemCodigo: l.codigo,
    itemDescricao: l.descricao,
    itemUnidade: l.unidade,
    itemTipo: l.tipo || '',
    itemControlado: l.controlado || '',
    qtd: Number(l.qtdAtendida),
    finalidade: paraConsumo ? (solicitacao.pacienteNome ? 'paciente' : 'interno') : '',
    pacienteNome: solicitacao.pacienteNome || '',
    pacienteCPF: solicitacao.pacienteCPF || '',
    prescritorNome: solicitacao.prescritorNome || '',
    prescritorConselho: solicitacao.prescritorConselho || '',
    responsavelNome: solicitacao.solicitanteNome || '',
    responsavelConselho: solicitacao.solicitanteConselho || '',
    destinoInterno: solicitacao.setor || '',
    motivo: paraConsumo ? 'Solicitação da enfermagem' : 'Reposição de estoque do setor',
    observacao: [solicitacao.observacao, opcoes.observacao].filter(Boolean).join(' · ')
  }))

  await salvarLancamentos(lancamentos, ctx, {
    permitirNegativo: Boolean(opcoes.permitirNegativo)
  })

  const pediu = solicitacao.linhas.reduce((s, l) => s + Number(l.qtdSolicitada || 0), 0)
  const saiu = aBaixar.reduce((s, l) => s + Number(l.qtdAtendida), 0)

  await updateDoc(doc(db, 'solicitacoes', solicitacao.id), {
    status: saiu < pediu ? 'parcial' : 'atendida',
    linhas: linhasAtendidas.map(l => ({ ...l, qtdAtendida: Number(l.qtdAtendida) || 0 })),
    decididoPorUid: ctx.uid,
    decididoPorNome: ctx.nome,
    decididoEm: serverTimestamp(),
    observacaoFarmacia: opcoes.observacao || ''
  })

  await registrarLog(
    ctx, 'solicitacao-atendida',
    `${solicitacao.setor || 'setor não informado'} · ${aBaixar.length} item(ns) liberados de ${solicitacao.linhas.length}`,
    'solicitacoes', solicitacao.id
  )
  return aBaixar.length
}

export async function recusarSolicitacao (solicitacao, motivo, ctx) {
  if (!motivo) throw new Error('Informe o motivo da recusa.')
  await updateDoc(doc(db, 'solicitacoes', solicitacao.id), {
    status: 'recusada',
    motivoRecusa: motivo,
    decididoPorUid: ctx.uid,
    decididoPorNome: ctx.nome,
    decididoEm: serverTimestamp()
  })
  await registrarLog(
    ctx, 'solicitacao-recusada',
    `${solicitacao.setor || 'setor'} · ${motivo}`,
    'solicitacoes', solicitacao.id
  )
}

/* =========================================================
   Mesclagem de itens duplicados
   ========================================================= */

/**
 * Move todo o saldo de um item para outro e desativa o que foi absorvido.
 * O histórico dos dois continua intacto: nada é apagado, e a transferência
 * fica registrada como movimentação em cada local afetado.
 */
export async function mesclarItens (origem, destino, ctx) {
  if (!origem?.id || !destino?.id) throw new Error('Escolha os dois itens.')
  if (origem.id === destino.id) throw new Error('Escolha itens diferentes.')

  const snap = await getDocs(query(collection(db, 'lotes'), where('itemId', '==', origem.id)))
  const lotes = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(l => (l.qtd || 0) > 0)

  const operacoes = []
  const carimbo = serverTimestamp()
  const porEstoque = {}

  for (const l of lotes) {
    // zera no item antigo
    operacoes.push({
      tipo: 'set', ref: doc(db, 'lotes', l.id),
      dados: { qtd: 0, atualizadoEm: carimbo }, merge: true
    })
    // soma no item que fica
    const alvo = idLote(l.estoqueId, destino.id, l.lote, l.validade)
    operacoes.push({
      tipo: 'set', ref: doc(db, 'lotes', alvo),
      dados: {
        estoqueId: l.estoqueId,
        itemId: destino.id,
        itemDescricao: destino.descricao,
        lote: l.lote || '',
        validade: l.validade || null,
        qtd: increment(l.qtd),
        atualizadoEm: carimbo
      },
      merge: true
    })
    porEstoque[l.estoqueId] = (porEstoque[l.estoqueId] || 0) + l.qtd
  }

  for (const [estoqueId, qtd] of Object.entries(porEstoque)) {
    operacoes.push(opSaldo(estoqueId, origem.id, -qtd, carimbo))
    operacoes.push(opSaldo(estoqueId, destino.id, qtd, carimbo))
    operacoes.push({
      tipo: 'add', ref: collection(db, 'movimentos'),
      dados: {
        tipo: 'inventario',
        itemId: destino.id,
        itemCodigo: destino.codigo,
        itemDescricao: destino.descricao,
        itemUnidade: destino.unidade,
        itemTipo: destino.tipo || '',
        itemControlado: destino.controlado || '',
        estoqueId,
        estoqueNome: '',
        qtd,
        motivo: 'Mesclagem de itens duplicados',
        observacao: `Saldo recebido de ${origem.codigo} — ${origem.descricao}`,
        usuarioUid: ctx.uid,
        usuarioNome: ctx.nome,
        usuarioFuncao: ctx.funcao,
        criadoEm: carimbo
      }
    })
  }

  // o item absorvido sai de circulação, mas continua existindo para o histórico
  operacoes.push({
    tipo: 'set', ref: doc(db, 'itens', origem.id),
    dados: {
      ativo: false,
      mescladoEm: destino.id,
      mescladoCodigo: destino.codigo,
      atualizadoEm: carimbo
    },
    merge: true
  })

  await gravarEmBlocos(operacoes)
  try { await deleteDoc(doc(db, 'catalogoPublico', origem.id)) } catch (e) { /* já não existia */ }

  await registrarLog(
    ctx, 'itens-mesclados',
    `${origem.codigo} (${origem.descricao}) absorvido por ${destino.codigo} (${destino.descricao}) — ${lotes.length} lote(s)`,
    'itens', destino.id
  )
  return lotes.reduce((s, l) => s + l.qtd, 0)
}

/* =========================================================
   Controle de estorno
   ========================================================= */

/** Quanto já foi estornado de cada movimentação, para não estornar duas vezes. */
export async function estornosPorMovimento (dias = 365) {
  const desde = new Date(Date.now() - dias * 86400000)
  const snap = await getDocs(query(
    collection(db, 'movimentos'),
    where('tipo', '==', 'devolucao'),
    where('criadoEm', '>=', Timestamp.fromDate(desde)),
    orderBy('criadoEm', 'desc'),
    limit(2000)
  ))
  const mapa = {}
  snap.docs.forEach(d => {
    const m = d.data()
    if (m.estornoDe) mapa[m.estornoDe] = (mapa[m.estornoDe] || 0) + (m.qtd || 0)
  })
  return mapa
}

/* =========================================================
   Cadastro único de pessoas
   ========================================================= */

/** Molde de uma pessoa recém-cadastrada. */
export const PESSOA_VAZIA = {
  nome: '',
  nascimento: '',
  telefone: '',
  email: '',
  conselho: { sigla: '', numero: '', uf: '' },
  ativo: true,
  acesso: { temLogin: false },
  farmacia: { ativo: false, funcao: 'auxiliar', rt: false },
  enfermagem: { ativo: false, cargo: 'Técnico(a) de Enfermagem', setorPadrao: '', rt: false },
  medico: { ativo: false, especialidade: '', rt: false }
}

export async function salvarPessoa (id, dados, ctx) {
  await setDoc(doc(db, 'pessoas', id), { ...dados, atualizadoEm: serverTimestamp() }, { merge: true })
  if (ctx) await registrarLog(ctx, 'pessoa-salva', dados.nome || id, 'pessoas', id)
}

/** Pessoa sem acesso ao sistema: id automático, nada de conta de login. */
export async function criarPessoaSemAcesso (dados, ctx) {
  const ref = await addDoc(collection(db, 'pessoas'), {
    ...dados,
    acesso: { temLogin: false },
    criadoEm: serverTimestamp(),
    criadoPor: ctx.nome
  })
  await registrarLog(ctx, 'pessoa-criada', `${dados.nome} (sem acesso)`, 'pessoas', ref.id)
  return ref.id
}

export async function excluirPessoa (pessoa, ctx) {
  await deleteDoc(doc(db, 'pessoas', pessoa.id))
  await registrarLog(
    ctx, 'pessoa-removida',
    pessoa.acesso?.temLogin
      ? `${pessoa.nome} — acesso revogado. A conta de login precisa ser apagada no Console do Firebase.`
      : pessoa.nome,
    'pessoas', pessoa.id
  )
}

/**
 * Concede acesso a quem já estava cadastrado sem login.
 * As regras identificam a pessoa pelo id do documento, que precisa ser o uid
 * da conta — então o cadastro é copiado para o novo id e o antigo é removido.
 */
export async function mudarIdDePessoa (idAntigo, uid, dados, ctx) {
  await setDoc(doc(db, 'pessoas', uid), {
    ...dados,
    acesso: { temLogin: true },
    atualizadoEm: serverTimestamp()
  })
  if (idAntigo && idAntigo !== uid) await deleteDoc(doc(db, 'pessoas', idAntigo))
  await registrarLog(ctx, 'pessoa-com-acesso', `${dados.nome} passou a ter acesso`, 'pessoas', uid)
}

/* ---------------------------------------------------------
   Migração do modelo antigo
   --------------------------------------------------------- */

/** Separa "CRF 1234 PE" em sigla, número e UF. */
function partirRegistro (texto, siglaPadrao = '') {
  const t = String(texto || '').trim()
  if (!t) return { sigla: siglaPadrao, numero: '', uf: '' }
  const m = t.match(/^([A-Za-zÀ-ÿ]+)?\s*[-\s]?\s*(\d[\d.\-/]*)\s*([A-Za-z]{2})?$/)
  if (!m) return { sigla: siglaPadrao, numero: t, uf: '' }
  return {
    sigla: (m[1] || siglaPadrao).toUpperCase(),
    numero: m[2] || '',
    uf: (m[3] || '').toUpperCase()
  }
}

const TIPO_PARA_MODULO = {
  prescritor: 'medico',
  enfermeiro: 'enfermagem',
  tecnico: 'enfermagem',
  farmaceutico: 'farmacia'
}

/**
 * Junta `usuarios` e `profissionais` no cadastro único.
 * Roda quantas vezes for preciso: não duplica nem sobrescreve o que já migrou.
 */
export async function migrarParaPessoas (ctx) {
  const [usuarios, profissionais, jaExistem] = await Promise.all([
    getDocs(collection(db, 'usuarios')),
    getDocs(collection(db, 'profissionais')),
    getDocs(collection(db, 'pessoas'))
  ])

  const existentes = new Set(jaExistem.docs.map(d => d.id))
  let lote = writeBatch(db)
  let n = 0
  let comAcesso = 0
  let semAcesso = 0
  const comitar = async () => { if (n) { await lote.commit(); lote = writeBatch(db); n = 0 } }

  for (const d of usuarios.docs) {
    if (existentes.has(d.id)) continue
    const u = d.data()
    const enf = u.enfermagem || {}
    lote.set(doc(db, 'pessoas', d.id), {
      nome: u.nome || '',
      nascimento: u.nascimento || '',
      telefone: u.telefone || '',
      email: u.email || '',
      conselho: partirRegistro(enf.coren || u.registro),
      ativo: u.ativo !== false,
      senhaProvisoria: Boolean(u.senhaProvisoria),
      acesso: { temLogin: true },
      farmacia: {
        ativo: ['adm', 'farmaceutico', 'auxiliar'].includes(u.funcao),
        funcao: ['adm', 'farmaceutico', 'auxiliar'].includes(u.funcao) ? u.funcao : 'auxiliar',
        rt: Boolean(u.rtFarmacia)
      },
      enfermagem: {
        ativo: Boolean(enf.ativo),
        cargo: enf.cargo || 'Técnico(a) de Enfermagem',
        setorPadrao: enf.setorPadrao || '',
        rt: Boolean(u.rtEnfermagem)
      },
      medico: { ativo: false, especialidade: '', rt: false },
      migradoEm: serverTimestamp()
    })
    comAcesso++
    if (++n >= 400) await comitar()
  }

  for (const d of profissionais.docs) {
    if (existentes.has(d.id)) continue
    const p = d.data()
    const modulo = TIPO_PARA_MODULO[p.tipo] || 'medico'
    lote.set(doc(db, 'pessoas', d.id), {
      nome: p.nome || '',
      nascimento: '',
      telefone: p.telefone || '',
      email: '',
      conselho: { sigla: p.conselho || '', numero: p.numero || '', uf: p.uf || '' },
      ativo: p.ativo !== false,
      acesso: { temLogin: false },
      farmacia: { ativo: modulo === 'farmacia', funcao: 'auxiliar', rt: false },
      enfermagem: {
        ativo: modulo === 'enfermagem',
        cargo: p.tipo === 'tecnico' ? 'Técnico(a) de Enfermagem' : 'Enfermeiro(a)',
        setorPadrao: '',
        rt: false
      },
      medico: { ativo: modulo === 'medico', especialidade: p.especialidade || '', rt: false },
      migradoEm: serverTimestamp()
    })
    semAcesso++
    if (++n >= 400) await comitar()
  }

  await comitar()
  await registrarLog(
    ctx, 'migracao-pessoas',
    `${comAcesso} com acesso e ${semAcesso} sem acesso migrados para o cadastro único`
  )
  return { comAcesso, semAcesso }
}

/* =========================================================
   Reversão de lançamento
   ========================================================= */

export const JANELA_REVERSAO_MS = 60 * 60 * 1000   // uma hora

/** Sinais invertidos: o que somou passa a subtrair, e vice-versa. */
const INVERSO = {
  entrada: 'descarte',
  devolucao: 'consumo',
  consumo: 'devolucao',
  descarte: 'entrada',
  saida: 'devolucao',
  transferencia: 'transferencia'
}

export function podeReverter (movimento, agora = Date.now()) {
  if (!movimento || movimento.revertido || movimento.reverteMovimento) return false
  if (movimento.tipo === 'inventario') return false
  const criado = movimento.criadoEm?.toMillis ? movimento.criadoEm.toMillis() : 0
  if (!criado) return false
  return agora - criado <= JANELA_REVERSAO_MS
}

export function minutosRestantes (movimento, agora = Date.now()) {
  const criado = movimento.criadoEm?.toMillis ? movimento.criadoEm.toMillis() : 0
  return Math.max(0, Math.ceil((JANELA_REVERSAO_MS - (agora - criado)) / 60000))
}

/**
 * Desfaz um lançamento criando o oposto, amarrado ao original.
 * Nada é apagado: os dois registros permanecem, que é o que sustenta o
 * histórico como prova em fiscalização.
 */
export async function reverterMovimento (movimento, ctx) {
  const atual = await getDoc(doc(db, 'movimentos', movimento.id))
  if (!atual.exists()) throw new Error('Este lançamento não existe mais.')
  const m = { id: atual.id, ...atual.data() }

  if (m.revertido) throw new Error('Este lançamento já foi revertido.')
  if (!podeReverter(m)) {
    throw new Error(
      'O prazo de uma hora para reverter já passou. A correção agora é por um novo ' +
      'lançamento ou pelo inventário.'
    )
  }

  const tipo = INVERSO[m.tipo]
  if (!tipo) throw new Error('Este tipo de lançamento não pode ser revertido.')

  // Transferência volta trocando origem e destino.
  const linha = tipo === 'transferencia'
    ? {
        tipo: 'transferencia',
        estoqueId: m.estoqueDestinoId,
        estoqueNome: m.estoqueDestinoNome || '',
        estoqueDestinoId: m.estoqueId,
        estoqueDestinoNome: m.estoqueNome || ''
      }
    : { tipo, estoqueId: m.estoqueId, estoqueNome: m.estoqueNome || '' }

  await salvarLancamentos([{
    ...linha,
    itemId: m.itemId,
    itemCodigo: m.itemCodigo,
    itemDescricao: m.itemDescricao,
    itemUnidade: m.itemUnidade,
    itemTipo: m.itemTipo || '',
    itemControlado: m.itemControlado || '',
    qtd: m.qtd,
    lote: m.lote || '',
    validade: m.validade || null,
    motivo: 'Reversão de lançamento',
    observacao: `Desfaz o ${m.tipo} de ${m.qtd} registrado por ${m.usuarioNome}`,
    reverteMovimento: m.id
  }], ctx, { permitirNegativo: false })

  await updateDoc(doc(db, 'movimentos', m.id), {
    revertido: true,
    revertidoPor: ctx.nome,
    revertidoEm: serverTimestamp()
  })

  const minutos = Math.round((Date.now() - (m.criadoEm?.toMillis?.() || 0)) / 60000)
  await registrarLog(
    ctx, 'movimentacao-revertida',
    `${m.tipo} de ${m.qtd} × ${m.itemDescricao} em ${m.estoqueNome}, ` +
    `lançado por ${m.usuarioNome} há ${minutos} min`,
    'movimentos', m.id
  )
}

/** Nova senha provisória para quem não tem e-mail de verdade. */
export async function marcarSenhaProvisoria (pessoaId, ctx) {
  await setDoc(doc(db, 'pessoas', pessoaId), { senhaProvisoria: true }, { merge: true })
  await registrarLog(ctx, 'senha-redefinida', 'Senha provisória definida', 'pessoas', pessoaId)
}
