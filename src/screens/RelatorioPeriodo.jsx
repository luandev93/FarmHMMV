import { useEffect, useMemo, useState } from 'react'
import { Icone, Vazio, useAviso } from '../components/ui'
import { useDados } from '../lib/store'
import { movimentosRecentes } from '../lib/db'
import {
  CONTEUDOS_PERIODO, TIPOS_ITEM, baixarCSV, formatarMoeda, formatarNumero,
  hojeISO, mesesEntre, nomeDoMes, precoDe
} from '../lib/utils'

/** Como cada tipo de movimentação afeta o saldo de um local. */
const SOMA = ['entrada', 'devolucao']
const SUBTRAI = ['consumo', 'saida', 'descarte']

export default function RelatorioPeriodo () {
  const dados = useDados()
  const avisar = useAviso()

  const hoje = hojeISO()
  const [inicio, setInicio] = useState(hoje.slice(0, 8) + '01')
  const [fim, setFim] = useState(hoje)
  const [tipo, setTipo] = useState('')
  const [estoqueId, setEstoqueId] = useState('')
  const [conteudo, setConteudo] = useState('consumo')
  const [ordem, setOrdem] = useState('alfabetica')
  const [movimentos, setMovimentos] = useState(null)
  const [gerado, setGerado] = useState(false)
  const [erro, setErro] = useState('')

  const meses = useMemo(() => mesesEntre(inicio, fim), [inicio, fim])

  async function gerar () {
    if (inicio > fim) return setErro('A data inicial precisa vir antes da final.')
    setErro('')
    setMovimentos(null)
    setGerado(true)
    try {
      // Busca desde o início do período até hoje: o saldo é reconstruído
      // para trás a partir do saldo atual.
      const desde = new Date(inicio + 'T00:00:00')
      const r = await movimentosRecentes({ desde, limite: 4000 })
      setMovimentos(r)
    } catch (e) {
      setErro('Não foi possível ler as movimentações do período.')
      setMovimentos([])
    }
  }

  const linhas = useMemo(() => {
    if (!movimentos) return []

    const porItem = {}
    const chaveMes = m => {
      const d = m.criadoEm?.toDate ? m.criadoEm.toDate() : null
      if (!d) return null
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    }

    movimentos.forEach(m => {
      if (estoqueId && m.estoqueId !== estoqueId && m.estoqueDestinoId !== estoqueId) return
      const mes = chaveMes(m)
      if (!mes) return

      if (!porItem[m.itemId]) porItem[m.itemId] = {}
      if (!porItem[m.itemId][mes]) {
        porItem[m.itemId][mes] = {
          consumo: 0, entradas: 0, descartes: 0, recebidas: 0, enviadas: 0, movimento: 0
        }
      }
      const c = porItem[m.itemId][mes]
      const q = m.qtd || 0

      if (m.tipo === 'transferencia') {
        // Do ponto de vista de um local, a mesma transferência é saída num e entrada no outro.
        if (!estoqueId || m.estoqueId === estoqueId) { c.enviadas += q; c.movimento -= q }
        if (!estoqueId || m.estoqueDestinoId === estoqueId) { c.recebidas += q; c.movimento += q }
        if (!estoqueId) c.movimento = 0   // sem filtro de local, transferência não muda o total
      } else if (SOMA.includes(m.tipo)) {
        c.entradas += q
        c.movimento += q
      } else if (SUBTRAI.includes(m.tipo)) {
        if (m.tipo === 'descarte') c.descartes += q
        else c.consumo += q
        c.movimento -= q
      }
    })

    const saldoAtual = i => estoqueId ? dados.saldoDe(estoqueId, i.id) : dados.saldoTotal(i.id)

    const saida = dados.itens
      .filter(i => !i.pendente)
      .filter(i => !tipo || i.tipo === tipo)
      .filter(i => porItem[i.id] || saldoAtual(i) > 0)
      .map(i => {
        const preco = precoDe(i) || 0

        /* O saldo de cada mês vem do saldo de hoje, desfazendo as movimentações
           de trás para frente. Onde não há histórico, fica em branco. */
        const saldos = {}
        let corrente = saldoAtual(i)
        const invertidos = [...meses].reverse()
        invertidos.forEach((mes, k) => {
          if (k > 0) {
            const posterior = invertidos[k - 1]
            corrente -= (porItem[i.id]?.[posterior]?.movimento || 0)
          }
          saldos[mes] = corrente
        })

        const celulas = {}
        meses.forEach(mes => {
          const c = porItem[i.id]?.[mes]
          celulas[mes] = {
            saldo: saldos[mes],
            consumo: c?.consumo || 0,
            entradas: c?.entradas || 0,
            descartes: c?.descartes || 0,
            recebidas: c?.recebidas || 0,
            enviadas: c?.enviadas || 0,
            valor: (c?.consumo || 0) * preco
          }
        })

        const total = meses.reduce((s, mes) => s + (celulas[mes][conteudo === 'tudo' ? 'consumo' : conteudo] || 0), 0)
        return { item: i, celulas, total, semPreco: preco === 0 }
      })

    if (ordem === 'maior') saida.sort((a, b) => b.total - a.total)
    else saida.sort((a, b) => a.item.descricao.localeCompare(b.item.descricao, 'pt-BR'))

    return saida
  }, [movimentos, dados, meses, tipo, estoqueId, conteudo, ordem])

  const colunas = conteudo === 'tudo'
    ? ['saldo', 'entradas', 'consumo', 'descartes']
    : [conteudo]

  const formatar = (celula, campo) =>
    campo === 'valor' ? formatarMoeda(celula.valor) : formatarNumero(celula[campo])

  function exportar () {
    const cab = ['Código', 'Descrição', 'Unidade']
    meses.forEach(m => colunas.forEach(c => {
      cab.push(colunas.length > 1 ? `${nomeDoMes(m)} ${CONTEUDOS_PERIODO[c]}` : nomeDoMes(m))
    }))
    const l = [cab]
    linhas.forEach(x => {
      const linha = [x.item.codigo, x.item.descricao, x.item.unidade]
      meses.forEach(m => colunas.forEach(c => {
        const v = x.celulas[m][c]
        linha.push(c === 'valor' ? String(v.toFixed(2)).replace('.', ',') : v)
      }))
      l.push(linha)
    })
    baixarCSV(`estoque-${inicio}-a-${fim}.csv`, l)
    avisar('Planilha gerada.', 'ok')
  }

  const local = estoqueId
    ? dados.estoques.find(e => e.id === estoqueId)?.nome
    : 'Todos os locais'

  return (
    <>
      <div className="cartao bloco nao-imprimir">
        <div className="linha-campos">
          <div>
            <label className="rotulo" htmlFor="de">De</label>
            <input id="de" className="campo" type="date" value={inicio} onChange={e => setInicio(e.target.value)} />
          </div>
          <div>
            <label className="rotulo" htmlFor="ate">Até</label>
            <input id="ate" className="campo" type="date" value={fim} onChange={e => setFim(e.target.value)} />
          </div>
        </div>

        <div style={{ marginTop: 12 }}>
          <label className="rotulo" htmlFor="cont">O que mostrar em cada mês</label>
          <select id="cont" className="campo" value={conteudo} onChange={e => setConteudo(e.target.value)}>
            {Object.entries(CONTEUDOS_PERIODO).map(([id, nome]) => (
              <option key={id} value={id}>{nome}</option>
            ))}
          </select>
        </div>

        <div className="linha-campos" style={{ marginTop: 12 }}>
          <div>
            <label className="rotulo" htmlFor="tp">Tipo de item</label>
            <select id="tp" className="campo" value={tipo} onChange={e => setTipo(e.target.value)}>
              <option value="">Todos</option>
              {Object.entries(TIPOS_ITEM).map(([id, nome]) => <option key={id} value={id}>{nome}</option>)}
            </select>
          </div>
          <div>
            <label className="rotulo" htmlFor="lc">Local</label>
            <select id="lc" className="campo" value={estoqueId} onChange={e => setEstoqueId(e.target.value)}>
              <option value="">Todos</option>
              {dados.estoques.map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}
            </select>
          </div>
        </div>

        <div style={{ marginTop: 12 }}>
          <label className="rotulo" htmlFor="or">Ordem</label>
          <select id="or" className="campo" value={ordem} onChange={e => setOrdem(e.target.value)}>
            <option value="alfabetica">Alfabética</option>
            <option value="maior">Maior valor no período</option>
          </select>
        </div>

        {erro && <div className="erro-caixa" style={{ marginTop: 12 }}>{erro}</div>}

        <button className="btn bloco-largo" style={{ marginTop: 14 }} onClick={gerar}>
          <Icone nome="grafico" tamanho={18} /> Gerar relatório
        </button>
      </div>

      {gerado && movimentos === null && <p className="dica">Lendo as movimentações…</p>}

      {gerado && movimentos !== null && (
        linhas.length === 0 ? (
          <Vazio
            titulo="Nada no período"
            texto="Nenhum item com saldo ou movimentação entre as datas escolhidas."
          />
        ) : (
          <>
            <div className="cabecalho-impressao">
              <h1>{dados.config.nomeUnidade || 'Farmácia'} — estoque por período</h1>
              <p>
                {CONTEUDOS_PERIODO[conteudo]} · {local} ·
                {' '}de {inicio.split('-').reverse().join('/')} a {fim.split('-').reverse().join('/')}
                {tipo ? ` · ${TIPOS_ITEM[tipo]}` : ''}
              </p>
            </div>

            <p className="dica bloco nao-imprimir">
              {linhas.length} item(ns) · {meses.length} mês(es)
              {conteudo === 'saldo' && ' · o saldo é reconstruído a partir do saldo atual'}
            </p>

            <div className="tabela-larga cartao" style={{ padding: 0 }}>
              <table className="tabela">
                <thead>
                  <tr>
                    <th>Item</th>
                    {meses.map(m => (
                      <th key={m} colSpan={colunas.length} style={{ textAlign: 'right' }}>
                        {nomeDoMes(m)}
                      </th>
                    ))}
                  </tr>
                  {colunas.length > 1 && (
                    <tr>
                      <th />
                      {meses.map(m => colunas.map(c => (
                        <th key={m + c} style={{ textAlign: 'right', fontSize: 10 }}>
                          {CONTEUDOS_PERIODO[c].split(' ')[0]}
                        </th>
                      )))}
                    </tr>
                  )}
                </thead>
                <tbody>
                  {linhas.map(x => (
                    <tr key={x.item.id}>
                      <td>
                        {x.item.descricao}
                        <div className="dica" style={{ fontSize: 11 }}>
                          {x.item.codigo} · {x.item.unidade?.toLowerCase()}
                          {conteudo === 'valor' && x.semPreco && ' · sem preço'}
                        </div>
                      </td>
                      {meses.map(m => colunas.map(c => (
                        <td key={m + c} className="n">{formatar(x.celulas[m], c)}</td>
                      )))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {conteudo === 'valor' && linhas.some(x => x.semPreco) && (
              <div className="aviso-caixa bloco nao-imprimir" style={{ marginTop: 12 }}>
                Alguns itens não têm preço de contrato cadastrado e aparecem zerados.
                O total do período fica incompleto.
              </div>
            )}

            <div className="rodape-impressao">
              Emitido em {new Date().toLocaleString('pt-BR')}
            </div>

            <div className="acoes nao-imprimir" style={{ marginTop: 16 }}>
              <button className="btn secundario" onClick={exportar}>
                <Icone nome="baixar" tamanho={18} /> Planilha
              </button>
              <button className="btn" onClick={() => window.print()}>
                Imprimir ou salvar PDF
              </button>
            </div>

            <p className="dica nao-imprimir" style={{ marginTop: 8, textAlign: 'center' }}>
              Na caixa de impressão, escolha "Salvar como PDF" para compartilhar.
            </p>
          </>
        )
      )}
    </>
  )
}
