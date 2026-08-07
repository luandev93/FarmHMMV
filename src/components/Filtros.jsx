import { Icone, Painel } from './ui'
import { useDados } from '../lib/store'
import { FILTROS_AVANCADOS } from '../lib/utils'

/**
 * Filtros que não cabem na barra horizontal.
 * Fica atrás de um botão para a tela não virar uma régua de rolagem, e o
 * contador avisa quando há recorte ativo — filtrar sem perceber é pior que
 * não filtrar.
 */
export function BotaoFiltros ({ quantidade, aoAbrir }) {
  return (
    <button
      className="pilula"
      aria-pressed={quantidade > 0}
      onClick={aoAbrir}
      style={{ display: 'flex', alignItems: 'center', gap: 6 }}
    >
      <Icone nome="menu" tamanho={15} />
      Filtros{quantidade > 0 ? ` (${quantidade})` : ''}
    </button>
  )
}

export function PainelFiltros ({ valor, aoAplicar, aoFechar, comEstoque = true }) {
  const dados = useDados()

  const trocar = (campo, v) => aoAplicar({ ...valor, [campo]: v })

  /* Só entram nos seletores os grupos que existem de fato: oferecer cem
     opções para escolher entre três é ruído. */
  const presentes = (campo) => {
    const conta = {}
    dados.itens.forEach(i => {
      if (i.pendente || !i[campo]) return
      if (comEstoque && dados.saldoTotal(i.id) <= 0) return
      conta[i[campo]] = (conta[i[campo]] || 0) + 1
    })
    return Object.entries(conta).sort((a, b) => a[0].localeCompare(b[0], 'pt-BR'))
  }

  const gruposATC = presentes('grupoATC')
  const gruposFarmacologicos = presentes('grupoFarmacologico')

  return (
    <Painel
      titulo="Filtros"
      descricao={comEstoque ? 'As listas mostram apenas o que existe em estoque.' : undefined}
      aoFechar={aoFechar}
      rodape={
        <>
          <button
            className="btn secundario"
            onClick={() => aoAplicar({ situacao: 'todos', grupoATC: '', grupoFarmacologico: '' })}
          >Limpar tudo</button>
          <button className="btn" onClick={aoFechar}>Aplicar</button>
        </>
      }
    >
      {Object.entries(FILTROS_AVANCADOS).map(([grupo, opcoes]) => (
        <div key={grupo} style={{ marginTop: 16 }}>
          <label className="rotulo">{grupo}</label>
          <div className="pilulas" style={{ flexWrap: 'wrap', marginBottom: 0 }}>
            {opcoes.map(o => (
              <button
                key={o.id}
                className="pilula"
                aria-pressed={valor.situacao === o.id}
                onClick={() => trocar('situacao', o.id)}
              >{o.rotulo}</button>
            ))}
          </div>
        </div>
      ))}

      {gruposATC.length > 1 && (
        <div style={{ marginTop: 18 }}>
          <label className="rotulo" htmlFor="fatc">Grupo ATC</label>
          <select
            id="fatc" className="campo" value={valor.grupoATC || ''}
            onChange={e => trocar('grupoATC', e.target.value)}
          >
            <option value="">Todos</option>
            {gruposATC.map(([g, n]) => (
              <option key={g} value={g}>{g} — {n} item(ns)</option>
            ))}
          </select>
        </div>
      )}

      {gruposFarmacologicos.length > 1 && (
        <div style={{ marginTop: 12 }}>
          <label className="rotulo" htmlFor="ffarm">Grupo farmacológico</label>
          <select
            id="ffarm" className="campo" value={valor.grupoFarmacologico || ''}
            onChange={e => trocar('grupoFarmacologico', e.target.value)}
          >
            <option value="">Todos</option>
            {gruposFarmacologicos.map(([g, n]) => (
              <option key={g} value={g}>{g} ({n})</option>
            ))}
          </select>
        </div>
      )}
    </Painel>
  )
}

/** Quantos recortes estão ativos, para o contador do botão. */
export const contarFiltros = valor =>
  [valor.situacao && valor.situacao !== 'todos' && valor.situacao !== 'comSaldo',
    valor.grupoATC, valor.grupoFarmacologico].filter(Boolean).length

/** Aplica o recorte escolhido a um item. */
export function passaNoFiltro (item, valor, contexto) {
  const { saldo, saldoTotal, temLoteVencendo, temLoteVencido, minimo, semMovimento } = contexto

  if (valor.grupoATC && item.grupoATC !== valor.grupoATC) return false
  if (valor.grupoFarmacologico && item.grupoFarmacologico !== valor.grupoFarmacologico) return false

  switch (valor.situacao) {
    case 'comSaldo': return saldo > 0
    case 'semSaldo': return saldo <= 0
    case 'minimo': return minimo > 0 && saldoTotal < minimo
    case 'validade': return temLoteVencendo
    case 'vencido': return temLoteVencido
    case 'semMovimento': return semMovimento
    case 'antimicrobiano': return item.grupoATC === 'J'
    case 'usoRestrito': return Boolean(item.usoRestrito)
    case 'altaVigilancia': return Boolean(item.altaVigilancia)
    case 'frio': return Boolean(item.termolabil)
    case 'controlado': return Boolean(item.controlado)
    case 'entorpecente': return String(item.controlado || '').startsWith('A')
    case 'psicotropico': return String(item.controlado || '').startsWith('B')
    case 'outrosControle': return String(item.controlado || '').startsWith('C')
    case 'naoPadronizado': return item.padronizado === false
    case 'foraContrato': return Boolean(item.foraDoContrato)
    case 'semPreco': return !(Number(item.precoContrato) > 0)
    default: return true
  }
}
