import { useEffect, useState } from 'react'
import { Vazio } from '../components/ui'
import { lerLogs } from '../lib/db'
import { NOMES_FUNCAO, dataHora } from '../lib/utils'

/** Registro das ações feitas no sistema. Restrito a farmacêutico e administrador. */
export default function Auditoria () {
  const [linhas, setLinhas] = useState(null)

  useEffect(() => {
    let vivo = true
    lerLogs(300)
      .then(r => vivo && setLinhas(r))
      .catch(() => vivo && setLinhas([]))
    return () => { vivo = false }
  }, [])

  if (linhas === null) return <p className="dica">Carregando…</p>
  if (!linhas.length) {
    return <Vazio titulo="Sem registros" texto="As ações feitas no sistema aparecem aqui." />
  }

  return (
    <div className="lista">
      {linhas.map(l => (
        <div key={l.id} className="cartao" style={{ padding: 12 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <span className="etq">{l.acao}</span>
            <span className="dica">{dataHora(l.criadoEm)}</span>
            <span className="dica" style={{ marginLeft: 'auto' }}>
              {l.usuarioNome} · {NOMES_FUNCAO[l.usuarioFuncao] || l.usuarioFuncao}
            </span>
          </div>
          {l.detalhe && (
            <p style={{ fontSize: 13.5, marginTop: 7, lineHeight: 1.45 }}>{l.detalhe}</p>
          )}
        </div>
      ))}
    </div>
  )
}
