import { useEffect, useMemo, useState } from 'react'
import { Icone, Vazio, useAviso } from '../components/ui'
import { useAuth } from '../lib/auth'
import { useDados } from '../lib/store'
import { movimentosRecentes } from '../lib/db'
import {
  CLASSES_ABC, CLASSES_XYZ, baixarCSV, formatarMoeda, formatarNumero, precoDe
} from '../lib/utils'

const MESES_MINIMOS = 6

export default function Relatorios () {
  const dados = useDados()
  const { ehFarmaceutico } = useAuth()
  const avisar = useAviso()

  const [base, setBase] = useState('consumo')   // consumo | contrato
  const [dias, setDias] = useState(180)
  const [saidas, setSaidas] = useState(null)
  const [erro, setErro] = useState('')

  useEffect(() => {
    let vivo = true
    setSaidas(null)
    setErro('')
    movimentosRecentes({ desde: new Date(Date.now() - dias * 86400000), limite: 4000 })
      .then(r => vivo && setSaidas(r.filter(m => ['consumo', 'saida'].includes(m.tipo))))
      .catch(() => {
        if (!vivo) return
        setErro('Não foi possível ler o histórico de movimentações.')
        setSaidas([])
      })
    return () => { vivo = false }
  }, [dias])

  /* ---------------------------------------------------------
     Consumo por item e por mês
     --------------------------------------------------------- */

  const consumo = useMemo(() => {
    const mapa = {}
    ;(saidas || []).forEach(m => {
      const d = m.criadoEm?.toDate ? m.criadoEm.toDate() : new Date()
      const mes = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      if (!mapa[m.itemId]) mapa[m.itemId] = { total: 0, meses: {} }
      mapa[m.itemId].total += m.qtd || 0
      mapa[m.itemId].meses[mes] = (mapa[m.itemId].meses[mes] || 0) + (m.qtd || 0)
    })
    return mapa
  }, [saidas])

  const mesesNoPeriodo = Math.max(1, Math.round(dias / 30))

  /* ---------------------------------------------------------
     Classificação
     --------------------------------------------------------- */

  const analise = useMemo(() => {
    if (!saidas) return null

    const semPreco = []
    const linhas = []

    dados.itens.forEach(item => {
      if (item.pendente) return
      const preco = precoDe(item)
      const c = consumo[item.id]

      // Base contrato: o que a unidade se comprometeu a comprar no período.
      const quantidade = base === 'contrato'
        ? (Number(item.quantidadeContrato) || 0)
        : (c?.total || 0)

      if (quantidade <= 0 && base === 'consumo') return
      if (preco === null) {
        if (quantidade > 0 || base === 'contrato') semPreco.push({ item, quantidade })
        return
      }
      if (quantidade <= 0) return

      // Coeficiente de variação do consumo mensal, base do XYZ.
      const valores = []
      for (let i = 0; i < mesesNoPeriodo; i++) {
        const d = new Date()
        d.setMonth(d.getMonth() - i)
        const mes = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
        valores.push(c?.meses[mes] || 0)
      }
      const media = valores.reduce((s, v) => s + v, 0) / valores.length
      const desvio = Math.sqrt(
        valores.reduce((s, v) => s + (v - media) ** 2, 0) / valores.length
      )
      const cv = media > 0 ? desvio / media : null

      linhas.push({
        item,
        quantidade,
        preco,
        valor: quantidade * preco,
        cv,
        meses: valores
      })
    })

    linhas.sort((a, b) => b.valor - a.valor)
    const totalValor = linhas.reduce((s, l) => s + l.valor, 0)

    let acumulado = 0
    linhas.forEach(l => {
      acumulado += l.valor
      const p = totalValor > 0 ? acumulado / totalValor : 0
      l.acumulado = p
      l.abc = p <= 0.8 ? 'A' : p <= 0.95 ? 'B' : 'C'
      l.xyz = l.cv === null ? '' : l.cv <= 0.5 ? 'X' : l.cv <= 1 ? 'Y' : 'Z'
    })

    return { linhas, totalValor, semPreco }
  }, [saidas, consumo, dados.itens, base, mesesNoPeriodo])

  const historicoSuficiente = mesesNoPeriodo >= MESES_MINIMOS

  function exportar () {
    const l = [[
      'Código', 'Descrição', 'Tipo', 'Grupo ATC', 'Classe ABC', 'Classe XYZ',
      base === 'contrato' ? 'Quantidade contratada' : 'Consumo no período',
      'Preço de contrato', 'Valor', '% acumulado', 'Coeficiente de variação'
    ]]
    analise.linhas.forEach(x => l.push([
      x.item.codigo, x.item.descricao, x.item.tipo, x.item.grupoATC,
      x.abc, x.xyz, x.quantidade,
      String(x.preco).replace('.', ','),
      x.valor.toFixed(2).replace('.', ','),
      (x.acumulado * 100).toFixed(1).replace('.', ','),
      x.cv === null ? '' : x.cv.toFixed(2).replace('.', ',')
    ]))
    analise.semPreco.forEach(x => l.push([
      x.item.codigo, x.item.descricao, x.item.tipo, x.item.grupoATC,
      'SEM PREÇO', '', x.quantidade, '', '', '', ''
    ]))
    baixarCSV(`curva-abc-${new Date().toISOString().slice(0, 10)}.csv`, l)
    avisar('Relatório exportado.', 'ok')
  }

  function exportarSemPreco () {
    const l = [['Código', 'Descrição', 'Preço de contrato', 'Marca', 'Contrato']]
    analise.semPreco.forEach(x => l.push([x.item.codigo, x.item.descricao, '', '', '']))
    baixarCSV('itens-sem-preco.csv', l)
    avisar('Preencha a coluna de preço e importe pelo Catálogo.', 'ok')
  }

  if (!ehFarmaceutico) {
    return <Vazio titulo="Área restrita" texto="O relatório de curva é do farmacêutico e do administrador." />
  }

  return (
    <>
      <div className="cartao bloco">
        <h2 style={{ fontSize: 15, marginBottom: 4 }}>Base do cálculo</h2>
        <p className="dica" style={{ marginBottom: 12 }}>
          {base === 'consumo'
            ? 'Consumo real registrado no período, multiplicado pelo preço de contrato.'
            : 'Quantidade contratada de cada item, multiplicada pelo preço de contrato. Serve enquanto não há histórico.'}
        </p>
        <div className="acao-grupo" style={{ gridTemplateColumns: '1fr 1fr' }}>
          <button
            className="acao-btn consumo" aria-pressed={base === 'consumo'}
            onClick={() => setBase('consumo')} style={{ minHeight: 52 }}
          >Consumo real</button>
          <button
            className="acao-btn consumo" aria-pressed={base === 'contrato'}
            onClick={() => setBase('contrato')} style={{ minHeight: 52 }}
          >Quantidade contratada</button>
        </div>

        {base === 'consumo' && (
          <div style={{ marginTop: 12 }}>
            <label className="rotulo" htmlFor="per">Período</label>
            <select id="per" className="campo" value={dias} onChange={e => setDias(Number(e.target.value))}>
              <option value="30">30 dias</option>
              <option value="90">90 dias</option>
              <option value="180">180 dias</option>
              <option value="365">365 dias</option>
            </select>
          </div>
        )}
      </div>

      {erro && <div className="erro-caixa bloco">{erro}</div>}

      {!analise ? (
        <p className="dica">Calculando…</p>
      ) : analise.linhas.length === 0 ? (
        <Vazio
          titulo="Ainda não há dados para classificar"
          texto={base === 'consumo'
            ? 'Nenhuma saída registrada no período com item que tenha preço de contrato.'
            : 'Nenhum item tem quantidade contratada cadastrada.'}
        />
      ) : (
        <>
          {analise.semPreco.length > 0 && (
            <div className="aviso-caixa bloco">
              <b>{analise.semPreco.length} item(ns) ficaram fora da classificação</b> por não
              terem preço de contrato cadastrado. Eles não entram como classe C — sem preço,
              não dá para saber se são baratos ou caros.
              <button
                className="btn secundario pequeno" style={{ marginTop: 10 }}
                onClick={exportarSemPreco}
              >
                <Icone nome="baixar" tamanho={16} /> Baixar lista para preencher
              </button>
            </div>
          )}

          <div className="indicadores bloco">
            <div className="indicador">
              <div className="n num">{analise.linhas.length}</div>
              <div className="r">itens classificados</div>
            </div>
            <div className="indicador">
              <div className="n num" style={{ fontSize: 19 }}>{formatarMoeda(analise.totalValor)}</div>
              <div className="r">
                {base === 'consumo' ? 'consumido no período' : 'valor contratado'}
              </div>
            </div>
          </div>

          <div className="cartao bloco">
            <h3 style={{ fontSize: 14, marginBottom: 8 }}>Curva ABC</h3>
            <table className="tabela">
              <thead>
                <tr><th>Classe</th><th style={{ textAlign: 'right' }}>Itens</th><th style={{ textAlign: 'right' }}>Valor</th></tr>
              </thead>
              <tbody>
                {['A', 'B', 'C'].map(c => {
                  const g = analise.linhas.filter(l => l.abc === c)
                  const v = g.reduce((s, l) => s + l.valor, 0)
                  return (
                    <tr key={c}>
                      <td>
                        <b>{c}</b>
                        <div className="dica" style={{ marginTop: 2 }}>{CLASSES_ABC[c]}</div>
                      </td>
                      <td className="n">{g.length}</td>
                      <td className="n">{formatarMoeda(v)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="cartao bloco">
            <h3 style={{ fontSize: 14, marginBottom: 8 }}>Curva XYZ</h3>
            {!historicoSuficiente ? (
              <div className="aviso-caixa">
                A classificação por previsibilidade precisa de pelo menos {MESES_MINIMOS} meses
                de histórico mensal. O período escolhido cobre {mesesNoPeriodo}.
                Amplie o período ou volte quando houver mais movimentação registrada.
              </div>
            ) : (
              <table className="tabela">
                <thead>
                  <tr><th>Classe</th><th style={{ textAlign: 'right' }}>Itens</th></tr>
                </thead>
                <tbody>
                  {['X', 'Y', 'Z'].map(c => (
                    <tr key={c}>
                      <td>
                        <b>{c}</b>
                        <div className="dica" style={{ marginTop: 2 }}>{CLASSES_XYZ[c]}</div>
                      </td>
                      <td className="n">{analise.linhas.filter(l => l.xyz === c).length}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <h3 style={{ fontSize: 14, marginBottom: 8 }}>Itens por valor</h3>
          <div className="lista">
            {analise.linhas.slice(0, 80).map(l => (
              <div key={l.item.id} className="cartao" style={{ padding: 12 }}>
                <div style={{ fontSize: 14, fontWeight: 620, lineHeight: 1.3 }}>{l.item.descricao}</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6, fontSize: 12, color: 'var(--tinta-fraca)' }}>
                  <span className={'etq ' + (l.abc === 'A' ? 'alerta' : l.abc === 'B' ? 'atencao' : '')}>
                    {l.abc}{l.xyz && historicoSuficiente ? l.xyz : ''}
                  </span>
                  <span className="etq">{l.item.codigo}</span>
                  <span>{formatarNumero(l.quantidade)} {l.item.unidade?.toLowerCase()}</span>
                  <span>{formatarMoeda(l.valor)}</span>
                  <span>{(l.acumulado * 100).toFixed(1)}% acum.</span>
                </div>
              </div>
            ))}
          </div>
          {analise.linhas.length > 80 && (
            <p className="dica" style={{ marginTop: 10 }}>
              Mostrando os 80 de maior valor. O arquivo traz todos.
            </p>
          )}

          <button className="btn secundario bloco-largo" style={{ marginTop: 16 }} onClick={exportar}>
            <Icone nome="baixar" tamanho={18} /> Exportar relatório (CSV)
          </button>
        </>
      )}
    </>
  )
}
