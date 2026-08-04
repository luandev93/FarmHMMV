import { useEffect, useMemo, useRef, useState } from 'react'
import { useDados } from '../lib/store'
import { semAcento, formatarNumero } from '../lib/utils'
import { Icone } from './ui'

/**
 * Busca do catálogo: a lista aparece já nas primeiras letras.
 * Procura por descrição, princípio ativo, código, grupo farmacológico e marca.
 */
export default function BuscaItem ({ estoqueId, aoEscolher, escolhido, aoLimpar, autoFoco }) {
  const { indice, saldoDe, saldoTotal } = useDados()
  const [texto, setTexto] = useState('')
  const [aberto, setAberto] = useState(false)
  const [ativa, setAtiva] = useState(0)
  const caixa = useRef(null)
  const campo = useRef(null)

  useEffect(() => {
    if (autoFoco && !escolhido) campo.current?.focus()
  }, [autoFoco, escolhido])

  useEffect(() => {
    const fora = e => { if (caixa.current && !caixa.current.contains(e.target)) setAberto(false) }
    document.addEventListener('mousedown', fora)
    return () => document.removeEventListener('mousedown', fora)
  }, [])

  const resultados = useMemo(() => {
    const busca = semAcento(texto).trim()
    if (busca.length < 1) return []
    const termos = busca.split(/\s+/)
    return indice
      .filter(({ item, chave }) => item.ativo !== false && termos.every(t => chave.includes(t)))
      .slice(0, 40)
      .map(r => r.item)
  }, [texto, indice])

  useEffect(() => { setAtiva(0) }, [texto])

  function escolher (item) {
    aoEscolher(item)
    setTexto('')
    setAberto(false)
  }

  function tecla (e) {
    if (!aberto || !resultados.length) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setAtiva(i => Math.min(i + 1, resultados.length - 1)) }
    if (e.key === 'ArrowUp') { e.preventDefault(); setAtiva(i => Math.max(i - 1, 0)) }
    if (e.key === 'Enter') { e.preventDefault(); escolher(resultados[ativa]) }
    if (e.key === 'Escape') setAberto(false)
  }

  if (escolhido) {
    const saldo = estoqueId ? saldoDe(estoqueId, escolhido.id) : saldoTotal(escolhido.id)
    return (
      <div className="item-escolhido">
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 14.5, fontWeight: 650, lineHeight: 1.3 }}>{escolhido.descricao}</div>
          <div className="sugestao">
            <div className="meta" style={{ padding: 0, marginTop: 5 }}>
              <span className="etq">{escolhido.codigo}</span>
              <span className="num">Saldo: <b>{formatarNumero(saldo)}</b> {escolhido.unidade?.toLowerCase()}</span>
              {escolhido.controlado && <span className="etq controle">{escolhido.controlado}</span>}
              {escolhido.termolabil && <span className="etq frio">2–8 °C</span>}
            </div>
          </div>
        </div>
        <button className="x" onClick={aoLimpar} aria-label="Trocar item">×</button>
      </div>
    )
  }

  return (
    <div className="busca" ref={caixa}>
      <input
        ref={campo}
        className="campo"
        value={texto}
        onChange={e => { setTexto(e.target.value); setAberto(true) }}
        onFocus={() => setAberto(true)}
        onKeyDown={tecla}
        placeholder="Digite o nome, o princípio ativo ou o código"
        autoComplete="off"
        autoCorrect="off"
        spellCheck="false"
        enterKeyHint="search"
        aria-label="Buscar item no catálogo"
      />

      {aberto && texto.trim().length > 0 && (
        <div className="sugestoes" role="listbox">
          {resultados.length === 0 && (
            <div style={{ padding: '16px 14px' }} className="dica">
              Nenhum item encontrado. Verifique a grafia ou cadastre o item no catálogo.
            </div>
          )}
          {resultados.map((item, i) => {
            const saldo = estoqueId ? saldoDe(estoqueId, item.id) : saldoTotal(item.id)
            return (
              <button
                key={item.id}
                type="button"
                className="sugestao"
                data-ativa={i === ativa}
                onMouseEnter={() => setAtiva(i)}
                onClick={() => escolher(item)}
                role="option"
                aria-selected={i === ativa}
              >
                <div className="principal">{destacar(item.descricao, texto)}</div>
                <div className="meta">
                  <span className="etq">{item.codigo}</span>
                  <span className="num">{formatarNumero(saldo)} {item.unidade?.toLowerCase()}</span>
                  {item.grupoFarmacologico && <span>{item.grupoFarmacologico}</span>}
                  {item.controlado && <span className="etq controle">{item.controlado}</span>}
                  {item.termolabil && <span className="etq frio">2–8 °C</span>}
                </div>
              </button>
            )
          })}
        </div>
      )}

      <div className="dica" style={{ marginTop: 6, display: 'flex', gap: 6, alignItems: 'center' }}>
        <Icone nome="lupa" tamanho={14} />
        A lista aparece nas primeiras letras. Toque para escolher.
      </div>
    </div>
  )
}

/** Marca no texto o trecho que a pessoa digitou. */
function destacar (texto, busca) {
  const alvo = semAcento(busca).trim().split(/\s+/)[0]
  if (!alvo) return texto
  const pos = semAcento(texto).indexOf(alvo)
  if (pos < 0) return texto
  return (
    <>
      {texto.slice(0, pos)}
      <mark>{texto.slice(pos, pos + alvo.length)}</mark>
      {texto.slice(pos + alvo.length)}
    </>
  )
}
