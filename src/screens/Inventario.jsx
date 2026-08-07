import { useEffect, useMemo, useRef, useState } from 'react'
import BuscaItem from '../components/BuscaItem'
import { Confirmar, Icone, Vazio, useAviso } from '../components/ui'
import { useAuth } from '../lib/auth'
import { useDados } from '../lib/store'
import { salvarInventario } from '../lib/db'
import { dataBR, formatarNumero, idAleatorio, vibrar } from '../lib/utils'

const RASCUNHO = 'rascunho-inventario'

export default function Inventario () {
  const { perfil, usuario } = useAuth()
  const dados = useDados()
  const avisar = useAviso()

  const [estoqueId, setEstoqueId] = useState(() => localStorage.getItem('estoque-atual') || '')
  const [item, setItem] = useState(null)
  const [qtd, setQtd] = useState('')
  const [lote, setLote] = useState('')
  const [validade, setValidade] = useState('')
  const [observacao, setObservacao] = useState('')
  const [porLote, setPorLote] = useState(false)
  const [linhas, setLinhas] = useState(() => {
    try { return JSON.parse(localStorage.getItem(RASCUNHO) || '[]') } catch { return [] }
  })
  const [editandoId, setEditandoId] = useState(null)
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [confirmando, setConfirmando] = useState(false)
  const [chaveBusca, setChaveBusca] = useState(0)
  const campoQtd = useRef(null)

  useEffect(() => {
    if (!estoqueId && dados.estoques.length) setEstoqueId(dados.estoques[0].id)
  }, [dados.estoques, estoqueId])

  useEffect(() => {
    localStorage.setItem(RASCUNHO, JSON.stringify(linhas))
  }, [linhas])

  const estoque = dados.estoques.find(e => e.id === estoqueId)
  const saldoSistema = item && estoqueId ? dados.saldoDe(estoqueId, item.id) : 0
  const lotesDoItem = item && estoqueId ? dados.lotesDe(estoqueId, item.id) : []

  const diferencaTotal = useMemo(
    () => linhas.reduce((s, l) => s + (Number(l.qtd) - Number(l.saldoSistema || 0)), 0),
    [linhas]
  )

  function limpar () {
    setItem(null); setQtd(''); setLote(''); setValidade('')
    setObservacao(''); setEditandoId(null); setErro(''); setPorLote(false)
    setChaveBusca(k => k + 1)
  }

  function adicionar () {
    setErro('')
    if (!estoqueId) return setErro('Escolha o local que está sendo contado.')
    if (!item) return setErro('Escolha o item.')
    const contagem = Number(String(qtd).replace(',', '.'))
    if (!(contagem >= 0) || qtd === '') return setErro('Informe a quantidade contada (pode ser zero).')
    if (porLote && !lote && !validade) return setErro('Informe o lote ou a validade que você está contando.')

    const linha = {
      id: editandoId || idAleatorio(),
      estoqueId,
      estoqueNome: estoque?.nome || '',
      itemId: item.id,
      itemCodigo: item.codigo,
      itemDescricao: item.descricao,
      itemUnidade: item.unidade,
      itemTipo: item.tipo,
      itemGrupoATC: item.grupoATC,
      itemGrupoFarmacologico: item.grupoFarmacologico,
      itemControlado: item.controlado,
      qtd: contagem,
      lote: porLote ? lote.trim() : '',
      validade: porLote ? (validade || null) : null,
      observacao: observacao.trim(),
      saldoSistema
    }

    setLinhas(a => (editandoId ? a.map(l => (l.id === editandoId ? linha : l)) : [linha, ...a]))
    vibrar()
    limpar()
  }

  function editar (l) {
    setEstoqueId(l.estoqueId)
    setItem(dados.itemPorId(l.itemId) || null)
    setQtd(String(l.qtd))
    setLote(l.lote || '')
    setValidade(l.validade || '')
    setObservacao(l.observacao || '')
    setPorLote(Boolean(l.lote || l.validade))
    setEditandoId(l.id)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function salvar () {
    setConfirmando(false)
    setSalvando(true)
    try {
      const ctx = { uid: usuario.uid, nome: perfil.nome, funcao: perfil.farmacia?.funcao || '' }
      const total = await salvarInventario(linhas, ctx)
      setLinhas([])
      limpar()
      avisar(`${total} contagem(ns) aplicadas ao estoque.`, 'ok')
    } catch (e) {
      setErro(e.message || 'Não foi possível salvar o inventário.')
      avisar('Nada foi gravado.', 'erro')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <>
      <div className="aviso-caixa bloco">
        O inventário <b>substitui</b> o saldo do item pela quantidade contada. Ele não soma nem
        subtrai — o que estiver na contagem passa a ser a verdade do sistema.
      </div>

      <div className="bloco">
        <label className="rotulo" htmlFor="local">Local que está sendo contado</label>
        <select id="local" className="campo" value={estoqueId} onChange={e => setEstoqueId(e.target.value)}>
          {dados.estoques.map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}
        </select>
      </div>

      <div className="bloco">
        <label className="rotulo">Item</label>
        <BuscaItem
          key={chaveBusca}
          estoqueId={estoqueId}
          escolhido={item}
          aoEscolher={i => { setItem(i); setTimeout(() => campoQtd.current?.focus(), 60) }}
          aoLimpar={() => { setItem(null); setChaveBusca(k => k + 1) }}
        />
      </div>

      {item && (
        <>
          <div className="cartao bloco" style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
            <div>
              <div className="rotulo" style={{ marginBottom: 2 }}>Saldo no sistema</div>
              <div className="num" style={{ fontSize: 22, fontWeight: 700 }}>
                {formatarNumero(saldoSistema)}
                <span style={{ fontSize: 12, color: 'var(--tinta-fraca)', fontWeight: 400 }}>
                  {' '}{item.unidade?.toLowerCase()}
                </span>
              </div>
            </div>
            {qtd !== '' && (
              <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                <div className="rotulo" style={{ marginBottom: 2 }}>Diferença</div>
                <div
                  className="num"
                  style={{
                    fontSize: 22, fontWeight: 700,
                    color: Number(qtd) - saldoSistema === 0
                      ? 'var(--entrada)'
                      : Number(qtd) - saldoSistema > 0 ? 'var(--azul-600)' : 'var(--saida)'
                  }}
                >
                  {Number(qtd) - saldoSistema > 0 ? '+' : ''}
                  {formatarNumero(Number(qtd) - saldoSistema)}
                </div>
              </div>
            )}
          </div>

          <div className="bloco">
            <label className="rotulo" htmlFor="contagem">Quantidade contada na prateleira</label>
            <input
              id="contagem" ref={campoQtd} className="campo num" value={qtd}
              onChange={e => setQtd(e.target.value.replace(/[^\d.,]/g, ''))}
              onKeyDown={e => { if (e.key === 'Enter') adicionar() }}
              inputMode="decimal" placeholder="0" enterKeyHint="done"
            />
            <div className="pilulas" style={{ marginTop: 8, marginBottom: 0 }}>
              {[1, 5, 10, 50].map(n => (
                <button
                  key={n} className="pilula"
                  onClick={() => setQtd(v => String((Number(String(v).replace(',', '.')) || 0) + n))}
                >+{n}</button>
              ))}
              <button className="pilula" onClick={() => setQtd('0')}>zerar</button>
            </div>
          </div>

          <div className="bloco">
            <button className="btn fantasma pequeno" style={{ padding: 0 }} onClick={() => setPorLote(v => !v)}>
              {porLote ? '− ' : '+ '}Contar um lote específico
            </button>

            {porLote && (
              <div className="cartao" style={{ marginTop: 10, display: 'grid', gap: 12 }}>
                <p className="dica">
                  Ao informar o lote, só a quantidade daquele lote é reescrita. Sem lote, todos os
                  lotes do item neste local são substituídos por um saldo único.
                </p>
                {lotesDoItem.length > 0 && (
                  <div>
                    <label className="rotulo">Lotes registrados aqui</label>
                    <div className="pilulas" style={{ marginBottom: 0 }}>
                      {lotesDoItem.map(l => (
                        <button
                          key={l.id} className="pilula"
                          aria-pressed={lote === (l.lote || '') && validade === (l.validade || '')}
                          onClick={() => { setLote(l.lote || ''); setValidade(l.validade || '') }}
                        >
                          {l.lote || 'sem lote'} · {dataBR(l.validade)} · {formatarNumero(l.qtd)}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <div className="linha-campos">
                  <div>
                    <label className="rotulo" htmlFor="ilote">Lote</label>
                    <input
                      id="ilote" className="campo" value={lote}
                      onChange={e => setLote(e.target.value.toUpperCase())}
                      autoCapitalize="characters"
                    />
                  </div>
                  <div>
                    <label className="rotulo" htmlFor="ival">Validade</label>
                    <input
                      id="ival" className="campo" type="date" value={validade}
                      onChange={e => setValidade(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="bloco">
            <label className="rotulo" htmlFor="iobs">Observação</label>
            <input
              id="iobs" className="campo" value={observacao}
              onChange={e => setObservacao(e.target.value)}
              placeholder="Ex.: caixa avariada, contagem conferida por dois"
            />
          </div>

          {erro && <div className="erro-caixa bloco">{erro}</div>}

          <div className="acoes bloco">
            {editandoId && <button className="btn secundario" onClick={limpar}>Cancelar edição</button>}
            <button className="btn" onClick={adicionar}>
              <Icone nome="certo" tamanho={18} />
              {editandoId ? 'Atualizar contagem' : 'Adicionar à contagem'}
            </button>
          </div>
        </>
      )}

      {!item && erro && <div className="erro-caixa bloco">{erro}</div>}

      <div className="bloco" style={{ marginTop: 22 }}>
        <h2 style={{ fontSize: 16, marginBottom: 10 }}>Contagens pendentes</h2>
        {linhas.length === 0 ? (
          <Vazio
            titulo="Nenhuma contagem na lista"
            texto="Vá somando os itens contados. O estoque só muda quando você salvar."
          />
        ) : (
          <div className="rascunho">
            {linhas.map(l => {
              const dif = Number(l.qtd) - Number(l.saldoSistema || 0)
              return (
                <div key={l.id} className="lanc inventario">
                  <div className="corpo">
                    <div className="titulo">{l.itemDescricao}</div>
                    <div className="sub">
                      {l.estoqueNome} · sistema {formatarNumero(l.saldoSistema)} → contado {formatarNumero(l.qtd)}
                      {l.lote && ` · lote ${l.lote}`}
                      {l.validade && ` · ${dataBR(l.validade)}`}
                    </div>
                  </div>
                  <div
                    className="qtd num"
                    style={{ color: dif === 0 ? 'var(--entrada)' : dif > 0 ? 'var(--azul-600)' : 'var(--saida)' }}
                  >
                    {dif > 0 ? '+' : ''}{formatarNumero(dif)}
                  </div>
                  <div className="btns">
                    <button onClick={() => editar(l)} aria-label="Editar contagem">
                      <Icone nome="lapis" tamanho={16} />
                    </button>
                    <button onClick={() => setLinhas(a => a.filter(x => x.id !== l.id))} aria-label="Remover contagem">
                      <Icone nome="lixeira" tamanho={16} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {linhas.length > 0 && (
        <div className="barra-salvar">
          <div className="resumo">
            <b>{linhas.length} contagem{linhas.length > 1 ? 's' : ''}</b>
            diferença {diferencaTotal > 0 ? '+' : ''}{formatarNumero(diferencaTotal)}
          </div>
          <button className="btn" onClick={() => setConfirmando(true)} disabled={salvando}>
            {salvando ? 'Gravando…' : 'Aplicar inventário'}
          </button>
        </div>
      )}

      {confirmando && (
        <Confirmar
          titulo="Aplicar o inventário?"
          texto={`${linhas.length} item(ns) terão o saldo substituído pela quantidade contada. A diferença fica registrada no histórico e na auditoria.`}
          rotuloConfirmar="Aplicar agora"
          perigo
          aoConfirmar={salvar}
          aoFechar={() => setConfirmando(false)}
        />
      )}
    </>
  )
}
