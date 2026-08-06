import { useState } from 'react'
import { Icone } from '../components/ui'
import RelatorioPeriodo from './RelatorioPeriodo'
import RelatorioABC from './RelatorioABC'

const RELATORIOS = {
  periodo: {
    titulo: 'Estoque por período',
    descricao: 'Saldo, consumo, entradas e descartes mês a mês. Sai em planilha ou PDF.',
    icone: 'historico',
    comp: RelatorioPeriodo
  },
  abc: {
    titulo: 'Curva ABC e XYZ',
    descricao: 'Classificação por valor e por previsibilidade da demanda.',
    icone: 'grafico',
    comp: RelatorioABC
  }
}

export default function Relatorios () {
  const [aberto, setAberto] = useState('')

  if (aberto) {
    const Componente = RELATORIOS[aberto].comp
    return (
      <>
        <button
          className="btn fantasma pequeno nao-imprimir"
          style={{ padding: 0, marginBottom: 12 }}
          onClick={() => setAberto('')}
        >
          <Icone nome="volta" tamanho={16} /> Todos os relatórios
        </button>
        <Componente />
      </>
    )
  }

  return (
    <div className="menu-lista">
      {Object.entries(RELATORIOS).map(([id, r]) => (
        <button key={id} className="menu-item" onClick={() => setAberto(id)}>
          <Icone nome={r.icone} />
          <span>
            {r.titulo}
            <small>{r.descricao}</small>
          </span>
          <Icone nome="seta" tamanho={18} className="seta" />
        </button>
      ))}
    </div>
  )
}
