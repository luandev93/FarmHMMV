import { useEffect, useMemo, useRef, useState } from 'react'
import BuscaItem from '../components/BuscaItem'
import { Confirmar, Icone, Painel, Vazio, useAviso } from '../components/ui'
import { useAuth } from '../lib/auth'
import { useDados } from '../lib/store'
import { salvarLancamentos } from '../lib/db'
import {
  MOTIVOS_ENTRADA, MOTIVOS_SAIDA, dataBR, formatarNumero, idAleatorio, vibrar
} from '../lib/utils'

const RASCUNHO = 'rascunho-movimentacao'

const ACOES = [
  { id: 'entrada', rotulo: 'Adicionar', icone: 'entrada' },
  { id: 'saida', rotulo: 'Retirar', icone: 'saida' },
  { id: 'transferencia', rotulo: 'Transferir', icone: 'transferencia' }
]

export default function Movimentar () {
  const { perfil, usuario } = useAuth()
  const dados = useDados()
  const avisar = useAviso()

  const [estoqueId, setEstoqueId] = useState(() => localStorage.getItem('estoque-atual') || '')
  const [destinoId, setDestinoId] = useState('')
  const [acao, setAcao] = useState('entrada')
  const [item, setItem] = useState(null)
  const [qtd, setQtd] = useState('')
  const [lote, setLote] = useState('')
  const [validade, setValidade] = useState('')
  const [motivo, setMotivo] = useState('')
  const [observacao, setObservacao] = useState('')
  const [detalhesAbertos, setDetalhes] = useState(false)
  const [linhas, setLinhas] = useState(() => {
    try { return JSON.parse(localStorage.getItem(RASCUNHO) || '[]') } catch { return [] }
  })
  const [editandoId, setEditandoId] = useState(null)
  const [salvando, setSalvando] = useState(false)
  const [confirmando, setConfirmando] = useState(false)
  const [erro, setErro] = useState('')
  const [chaveBusca, setChaveBusca] = useState(0)
  const campoQtd = useRef(null)

  useEffect(() => {
    if (!estoqueId && dados.estoques.length) setEstoqueId(dados.estoques[0].id)
  }, [dados.estoques, estoqueId])

  useEffect(() => {
    if (estoqueId) localStorage.setItem('estoque-atual', estoqueId)
  }, [estoqueId])

  useEffect(() => {
    localStorage.setItem(RASCUNHO, JSON.stringify(linhas))
  }, [linhas])

  const estoque = dados.estoques.find(e => e.id === estoqueId)
  const destino = dados.estoques.find(e => e.id === destinoId)
  const outrosEstoques = dados.estoques.filter(e => e.id !== estoqueId)

  const saldoAtual = item && estoqueId ? dados.saldoDe(estoqueId, item.id) : 0
  const lotesDoItem = item && estoqueId ? dados.lotesDe(estoqueId, item.id) : []

  const resumo = useMemo(() => {
    const conta = { entrada: 0, saida: 0, transferencia: 0 }
    linhas.forEach(l => { conta[l.tipo] = (conta[l.tipo] || 0) + 1 })
    return conta
  }, [linhas])

  function limparFormulario () {
    setItem(null); setQtd(''); setLote(''); setValidade('')
    setObservacao(''); setEditandoId(null); setErro('')
    setChaveBusca(k => k + 1)
  }

  function adicionar () {
    setErro('')
    if (!estoqueId) return setErro('Escolha o estoque de origem.')
    if (acao === 'transferencia' && !destinoId) return setErro('Escolha o estoque de destino.')
    if (acao === 'transferencia' && destinoId === estoqueId) return setErro('Origem e destino precisam ser diferentes.')
    if (!item) return setErro('Escolha o item.')
    const quantidade = Number(String(qtd).replace(',', '.'))
    if (!(quantidade > 0)) return setErro('Informe uma quantidade maior que zero.')

    // Soma o que já está no rascunho para o mesmo item, para não prometer saldo que não existe.
    if (acao !== 'entrada') {
      const jaNoRascunho = linhas
        .filter(l => l.id !== editandoId && l.itemId === item.id && l.estoqueId === estoqueId && l.tipo !== 'entrada')
        .reduce((s, l) => s + Number(l.qtd), 0)
      if (jaNoRascunho + quantidade > saldoAtual) {
        return setErro(
          `Saldo insuficiente: há ${formatarNumero(saldoAtual)} ${item.unidade?.toLowerCase()} em ${estoque?.nome}` +
          (jaNoRascunho ? ` e ${formatarNumero(jaNoRascunho)} já está reservado nesta lista.` : '.')
        )
      }
    }

    const linha = {
      id: editandoId || idAleatorio(),
      tipo: acao,
      estoqueId,
      estoqueNome: estoque?.nome || '',
      estoqueDestinoId: acao === 'transferencia' ? destinoId : null,
      estoqueDestinoNome: acao === 'transferencia' ? destino?.nome || '' : null,
      itemId: item.id,
      itemCodigo: item.codigo,
      itemDescricao: item.descricao,
      itemUnidade: item.unidade,
      itemTipo: item.tipo,
      itemGrupoATC: item.grupoATC,
      itemGrupoFarmacologico: item.grupoFarmacologico,
      itemControlado: item.controlado,
      qtd: quantidade,
      lote: acao === 'entrada' ? lote.trim() : '',
      validade: acao === 'entrada' ? (validade || null) : null,
      motivo,
      observacao: observacao.trim()
    }

    setLinhas(atual =>
      editandoId ? atual.map(l => (l.id === editandoId ? linha : l)) : [linha, ...atual]
    )
    vibrar()
    limparFormulario()
  }

  function editar (linha) {
    setAcao(linha.tipo)
    setEstoqueId(linha.estoqueId)
    setDestinoId(linha.estoqueDestinoId || '')
    setItem(dados.itemPorId(linha.itemId) || null)
    setQtd(String(linha.qtd))
    setLote(linha.lote || '')
    setValidade(linha.validade || '')
    setMotivo(linha.motivo || '')
    setObservacao(linha.observacao || '')
    setEditandoId(linha.id)
    setDetalhes(Boolean(linha.lote || linha.validade || linha.observacao))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function salvar () {
    setConfirmando(false)
    setSalvando(true)
    setErro('')
    try {
      const ctx = { uid: usuario.uid, nome: perfil.nome, funcao: perfil.funcao }
      const total = await salvarLancamentos(linhas, ctx, {
        permitirNegativo: dados.config.permitirSaldoNegativo
      })
      setLinhas([])
      limparFormulario()
      avisar(`${total} lançamento(s) gravados no estoque.`, 'ok')
    } catch (e) {
      setErro(e.message || 'Não foi possível salvar.')
      avisar('Nada foi gravado. Veja o aviso na tela.', 'erro')
    } finally {
      setSalvando(false)
    }
  }

  if (!dados.estoques.length) {
    return (
      <Vazio
        titulo="Nenhum local de estoque cadastrado"
        texto="Peça ao administrador para cadastrar os locais em Mais › Locais de estoque."
      />
    )
  }

  const motivos = acao === 'entrada' ? MOTIVOS_ENTRADA : MOTIVOS_SAIDA

  return (
    <>
      {/* Estoque de origem */}
      <div className="bloco">
        <label className="rotulo" htmlFor="estoque">
          {acao === 'transferencia' ? 'Estoque de origem' : 'Estoque'}
        </label>
        <select
          id="estoque" className="campo" value={estoqueId}
          onChange={e => setEstoqueId(e.target.value)}
        >
          {dados.estoques.map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}
        </select>
      </div>

      {/* Ação */}
      <div className="bloco">
        <label className="rotulo">O que você vai fazer</label>
        <div className="acao-grupo">
          {ACOES.map(a => (
            <button
              key={a.id}
              className={'acao-btn ' + a.id}
              aria-pressed={acao === a.id}
              onClick={() => { setAcao(a.id); setErro(''); vibrar() }}
            >
              <Icone nome={a.icone} />
              {a.rotulo}
            </button>
          ))}
        </div>
      </div>

      {acao === 'transferencia' && (
        <div className="bloco">
          <label className="rotulo" htmlFor="destino">Estoque de destino</label>
          <select
            id="destino" className="campo" value={destinoId}
            onChange={e => setDestinoId(e.target.value)}
          >
            <option value="">Escolha o destino…</option>
            {outrosEstoques.map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}
          </select>
        </div>
      )}

      {/* Item */}
      <div className="bloco">
        <label className="rotulo">Item</label>
        <BuscaItem
          key={chaveBusca}
          estoqueId={estoqueId}
          escolhido={item}
          aoEscolher={i => {
            setItem(i)
            setTimeout(() => campoQtd.current?.focus(), 60)
          }}
          aoLimpar={() => { setItem(null); setChaveBusca(k => k + 1) }}
          autoFoco={false}
        />
      </div>

      {item && (
        <>
          <div className="bloco">
            <label className="rotulo" htmlFor="qtd">
              Quantidade em {item.unidade?.toLowerCase()}
            </label>
            <input
              id="qtd" ref={campoQtd} className="campo num" value={qtd}
              onChange={e => setQtd(e.target.value.replace(/[^\d.,]/g, ''))}
              onKeyDown={e => { if (e.key === 'Enter') adicionar() }}
              inputMode="decimal" placeholder="0" enterKeyHint="done"
            />
            <div className="pilulas" style={{ marginTop: 8, marginBottom: 0 }}>
              {[1, 5, 10, 20, 50, 100].map(n => (
                <button
                  key={n} className="pilula"
                  onClick={() => {
                    setQtd(v => String((Number(String(v).replace(',', '.')) || 0) + n))
                    vibrar(8)
                  }}
                >+{n}</button>
              ))}
              {qtd && <button className="pilula" onClick={() => setQtd('')}>limpar</button>}
            </div>
          </div>

          {acao !== 'entrada' && lotesDoItem.length > 0 && (
            <div className="info-caixa bloco">
              A baixa segue o PVPS: sai primeiro o lote que vence antes —{' '}
              <b>
                {[...lotesDoItem].sort((a, b) => (a.validade || '9999') < (b.validade || '9999') ? -1 : 1)[0]?.lote || 'sem lote'}
                {' · '}
                {dataBR([...lotesDoItem].sort((a, b) => (a.validade || '9999') < (b.validade || '9999') ? -1 : 1)[0]?.validade)}
              </b>.
            </div>
          )}

          <div className="bloco">
            <button
              className="btn fantasma pequeno"
              onClick={() => setDetalhes(v => !v)}
              style={{ padding: 0 }}
            >
              {detalhesAbertos ? '− ' : '+ '}
              {acao === 'entrada' ? 'Lote, validade e motivo (opcional)' : 'Motivo e observação (opcional)'}
            </button>

            {detalhesAbertos && (
              <div className="cartao" style={{ marginTop: 10, display: 'grid', gap: 12 }}>
                {acao === 'entrada' && (
                  <div className="linha-campos">
                    <div>
                      <label className="rotulo" htmlFor="lote">Lote</label>
                      <input
                        id="lote" className="campo" value={lote}
                        onChange={e => setLote(e.target.value.toUpperCase())}
                        placeholder="Ex.: ABC1234" autoCapitalize="characters"
                      />
                    </div>
                    <div>
                      <label className="rotulo" htmlFor="validade">Validade</label>
                      <input
                        id="validade" className="campo" type="date" value={validade}
                        onChange={e => setValidade(e.target.value)}
                      />
                    </div>
                  </div>
                )}
                <div>
                  <label className="rotulo" htmlFor="motivo">Motivo</label>
                  <select id="motivo" className="campo" value={motivo} onChange={e => setMotivo(e.target.value)}>
                    <option value="">Não informar</option>
                    {motivos.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label className="rotulo" htmlFor="obs">Observação</label>
                  <input
                    id="obs" className="campo" value={observacao}
                    onChange={e => setObservacao(e.target.value)}
                    placeholder="Nota livre para o histórico"
                  />
                </div>
              </div>
            )}
          </div>

          {erro && <div className="erro-caixa bloco">{erro}</div>}

          <div className="acoes bloco">
            {editandoId && (
              <button className="btn secundario" onClick={limparFormulario}>Cancelar edição</button>
            )}
            <button className="btn" onClick={adicionar}>
              <Icone nome={editandoId ? 'certo' : 'entrada'} tamanho={18} />
              {editandoId ? 'Atualizar lançamento' : 'Adicionar à lista'}
            </button>
          </div>
        </>
      )}

      {!item && erro && <div className="erro-caixa bloco">{erro}</div>}

      {/* Rascunho */}
      <div className="bloco" style={{ marginTop: 22 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 10 }}>
          <h2 style={{ fontSize: 16 }}>Lançamentos pendentes</h2>
          <span className="dica">{linhas.length ? `${linhas.length} na lista` : 'nada ainda'}</span>
        </div>

        {linhas.length === 0 ? (
          <Vazio
            titulo="A lista está vazia"
            texto="Escolha o item e a quantidade acima. Nada muda no estoque enquanto você não salvar."
          />
        ) : (
          <div className="rascunho">
            {linhas.map(l => (
              <div key={l.id} className={'lanc ' + l.tipo}>
                <div className="corpo">
                  <div className="titulo">{l.itemDescricao}</div>
                  <div className="sub">
                    {l.tipo === 'transferencia'
                      ? `${l.estoqueNome} → ${l.estoqueDestinoNome}`
                      : l.estoqueNome}
                    {l.lote && ` · lote ${l.lote}`}
                    {l.validade && ` · vence ${dataBR(l.validade)}`}
                    {l.motivo && ` · ${l.motivo}`}
                  </div>
                </div>
                <div className={'qtd num ' + l.tipo}>
                  {l.tipo === 'entrada' ? '+' : l.tipo === 'saida' ? '−' : '⇄'}
                  {formatarNumero(l.qtd)}
                </div>
                <div className="btns">
                  <button onClick={() => editar(l)} aria-label="Editar lançamento">
                    <Icone nome="lapis" tamanho={16} />
                  </button>
                  <button
                    onClick={() => setLinhas(a => a.filter(x => x.id !== l.id))}
                    aria-label="Remover lançamento"
                  >
                    <Icone nome="lixeira" tamanho={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {linhas.length > 0 && (
        <div className="barra-salvar">
          <div className="resumo">
            <b>{linhas.length} lançamento{linhas.length > 1 ? 's' : ''}</b>
            {resumo.entrada ? `${resumo.entrada} entrada(s) ` : ''}
            {resumo.saida ? `${resumo.saida} saída(s) ` : ''}
            {resumo.transferencia ? `${resumo.transferencia} transf.` : ''}
          </div>
          <button className="btn" onClick={() => setConfirmando(true)} disabled={salvando}>
            {salvando ? 'Gravando…' : 'Salvar no estoque'}
          </button>
        </div>
      )}

      {confirmando && (
        <Confirmar
          titulo="Gravar no estoque?"
          texto={`${linhas.length} lançamento(s) serão aplicados aos saldos. Depois de gravado, o histórico não pode ser apagado — a correção é feita por um novo lançamento ou pelo inventário.`}
          rotuloConfirmar="Gravar agora"
          aoConfirmar={salvar}
          aoFechar={() => setConfirmando(false)}
        />
      )}
    </>
  )
}
