import { useEffect, useMemo, useState } from 'react'
import { BotaoOlho, Icone, Vazio, ocultar, useAviso, useValores } from '../components/ui'
import { useDados } from '../lib/store'
import { consumoPorItem } from '../lib/db'
import { useAuth } from '../lib/auth'
import { baixarCSV, formatarMoeda, formatarNumero, precoDe } from '../lib/utils'

/**
 * Sugestão de compra combinando as duas referências:
 *   necessidade = maior valor entre
 *      (a) o estoque mínimo cadastrado no item
 *      (b) consumo diário médio × dias de cobertura × fator de segurança
 *   pedido = necessidade − saldo atual
 */
export default function Pedido () {
  const dados = useDados()
  const avisar = useAviso()
  const { ehFarmaceutico } = useAuth()
  const valores = useValores()

  const [dias, setDias] = useState(dados.config.diasCobertura || 30)
  const [historico, setHistorico] = useState(dados.config.diasHistoricoConsumo || 90)
  const [fator, setFator] = useState(dados.config.fatorSeguranca || 1.2)
  const [consumo, setConsumo] = useState(null)
  const [ajustes, setAjustes] = useState({})
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')

  useEffect(() => {
    let vivo = true
    setCarregando(true)
    setErro('')
    consumoPorItem(Number(historico) || 90)
      .then(r => { if (vivo) { setConsumo(r); setCarregando(false) } })
      .catch(e => {
        if (!vivo) return
        setErro(
          e?.code === 'failed-precondition'
            ? 'O Firestore ainda está criando o índice das movimentações. Aguarde um minuto e recarregue.'
            : 'Não foi possível ler o histórico de consumo.'
        )
        setCarregando(false)
      })
    return () => { vivo = false }
  }, [historico])

  const linhas = useMemo(() => {
    if (!consumo) return []
    return dados.itens
      .filter(i => i.ativo !== false)
      .map(i => {
        const saldo = dados.saldoTotal(i.id)
        const diario = consumo[i.id]?.diario || 0
        const porConsumo = diario * Number(dias) * Number(fator)
        const minimo = Number(i.estoqueMinimo) || 0
        const necessidade = Math.max(minimo, porConsumo)
        const sugerido = Math.max(0, Math.ceil(necessidade - saldo))
        const preco = precoDe(i) || 0
        const cobertura = diario > 0 ? saldo / diario : null
        return { item: i, saldo, diario, minimo, necessidade, sugerido, preco, cobertura }
      })
      .filter(l => l.sugerido > 0)
      .sort((a, b) => {
        const ca = a.cobertura === null ? 9999 : a.cobertura
        const cb = b.cobertura === null ? 9999 : b.cobertura
        return ca - cb
      })
  }, [consumo, dados, dias, fator])

  const quantidadeFinal = l => {
    const v = ajustes[l.item.id]
    return v === undefined || v === '' ? l.sugerido : Number(v)
  }

  const totalEstimado = linhas.reduce((s, l) => s + quantidadeFinal(l) * l.preco, 0)

  function exportar () {
    const cab = [[
      'Código', 'Descrição', 'Unidade', 'Tipo', 'Grupo ATC', 'Grupo farmacológico',
      'Saldo atual', 'Consumo diário médio', 'Cobertura (dias)', 'Estoque mínimo',
      'Quantidade a pedir', 'Preço ref.', 'Total estimado'
    ]]
    linhas.forEach(l => {
      const q = quantidadeFinal(l)
      cab.push([
        l.item.codigo, l.item.descricao, l.item.unidade, l.item.tipo,
        l.item.grupoATC, l.item.grupoFarmacologico,
        l.saldo, l.diario.toFixed(2).replace('.', ','),
        l.cobertura === null ? '' : l.cobertura.toFixed(1).replace('.', ','),
        l.minimo, q
      ])
    })
    baixarCSV(`pedido-${new Date().toISOString().slice(0, 10)}.csv`, cab)
    avisar('Arquivo do pedido gerado.', 'ok')
  }

  async function copiar () {
    const texto = linhas
      .map(l => `${l.item.codigo} — ${l.item.descricao}: ${quantidadeFinal(l)} ${l.item.unidade?.toLowerCase()}`)
      .join('\n')
    try {
      await navigator.clipboard.writeText(texto)
      avisar('Pedido copiado.', 'ok')
    } catch {
      avisar('Não foi possível copiar neste aparelho.', 'erro')
    }
  }

  return (
    <>
      <div className="cartao bloco">
        <h2 style={{ fontSize: 15, marginBottom: 4 }}>Como o cálculo é feito</h2>
        <p className="dica">
          A necessidade é o maior valor entre o estoque mínimo do item e o consumo médio
          multiplicado pelo período. O que já existe em estoque é descontado.
        </p>
        <div className="linha-campos" style={{ marginTop: 12 }}>
          <div>
            <label className="rotulo" htmlFor="dias">Cobrir quantos dias</label>
            <input
              id="dias" className="campo num" inputMode="numeric" value={dias}
              onChange={e => setDias(e.target.value.replace(/\D/g, ''))}
            />
          </div>
          <div>
            <label className="rotulo" htmlFor="hist">Consumo dos últimos</label>
            <select id="hist" className="campo" value={historico} onChange={e => setHistorico(e.target.value)}>
              <option value="30">30 dias</option>
              <option value="60">60 dias</option>
              <option value="90">90 dias</option>
              <option value="180">180 dias</option>
              <option value="365">365 dias</option>
            </select>
          </div>
        </div>
        <div style={{ marginTop: 12 }}>
          <label className="rotulo" htmlFor="fator">Margem de segurança</label>
          <select id="fator" className="campo" value={fator} onChange={e => setFator(Number(e.target.value))}>
            <option value="1">Sem margem</option>
            <option value="1.1">10% a mais</option>
            <option value="1.2">20% a mais</option>
            <option value="1.3">30% a mais</option>
            <option value="1.5">50% a mais</option>
          </select>
        </div>
      </div>

      {erro && <div className="aviso-caixa bloco">{erro}</div>}

      {carregando ? (
        <p className="dica">Calculando com base no histórico…</p>
      ) : linhas.length === 0 ? (
        <Vazio
          titulo="Nenhum item precisa de reposição"
          texto="Com o período e a margem escolhidos, o saldo atual cobre a necessidade. Defina o estoque mínimo dos itens no catálogo para refinar a sugestão."
        />
      ) : (
        <>
          <div className="indicadores bloco" style={ehFarmaceutico ? undefined : { gridTemplateColumns: '1fr' }}>
            <div className="indicador">
              <div className="n num">{linhas.length}</div>
              <div className="r">itens a pedir</div>
            </div>
            {ehFarmaceutico && (
              <div className="indicador">
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <div className="n num" style={{ fontSize: 19 }}>
                    {ocultar(formatarMoeda(totalEstimado), valores.visivel)}
                  </div>
                  <div style={{ marginLeft: 'auto' }}>
                    <BotaoOlho visivel={valores.visivel} aoAlternar={valores.alternar} />
                  </div>
                </div>
                <div className="r">custo de contrato · não sai no arquivo</div>
              </div>
            )}
          </div>

          <div className="lista">
            {linhas.map(l => (
              <div key={l.item.id} className="cartao" style={{ padding: 12 }}>
                <div style={{ fontSize: 14, fontWeight: 620, lineHeight: 1.3 }}>{l.item.descricao}</div>
                <div className="meta" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6, fontSize: 12, color: 'var(--tinta-fraca)' }}>
                  <span className="etq">{l.item.codigo}</span>
                  <span>saldo {formatarNumero(l.saldo)}</span>
                  <span>consumo {l.diario.toFixed(2).replace('.', ',')}/dia</span>
                  {l.cobertura !== null && (
                    <span className={'etq ' + (l.cobertura < 7 ? 'alerta' : l.cobertura < 15 ? 'atencao' : '')}>
                      cobre {l.cobertura.toFixed(0)} d
                    </span>
                  )}
                  {l.minimo > 0 && <span>mínimo {l.minimo}</span>}
                </div>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 10 }}>
                  <label className="rotulo" style={{ margin: 0 }} htmlFor={'q' + l.item.id}>Pedir</label>
                  <input
                    id={'q' + l.item.id}
                    className="campo num"
                    style={{ maxWidth: 120, minHeight: 44 }}
                    inputMode="numeric"
                    value={ajustes[l.item.id] ?? l.sugerido}
                    onChange={e => setAjustes(a => ({ ...a, [l.item.id]: e.target.value.replace(/\D/g, '') }))}
                  />
                  <span className="dica">{l.item.unidade?.toLowerCase()}</span>
                  {ehFarmaceutico && l.preco > 0 && (
                    <span className="dica num" style={{ marginLeft: 'auto' }}>
                      {ocultar(
                        `${formatarMoeda(l.preco)} · ${formatarMoeda(quantidadeFinal(l) * l.preco)}`,
                        valores.visivel
                      )}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="acoes" style={{ marginTop: 16 }}>
            <button className="btn secundario" onClick={copiar}>Copiar lista</button>
            <button className="btn" onClick={exportar}>
              <Icone nome="baixar" tamanho={18} /> Baixar CSV
            </button>
          </div>
        </>
      )}
    </>
  )
}
