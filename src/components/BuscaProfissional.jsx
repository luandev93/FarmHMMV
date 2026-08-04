import { useMemo, useRef, useState } from 'react'
import { useDados } from '../lib/store'
import { semAcento } from '../lib/utils'

/**
 * Escolha de profissional a partir do cadastro de referência.
 * Digitando o nome, a lista já filtra; o conselho vem junto e evita redigitação.
 * Quem não estiver cadastrado ainda pode ser escrito à mão.
 */
export default function BuscaProfissional ({ tipos, rotulo, escolhido, aoEscolher, aoLimpar }) {
  const { profissionais } = useDados()
  const [texto, setTexto] = useState('')
  const [aberto, setAberto] = useState(false)
  const caixa = useRef(null)

  const resultados = useMemo(() => {
    const busca = semAcento(texto).trim()
    return profissionais
      .filter(p => p.ativo !== false && (!tipos || tipos.includes(p.tipo)))
      .filter(p => !busca || semAcento([p.nome, p.numero, p.conselho, p.especialidade].join(' ')).includes(busca))
      .slice(0, 25)
  }, [profissionais, texto, tipos])

  const registro = p => [p.conselho, p.numero, p.uf].filter(Boolean).join(' ')

  if (escolhido?.nome) {
    return (
      <div className="item-escolhido" style={{ minHeight: 0 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 620 }}>{escolhido.nome}</div>
          {escolhido.conselho && (
            <div className="dica" style={{ marginTop: 2 }}>{escolhido.conselho}</div>
          )}
        </div>
        <button className="x" onClick={aoLimpar} aria-label={'Trocar ' + rotulo}>×</button>
      </div>
    )
  }

  return (
    <div className="busca" ref={caixa}>
      <input
        className="campo"
        value={texto}
        onChange={e => { setTexto(e.target.value); setAberto(true) }}
        onFocus={() => setAberto(true)}
        onBlur={() => setTimeout(() => {
          setAberto(false)
          // O que foi digitado à mão vale como preenchimento livre.
          if (texto.trim()) aoEscolher({ nome: texto.trim(), conselho: '' })
        }, 180)}
        placeholder={`Nome do ${rotulo.toLowerCase()}`}
        autoComplete="off"
        autoCapitalize="words"
      />

      {aberto && resultados.length > 0 && (
        <div className="sugestoes" role="listbox">
          {resultados.map(p => (
            <button
              key={p.id}
              type="button"
              className="sugestao"
              onMouseDown={e => e.preventDefault()}
              onClick={() => {
                aoEscolher({ nome: p.nome, conselho: registro(p), profissionalId: p.id })
                setTexto('')
                setAberto(false)
              }}
            >
              <div className="principal">{p.nome}</div>
              <div className="meta">
                {registro(p) && <span className="etq">{registro(p)}</span>}
                {p.especialidade && <span>{p.especialidade}</span>}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
