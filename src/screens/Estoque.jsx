import { useEffect, useMemo, useState } from 'react'
import { BotaoFiltros, BotaoOlho, Icone, Painel, Vazio, ocultar, useValores } from '../components/ui'
import { useDados } from '../lib/store'
import { movimentosRecentes, itensComMovimento } from '../lib/db'
import { useAuth } from '../lib/auth'
import {
  FILTROS_RAPIDOS, ORDENS_ESTOQUE, baixarCSV, dataBR, dataHora, diasAte, formatarMoeda, formatarNumero,
  precoDe, semAcento, siglaDaForma, passaNoFiltro
} from '../lib/utils'

export default function Estoque () {
  const dados = useDados()
  const { ehFarmaceutico } = useAuth()
  const valores = useValores()
  const [estoqueId, setEstoqueId] = useState('')  // vazio = todos
  const [busca, setBusca] = useState('')
  const [filtro, setFiltro] = useState({ situacao: 'comSaldo', grupoATC: '', grupoFarmacologico: '' })
  const [painelFiltros, setPainelFiltros] = useState(false)
  const [forma, setForma] = useState('')
  const [ordem, setOrdem] = useState('saldoDesc')
  const [movimentos, setMovimentos] = useState(null)

  // Só busca o histórico quando a ordenação por itens parados é pedida.
  useEffect(() => {
    const precisa = ordem === 'semMovimento' || filtro.situacao === 'semMovimento'
    if (!precisa || movimentos) return
    itensComMovimento(365).then(setMovimentos).catch(() => setMovimentos({}))
  }, [ordem, filtro.situacao, movimentos])
  const [detalhe, setDetalhe] = useState(null)

  const saldoDoContexto = item =>
    estoqueId ? dados.saldoDe(estoqueId, item.id) : dados.saldoTotal(item.id)

  /* Só entram no filtro as apresentações que existem de fato no estoque:
     lista de cem formas para escolher entre três é ruído. */
  const formasComSaldo = useMemo(() => {
    const conta = {}
    dados.itens.forEach(i => {
      const f = i.formaFarmaceutica
      if (!f) return
      const saldo = estoqueId ? dados.saldoDe(estoqueId, i.id) : dados.saldoTotal(i.id)
      if (saldo > 0) conta[f] = (conta[f] || 0) + 1
    })
    return Object.entries(conta).sort((a, b) => a[0].localeCompare(b[0], 'pt-BR'))
  }, [dados.itens, dados.saldos, estoqueId])

  useEffect(() => {
    if (forma && !formasComSaldo.some(([f]) => f === forma)) setForma('')
  }, [formasComSaldo, forma])

  const lista = useMemo(() => {
    const termo = semAcento(busca).trim()
    const limite = dados.config.diasAlertaValidade || 90

    return dados.itens
      .filter(i => {
        if (i.pendente) return false
        if (forma && i.formaFarmaceutica !== forma) return false
        if (termo && !semAcento(
          [i.descricao, i.principioAtivo, i.codigo, i.grupoFarmacologico].join(' ')
        ).includes(termo)) return false

        const lotesDoItem = dados.lotes.filter(l =>
          l.itemId === i.id && l.qtd > 0 && l.validade &&
          (!estoqueId || l.estoqueId === estoqueId)
        )

        return passaNoFiltro(i, filtro, {
          saldo: saldoDoContexto(i),
          saldoTotal: dados.saldoTotal(i.id),
          minimo: dados.minimoDoItem(i.id),
          temLoteVencendo: lotesDoItem.some(l => diasAte(l.validade) <= limite),
          temLoteVencido: lotesDoItem.some(l => diasAte(l.validade) < 0),
          semMovimento: movimentos ? !movimentos[i.id] : false
        })
      })
      .sort((a, b) => {
        if (ordem === 'alfabetica') return a.descricao.localeCompare(b.descricao, 'pt-BR')
        if (ordem === 'saldoAsc') return saldoDoContexto(a) - saldoDoContexto(b)
        if (ordem === 'semMovimento') {
          // Sem registro no período vale como "parado desde sempre".
          const ma = movimentos?.[a.id] || 0
          const mb = movimentos?.[b.id] || 0
          return ma - mb || a.descricao.localeCompare(b.descricao, 'pt-BR')
        }
        return saldoDoContexto(b) - saldoDoContexto(a) || a.descricao.localeCompare(b.descricao, 'pt-BR')
      })
  }, [dados, busca, filtro, estoqueId, forma, ordem, movimentos])

  // O valor só é calculado para quem pode vê-lo.
  const valorTotal = useMemo(
    () => (ehFarmaceutico
      ? lista.reduce((s, i) => s + saldoDoContexto(i) * (precoDe(i) || 0), 0)
      : 0),
    [lista, estoqueId, dados.saldos, ehFarmaceutico]
  )

  const semPreco = ehFarmaceutico && lista.filter(i => saldoDoContexto(i) > 0 && !precoDe(i)).length

  function exportar () {
    const comValor = ehFarmaceutico
    const cabecalho = [
      'Código', 'Descrição', 'Tipo', 'Grupo ATC', 'Grupo farmacológico', 'Controle',
      'Unidade', 'Forma farmacêutica', 'Saldo', 'Estoque mínimo', 'Local'
    ]
    if (comValor) cabecalho.push('Preço de contrato', 'Valor em estoque')
    const linhas = [cabecalho]

    lista.forEach(i => {
      const saldo = saldoDoContexto(i)
      const local = estoqueId ? dados.estoques.find(e => e.id === estoqueId)?.nome : 'Todos os locais'
      const linha = [
        i.codigo, i.descricao, i.tipo, i.grupoATC, i.grupoFarmacologico, i.controlado,
        i.unidade, i.formaFarmaceutica || '', saldo, i.estoqueMinimo || 0, local
      ]
      if (comValor) {
        const preco = precoDe(i)
        linha.push(
          preco === null ? '' : String(preco).replace('.', ','),
          preco === null ? '' : String((saldo * preco).toFixed(2)).replace('.', ',')
        )
      }
      linhas.push(linha)
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

      {formasComSaldo.length > 1 && (
        <div className="bloco">
          <select className="campo" value={forma} onChange={e => setForma(e.target.value)}>
            <option value="">Todas as apresentações</option>
            {formasComSaldo.map(([f, n]) => (
              <option key={f} value={f}>
                {f}{siglaDaForma(f) ? ` (${siglaDaForma(f)})` : ''} · {n}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="bloco">
        <select className="campo" value={ordem} onChange={e => setOrdem(e.target.value)}>
          {Object.entries(ORDENS_ESTOQUE).map(([id, nome]) => (
            <option key={id} value={id}>{nome}</option>
          ))}
        </select>
        {ordem === 'semMovimento' && (
          <p className="dica" style={{ marginTop: 6 }}>
            {movimentos === null
              ? 'Lendo o histórico do último ano…'
              : 'Os primeiros da lista não têm movimentação registrada no último ano.'}
          </p>
        )}
      </div>

      <div className="pilulas">
        {FILTROS_RAPIDOS.map(f => (
          <button
            key={f.id} className="pilula"
            aria-pressed={filtro.situacao === f.id}
            onClick={() => setFiltro(a => ({ ...a, situacao: f.id }))}
          >{f.rotulo}</button>
        ))}
        <BotaoFiltros quantidade={contarFiltros(filtro)} aoAbrir={() => setPainelFiltros(true)} />
      </div>

      <div className="indicadores bloco" style={ehFarmaceutico ? undefined : { gridTemplateColumns: '1fr' }}>
        <div className="indicador">
          <div className="n num">{lista.length}</div>
          <div className="r">itens nesta visão</div>
        </div>
        {ehFarmaceutico && (
          <div className="indicador">
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <div className="n num" style={{ fontSize: 19 }}>
                {ocultar(formatarMoeda(valorTotal), valores.visivel)}
              </div>
              <div style={{ marginLeft: 'auto' }}>
                <BotaoOlho visivel={valores.visivel} aoAlternar={valores.alternar} />
              </div>
            </div>
            <div className="r">
              valor de contrato
              {valores.visivel && semPreco ? ` · ${semPreco} sem preço` : ''}
            </div>
          </div>
        )}
      </div>

      {lista.length === 0 ? (
        <Vazio titulo="Nada por aqui" texto="Ajuste a busca ou troque o filtro acima." />
      ) : (
        <div className="lista">
          {lista.map(i => {
            const saldo = saldoDoContexto(i)
            const minimo = dados.minimoDoItem(i.id)
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
                    {i.foraDoContrato && <span className="etq atencao">fora do contrato</span>}
                    {ordem === 'semMovimento' && movimentos && !movimentos[i.id] && (
                      <span className="etq atencao">sem movimento no ano</span>
                    )}
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

      {painelFiltros && (
        <PainelFiltros
          valor={filtro}
          aoAplicar={setFiltro}
          aoFechar={() => setPainelFiltros(false)}
        />
      )}

      {detalhe && (
        <DetalheItem
          item={detalhe} estoqueId={estoqueId}
          mostrarPreco={ehFarmaceutico}
          valores={valores}
          aoFechar={() => setDetalhe(null)}
        />
      )}
    </>
  )
}

function DetalheItem ({ item, estoqueId, mostrarPreco, valores, aoFechar }) {
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
        {mostrarPreco && precoDe(item) !== null && (
          <div>
            <dt className="rotulo" style={{ marginBottom: 2 }}>Preço de contrato</dt>
            <dd style={{ margin: 0, fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span className="num">{ocultar(formatarMoeda(precoDe(item)), valores.visivel)}</span>
              <span className="dica">· contrato {item.contrato || 'não informado'}</span>
              <BotaoOlho visivel={valores.visivel} aoAlternar={valores.alternar} />
            </dd>
          </div>
        )}
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
