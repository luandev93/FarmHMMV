import { useMemo, useState } from 'react'
import { Icone, Painel, Vazio } from '../components/ui'
import { useDados } from '../lib/store'
import { movimentosRecentes } from '../lib/db'
import {
  baixarCSV, dataBR, dataHora, diasAte, formatarMoeda, formatarNumero, semAcento
} from '../lib/utils'

const FILTROS = [
  { id: 'todos', rotulo: 'Tudo' },
  { id: 'comSaldo', rotulo: 'Com saldo' },
  { id: 'minimo', rotulo: 'Abaixo do mínimo' },
  { id: 'validade', rotulo: 'Vencendo' },
  { id: 'controlado', rotulo: 'Controlados' },
  { id: 'frio', rotulo: 'Refrigerados' }
]

export default function Estoque () {
  const dados = useDados()
  const [estoqueId, setEstoqueId] = useState('')  // vazio = todos
  const [busca, setBusca] = useState('')
  const [filtro, setFiltro] = useState('comSaldo')
  const [detalhe, setDetalhe] = useState(null)

  const saldoDoContexto = item =>
    estoqueId ? dados.saldoDe(estoqueId, item.id) : dados.saldoTotal(item.id)

  const lista = useMemo(() => {
    const termo = semAcento(busca).trim()
    const limite = dados.config.diasAlertaValidade || 90

    return dados.itens
      .filter(i => {
        if (termo && !semAcento(
          [i.descricao, i.principioAtivo, i.codigo, i.grupoFarmacologico].join(' ')
        ).includes(termo)) return false

        const saldo = saldoDoContexto(i)
        const minimo = Number(i.estoqueMinimo) || 0

        if (filtro === 'comSaldo') return saldo > 0
        if (filtro === 'minimo') return minimo > 0 && dados.saldoTotal(i.id) < minimo
        if (filtro === 'controlado') return Boolean(i.controlado)
        if (filtro === 'frio') return Boolean(i.termolabil)
        if (filtro === 'validade') {
          return dados.lotes.some(l =>
            l.itemId === i.id && l.qtd > 0 && l.validade &&
            (!estoqueId || l.estoqueId === estoqueId) &&
            diasAte(l.validade) <= limite
          )
        }
        return true
      })
      .sort((a, b) => saldoDoContexto(b) - saldoDoContexto(a) || a.descricao.localeCompare(b.descricao))
  }, [dados, busca, filtro, estoqueId])

  const valorTotal = useMemo(
    () => lista.reduce((s, i) => {
      const preco = i.precoContrato ?? i.precoMax ?? i.precoMin ?? 0
      return s + saldoDoContexto(i) * preco
    }, 0),
    [lista, estoqueId, dados.saldos]
  )

  function exportar () {
    const linhas = [[
      'Código', 'Descrição', 'Tipo', 'Grupo ATC', 'Grupo farmacológico', 'Controle',
      'Unidade', 'Saldo', 'Estoque mínimo', 'Preço ref.', 'Valor em estoque', 'Local'
    ]]
    lista.forEach(i => {
      const preco = i.precoContrato ?? i.precoMax ?? i.precoMin ?? 0
      const saldo = saldoDoContexto(i)
      linhas.push([
        i.codigo, i.descricao, i.tipo, i.grupoATC, i.grupoFarmacologico, i.controlado,
        i.unidade, saldo, i.estoqueMinimo || 0,
        String(preco).replace('.', ','), String((saldo * preco).toFixed(2)).replace('.', ','),
        estoqueId ? dados.estoques.find(e => e.id === estoqueId)?.nome : 'Todos os locais'
      ])
    })
    baixarCSV(`estoque-${new Date().toISOString().slice(0, 10)}.csv`, linhas)
  }

  return (
    <>
      <div className="bloco">
        <select className="campo" value={estoqueId} onChange={e => setEstoqueId(e.target.value)}>
          <option value="">Todos os locais</option>
          {dados.estoques.map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}
        </select>
      </div>

      <div className="bloco">
        <input
          className="campo" value={busca} onChange={e => setBusca(e.target.value)}
          placeholder="Buscar no estoque" type="search" enterKeyHint="search"
        />
      </div>

      <div className="pilulas">
        {FILTROS.map(f => (
          <button
            key={f.id} className="pilula" aria-pressed={filtro === f.id}
            onClick={() => setFiltro(f.id)}
          >{f.rotulo}</button>
        ))}
      </div>

      <div className="indicadores bloco">
        <div className="indicador">
          <div className="n num">{lista.length}</div>
          <div className="r">itens nesta visão</div>
        </div>
        <div className="indicador">
          <div className="n num" style={{ fontSize: 19 }}>{formatarMoeda(valorTotal)}</div>
          <div className="r">valor estimado</div>
        </div>
      </div>

      {lista.length === 0 ? (
        <Vazio titulo="Nada por aqui" texto="Ajuste a busca ou troque o filtro acima." />
      ) : (
        <div className="lista">
          {lista.map(i => {
            const saldo = saldoDoContexto(i)
            const minimo = Number(i.estoqueMinimo) || 0
            const total = dados.saldoTotal(i.id)
            const abaixo = minimo > 0 && total < minimo
            const proximo = dados.lotes
              .filter(l => l.itemId === i.id && l.qtd > 0 && l.validade && (!estoqueId || l.estoqueId === estoqueId))
              .map(l => diasAte(l.validade))
              .sort((a, b) => a - b)[0]

            return (
              <button key={i.id} className="linha-item" onClick={() => setDetalhe(i)}>
                <div className="corpo">
                  <div className="nome">{i.descricao}</div>
                  <div className="meta">
                    <span className="etq">{i.codigo}</span>
                    {i.controlado && <span className="etq controle">{i.controlado}</span>}
                    {i.termolabil && <span className="etq frio">2–8 °C</span>}
                    {abaixo && <span className="etq alerta">abaixo do mínimo ({minimo})</span>}
                    {proximo !== undefined && proximo <= (dados.config.diasAlertaValidade || 90) && (
                      <span className={'etq ' + (proximo < 0 ? 'alerta' : 'atencao')}>
                        {proximo < 0 ? 'vencido' : `vence em ${proximo} d`}
                      </span>
                    )}
                  </div>
                </div>
                <div className="valor">
                  <div className="n num">{formatarNumero(saldo)}</div>
                  <div className="u">{i.unidade?.toLowerCase()}</div>
                </div>
              </button>
            )
          })}
        </div>
      )}

      <button className="btn secundario bloco-largo" style={{ marginTop: 16 }} onClick={exportar}>
        <Icone nome="baixar" tamanho={18} /> Exportar esta lista (CSV)
      </button>

      {detalhe && (
        <DetalheItem item={detalhe} estoqueId={estoqueId} aoFechar={() => setDetalhe(null)} />
      )}
    </>
  )
}

function DetalheItem ({ item, estoqueId, aoFechar }) {
  const dados = useDados()
  const [historico, setHistorico] = useState(null)

  const lotes = dados.lotes
    .filter(l => l.itemId === item.id && l.qtd > 0 && (!estoqueId || l.estoqueId === estoqueId))
    .sort((a, b) => (a.validade || '9999') < (b.validade || '9999') ? -1 : 1)

  async function carregarHistorico () {
    setHistorico('carregando')
    try {
      setHistorico(await movimentosRecentes({ itemId: item.id, limite: 40 }))
    } catch {
      setHistorico([])
    }
  }

  return (
    <Painel titulo={item.descricao} aoFechar={aoFechar}>
      <div className="meta" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
        <span className="etq">{item.codigo}</span>
        {item.grupoATC && <span className="etq">Grupo {item.grupoATC}</span>}
        {item.controlado && <span className="etq controle">{item.controlado}</span>}
        {item.termolabil && <span className="etq frio">2–8 °C</span>}
        {item.altaVigilancia && <span className="etq alerta">alta vigilância</span>}
      </div>

      <dl style={{ margin: '16px 0 0', display: 'grid', gap: 10 }}>
        <Linha titulo="Princípio ativo" valor={item.principioAtivo} />
        <Linha titulo="Apresentação" valor={[item.concentracao, item.formaFarmaceutica].filter(Boolean).join(' · ')} />
        <Linha titulo="Grupo farmacológico" valor={item.grupoFarmacologico} />
        <Linha titulo="Posologia de referência" valor={item.posologia} />
        <Linha titulo="Indicação" valor={item.indicacao} />
        <Linha titulo="Efeitos adversos comuns" valor={item.efeitosAdversos} />
        <Linha titulo="Preço de referência" valor={
          item.precoContrato != null
            ? `${formatarMoeda(item.precoContrato)} (contrato ${item.contrato || '—'})`
            : (item.precoMin != null ? `${formatarMoeda(item.precoMin)} a ${formatarMoeda(item.precoMax)} (PMVG)` : null)
        } />
        <Linha titulo="Estoque mínimo" valor={item.estoqueMinimo ? `${item.estoqueMinimo} ${item.unidade?.toLowerCase()}` : 'não definido'} />
      </dl>

      <h3 style={{ fontSize: 14, marginTop: 20, marginBottom: 8 }}>Saldo por local</h3>
      <table className="tabela">
        <tbody>
          {dados.estoques.map(e => (
            <tr key={e.id}>
              <td>{e.nome}</td>
              <td className="n">{formatarNumero(dados.saldoDe(e.id, item.id))}</td>
            </tr>
          ))}
          <tr>
            <td><b>Total</b></td>
            <td className="n"><b>{formatarNumero(dados.saldoTotal(item.id))}</b></td>
          </tr>
        </tbody>
      </table>

      <h3 style={{ fontSize: 14, marginTop: 20, marginBottom: 8 }}>Lotes em estoque</h3>
      {lotes.length === 0 ? (
        <p className="dica">Nenhum lote com saldo.</p>
      ) : (
        <table className="tabela">
          <thead>
            <tr><th>Lote</th><th>Validade</th><th>Local</th><th style={{ textAlign: 'right' }}>Qtd</th></tr>
          </thead>
          <tbody>
            {lotes.map(l => {
              const d = diasAte(l.validade)
              return (
                <tr key={l.id}>
                  <td>{l.lote || '—'}</td>
                  <td>
                    {dataBR(l.validade)}
                    {d !== null && d <= (dados.config.diasAlertaValidade || 90) && (
                      <span className={'etq ' + (d < 0 ? 'alerta' : 'atencao')} style={{ marginLeft: 6 }}>
                        {d < 0 ? 'vencido' : `${d} d`}
                      </span>
                    )}
                  </td>
                  <td>{dados.estoques.find(e => e.id === l.estoqueId)?.nome || '—'}</td>
                  <td className="n">{formatarNumero(l.qtd)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}

      <h3 style={{ fontSize: 14, marginTop: 20, marginBottom: 8 }}>Últimas movimentações</h3>
      {historico === null && (
        <button className="btn secundario pequeno" onClick={carregarHistorico}>
          <Icone nome="historico" tamanho={16} /> Ver histórico deste item
        </button>
      )}
      {historico === 'carregando' && <p className="dica">Buscando…</p>}
      {Array.isArray(historico) && (
        historico.length === 0
          ? <p className="dica">Sem movimentações registradas.</p>
          : (
            <table className="tabela">
              <tbody>
                {historico.map(m => (
                  <tr key={m.id}>
                    <td style={{ whiteSpace: 'nowrap' }}>{dataHora(m.criadoEm)}</td>
                    <td>
                      {m.tipo}<br />
                      <span className="dica">{m.estoqueNome}{m.estoqueDestinoNome ? ` → ${m.estoqueDestinoNome}` : ''} · {m.usuarioNome}</span>
                    </td>
                    <td className="n">{m.tipo === 'saida' ? '−' : m.tipo === 'entrada' ? '+' : ''}{formatarNumero(m.qtd)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
      )}
    </Painel>
  )
}

function Linha ({ titulo, valor }) {
  if (!valor) return null
  return (
    <div>
      <dt className="rotulo" style={{ marginBottom: 2 }}>{titulo}</dt>
      <dd style={{ margin: 0, fontSize: 14, lineHeight: 1.45 }}>{valor}</dd>
    </div>
  )
}
