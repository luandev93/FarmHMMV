import { createContext, useCallback, useContext, useEffect, useState } from 'react'

/* =========================================================
   Ícones (traçado único, herdam a cor do texto)
   ========================================================= */

const TRACOS = {
  entrada: 'M12 5v14M5 12h14',
  saida: 'M5 12h14',
  transferencia: 'M7 8h13l-3-3M17 16H4l3 3',
  inventario: 'M9 11l3 3 8-8M20 12v7a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h9',
  caixa: 'M20 8v11a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V8M2 8h20l-2-4H4L2 8zM10 12h4',
  pedido: 'M4 5h2l2.5 10h9L20 8H7M9 19a1 1 0 1 0 0 .01M17 19a1 1 0 1 0 0 .01',
  menu: 'M4 7h16M4 12h16M4 17h16',
  lupa: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3',
  lixeira: 'M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13',
  lapis: 'M4 20h4L20 8l-4-4L4 16v4zM14 6l4 4',
  seta: 'M9 6l6 6-6 6',
  volta: 'M15 6l-6 6 6 6',
  alerta: 'M12 9v4M12 17h.01M10.3 4.3 2.6 18a2 2 0 0 0 1.7 3h15.4a2 2 0 0 0 1.7-3L13.7 4.3a2 2 0 0 0-3.4 0z',
  relogio: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2',
  bolo: 'M4 20h16M5 20v-6a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v6M12 12V9M12 6V5',
  usuarios: 'M16 20v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2M9.5 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM21 20v-2a4 4 0 0 0-3-3.9M16.5 4.1a4 4 0 0 1 0 7.8',
  engrenagem: 'M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1A1.6 1.6 0 0 0 9 19.4a1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1A1.6 1.6 0 0 0 4.6 9a1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z',
  sair: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9',
  historico: 'M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5M12 8v4l3 2',
  baixar: 'M12 3v12M7 11l5 5 5-5M4 21h16',
  certo: 'M4 12.5 9 18 20 6',
  grafico: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  frasco: 'M9 3h6M10 3v6L5.5 17a2.5 2.5 0 0 0 2.2 4h8.6a2.5 2.5 0 0 0 2.2-4L14 9V3',
  cadeado: 'M6 11h12a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1zM8 11V7a4 4 0 1 1 8 0v4',
  etiqueta: 'M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9-9-9zM7.5 7.5h.01',
  pessoa: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1'
}

export function Icone ({ nome, tamanho = 22, ...resto }) {
  const d = TRACOS[nome]
  if (!d) return null
  return (
    <svg
      width={tamanho} height={tamanho} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true" {...resto}
    >
      {d.split(' M').map((parte, i) => (
        <path key={i} d={i === 0 ? parte : 'M' + parte} />
      ))}
    </svg>
  )
}

/* =========================================================
   Avisos flutuantes
   ========================================================= */

const ContextoAviso = createContext(() => {})

export function ProvedorAviso ({ children }) {
  const [aviso, setAviso] = useState(null)

  const avisar = useCallback((texto, tom = 'ok') => {
    setAviso({ texto, tom, id: Date.now() })
  }, [])

  useEffect(() => {
    if (!aviso) return
    const t = setTimeout(() => setAviso(null), aviso.tom === 'erro' ? 5200 : 2800)
    return () => clearTimeout(t)
  }, [aviso])

  return (
    <ContextoAviso.Provider value={avisar}>
      {children}
      {aviso && (
        <div className={'aviso ' + aviso.tom} role="status" aria-live="polite">
          {aviso.texto}
        </div>
      )}
    </ContextoAviso.Provider>
  )
}

export const useAviso = () => useContext(ContextoAviso)

/* =========================================================
   Painel deslizante
   ========================================================= */

export function Painel ({ titulo, descricao, aoFechar, children, rodape }) {
  useEffect(() => {
    const esc = e => { if (e.key === 'Escape') aoFechar() }
    document.addEventListener('keydown', esc)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', esc)
      document.body.style.overflow = ''
    }
  }, [aoFechar])

  return (
    <div className="fundo-escuro" onClick={e => { if (e.target === e.currentTarget) aoFechar() }}>
      <div className="painel" role="dialog" aria-modal="true" aria-label={titulo}>
        <div className="puxador" />
        <h2>{titulo}</h2>
        {descricao && <p className="dica" style={{ marginTop: 4 }}>{descricao}</p>}
        {children}
        {rodape && <div className="acoes" style={{ marginTop: 18 }}>{rodape}</div>}
      </div>
    </div>
  )
}

/* =========================================================
   Confirmação
   ========================================================= */

export function Confirmar ({ titulo, texto, rotuloConfirmar = 'Confirmar', perigo, aoConfirmar, aoFechar }) {
  return (
    <Painel
      titulo={titulo}
      aoFechar={aoFechar}
      rodape={
        <>
          <button className="btn secundario" onClick={aoFechar}>Cancelar</button>
          <button className={'btn' + (perigo ? ' perigo' : '')} onClick={aoConfirmar}>{rotuloConfirmar}</button>
        </>
      }
    >
      <p className="dica" style={{ marginTop: 10, fontSize: 14 }}>{texto}</p>
    </Painel>
  )
}

/* =========================================================
   Estados de tela
   ========================================================= */

export function Carregando ({ texto = 'Carregando…' }) {
  return (
    <div className="carregando">
      <div className="roda" />
      <span>{texto}</span>
    </div>
  )
}

export function Vazio ({ titulo, texto, acao }) {
  return (
    <div className="vazio">
      <strong>{titulo}</strong>
      <p>{texto}</p>
      {acao && <div style={{ marginTop: 14 }}>{acao}</div>}
    </div>
  )
}

/* =========================================================
   Campo com rótulo
   ========================================================= */

export function Campo ({ rotulo, dica, children }) {
  return (
    <div>
      <label className="rotulo">{rotulo}</label>
      {children}
      {dica && <p className="dica" style={{ marginTop: 5 }}>{dica}</p>}
    </div>
  )
}
