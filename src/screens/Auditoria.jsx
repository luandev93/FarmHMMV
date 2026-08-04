import { useEffect, useState } from 'react'
import { Icone, Vazio } from '../components/ui'
import { useDados } from '../lib/store'
import { lerLogs, movimentosRecentes } from '../lib/db'
import { NOMES_FUNCAO, baixarCSV, dataBR, dataHora, formatarNumero, semAcento } from '../lib/utils'

const PERIODOS = [
  { id: 7, rotulo: '7 dias' },
  { id: 30, rotulo: '30 dias' },
  { id: 90, rotulo: '90 dias' },
  { id: 0, rotulo: 'Tudo' }
]

export default function Auditoria () {
  const [aba, setAba] = useState('movimentos')

  return (
    <>
      <div className="pilulas">
        <button className="pilula" aria-pressed={aba === 'movimentos'} onClick={() => setAba('movimentos')}>
          Movimentações
        </button>
        <button className="pilula" aria-pressed={aba === 'sistema'} onClick={() => setAba('sistema')}>
          Registros do sistema
        </button>
      </div>
      {aba === 'movimentos' ? <Movimentos /> : <Registros />}
    </>
  )
}

function Movimentos () {
  const dados = useDados()
  const [tipo, setTipo] = useState('')
  const [estoqueId, setEstoqueId] = useState('')
  const [periodo, setPeriodo] = useState(30)
  const [busca, setBusca] = useState('')
  const [linhas, setLinhas] = useState(null)
  const [erro, setErro] = useState('')

  useEffect(() => {
    let vivo = true
    setLinhas(null)
    setErro('')
    movimentosRecentes({
      tipo: tipo || undefined,
      estoqueId: estoqueId || undefined,
      desde: periodo ? new Date(Date.now() - periodo * 86400000) : undefined,
      limite: 500
    })
      .then(r => vivo && setLinhas(r))
      .catch(e => {
        if (!vivo) return
        setErro(
          e?.code === 'failed-precondition'
            ? 'O Firestore está criando o índice desta consulta. Aguarde um minuto e tente de novo.'
            : 'Não foi possível carregar as movimentações.'
        )
        setLinhas([])
      })
    return () => { vivo = false }
  }, [tipo, estoqueId, periodo])

  const filtradas = (linhas || []).filter(m => {
    if (!busca.trim()) return true
    return semAcento([m.itemDescricao, m.usuarioNome, m.motivo, m.lote].join(' '))
      .includes(semAcento(busca))
  })

  function exportar () {
    const l = [[
      'Data', 'Tipo', 'Item', 'Código', 'Grupo ATC', 'Grupo farmacológico', 'Controle',
      'Quantidade', 'Unidade', 'Origem', 'Destino', 'Lote', 'Validade',
      'Lotes usados', 'Saldo anterior', 'Diferença', 'Motivo', 'Observação', 'Responsável', 'Função'
    ]]
    filtradas.forEach(m => l.push([
      dataHora(m.criadoEm), m.tipo, m.itemDescricao, m.itemCodigo, m.itemGrupoATC,
      m.itemGrupoFarmacologico, m.itemControlado, m.qtd, m.itemUnidade,
      m.estoqueNome, m.estoqueDestinoNome || '', m.lote || '', m.validade ? dataBR(m.validade) : '',
      m.lotesUsados || '', m.saldoAnterior ?? '', m.diferenca ?? '',
      m.motivo || '', m.observacao || '', m.usuarioNome, NOMES_FUNCAO[m.usuarioFuncao] || ''
    ]))
    baixarCSV(`movimentacoes-${new Date().toISOString().slice(0, 10)}.csv`, l)
  }

  return (
    <>
      <div className="bloco">
        <input
          className="campo" type="search" value={busca} onChange={e => setBusca(e.target.value)}
          placeholder="Buscar por item, pessoa ou motivo"
        />
      </div>

      <div className="linha-campos bloco">
        <select className="campo" value={tipo} onChange={e => setTipo(e.target.value)}>
          <option value="">Todos os tipos</option>
          <option value="entrada">Entradas</option>
          <option value="saida">Saídas</option>
          <option value="transferencia">Transferências</option>
          <option value="inventario">Inventários</option>
        </select>
        <select className="campo" value={estoqueId} onChange={e => setEstoqueId(e.target.value)}>
          <option value="">Todos os locais</option>
          {dados.estoques.map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}
        </select>
      </div>

      <div className="pilulas">
        {PERIODOS.map(p => (
          <button key={p.id} className="pilula" aria-pressed={periodo === p.id} onClick={() => setPeriodo(p.id)}>
            {p.rotulo}
          </button>
        ))}
      </div>

      {erro && <div className="aviso-caixa bloco">{erro}</div>}

      {linhas === null ? (
        <p className="dica">Carregando…</p>
      ) : filtradas.length === 0 ? (
        <Vazio titulo="Nenhuma movimentação" texto="Ajuste os filtros ou amplie o período." />
      ) : (
        <>
          <p className="dica" style={{ marginBottom: 8 }}>{filtradas.length} registro(s)</p>
          <div className="lista">
            {filtradas.map(m => (
              <div key={m.id} className={'lanc ' + m.tipo}>
                <div className="corpo">
                  <div className="titulo">{m.itemDescricao}</div>
                  <div className="sub">
                    {dataHora(m.criadoEm)} · {m.usuarioNome}
                    <br />
                    {m.tipo === 'transferencia'
                      ? `${m.estoqueNome} → ${m.estoqueDestinoNome}`
                      : m.estoqueNome}
                    {m.lote && ` · lote ${m.lote}`}
                    {m.validade && ` · vence ${dataBR(m.validade)}`}
                    {m.tipo === 'inventario' &&
                      ` · sistema ${formatarNumero(m.saldoAnterior)} → contado ${formatarNumero(m.qtd)}`}
                    {m.motivo && ` · ${m.motivo}`}
                    {m.lotesUsados && ` · ${m.lotesUsados}`}
                    {m.observacao && ` · ${m.observacao}`}
                  </div>
                </div>
                <div className={'qtd num ' + m.tipo}>
                  {m.tipo === 'entrada' ? '+' : m.tipo === 'saida' ? '−' : m.tipo === 'inventario' ? '=' : '⇄'}
                  {formatarNumero(m.qtd)}
                </div>
              </div>
            ))}
          </div>
          <button className="btn secundario bloco-largo" style={{ marginTop: 16 }} onClick={exportar}>
            <Icone nome="baixar" tamanho={18} /> Exportar CSV
          </button>
        </>
      )}
    </>
  )
}

function Registros () {
  const [linhas, setLinhas] = useState(null)

  useEffect(() => {
    let vivo = true
    lerLogs(300)
      .then(r => vivo && setLinhas(r))
      .catch(() => vivo && setLinhas([]))
    return () => { vivo = false }
  }, [])

  if (linhas === null) return <p className="dica">Carregando…</p>
  if (!linhas.length) {
    return <Vazio titulo="Sem registros" texto="As ações feitas no sistema aparecem aqui." />
  }

  return (
    <div className="lista">
      {linhas.map(l => (
        <div key={l.id} className="cartao" style={{ padding: 12 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <span className="etq">{l.acao}</span>
            <span className="dica">{dataHora(l.criadoEm)}</span>
            <span className="dica" style={{ marginLeft: 'auto' }}>
              {l.usuarioNome} · {NOMES_FUNCAO[l.usuarioFuncao] || l.usuarioFuncao}
            </span>
          </div>
          {l.detalhe && (
            <p style={{ fontSize: 13.5, marginTop: 7, lineHeight: 1.45 }}>{l.detalhe}</p>
          )}
        </div>
      ))}
    </div>
  )
}
