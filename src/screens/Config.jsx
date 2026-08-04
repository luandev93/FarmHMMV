import { useEffect, useState } from 'react'
import { useAviso } from '../components/ui'
import { useAuth } from '../lib/auth'
import { useDados } from '../lib/store'
import { salvarConfig, semear } from '../lib/db'

export default function Config () {
  const { perfil, usuario } = useAuth()
  const dados = useDados()
  const avisar = useAviso()
  const [f, setF] = useState(dados.config)
  const [salvando, setSalvando] = useState(false)
  const [carregando, setCarregando] = useState(false)

  useEffect(() => { setF(dados.config) }, [dados.config])

  const ctx = { uid: usuario.uid, nome: perfil.nome, funcao: perfil.funcao }
  const troca = (c, v) => setF(a => ({ ...a, [c]: v }))
  const numero = v => Number(String(v).replace(',', '.')) || 0

  return (
    <>
      <div className="cartao bloco">
        <h2 style={{ fontSize: 15, marginBottom: 12 }}>Identificação</h2>
        <label className="rotulo">Nome da unidade</label>
        <input className="campo" value={f.nomeUnidade || ''} onChange={e => troca('nomeUnidade', e.target.value)} />
      </div>

      <div className="cartao bloco">
        <h2 style={{ fontSize: 15, marginBottom: 4 }}>Sugestão de pedido</h2>
        <p className="dica" style={{ marginBottom: 12 }}>
          Estes valores são o ponto de partida da tela de pedido. Lá dá para ajustar a qualquer momento.
        </p>
        <div className="linha-campos">
          <div>
            <label className="rotulo">Dias de cobertura</label>
            <input
              className="campo num" inputMode="numeric" value={f.diasCobertura ?? 30}
              onChange={e => troca('diasCobertura', e.target.value.replace(/\D/g, ''))}
            />
          </div>
          <div>
            <label className="rotulo">Histórico de consumo (dias)</label>
            <input
              className="campo num" inputMode="numeric" value={f.diasHistoricoConsumo ?? 90}
              onChange={e => troca('diasHistoricoConsumo', e.target.value.replace(/\D/g, ''))}
            />
          </div>
        </div>
        <div style={{ marginTop: 12 }}>
          <label className="rotulo">Margem de segurança</label>
          <select className="campo" value={f.fatorSeguranca ?? 1.2} onChange={e => troca('fatorSeguranca', Number(e.target.value))}>
            <option value="1">Sem margem</option>
            <option value="1.1">10% a mais</option>
            <option value="1.2">20% a mais</option>
            <option value="1.3">30% a mais</option>
            <option value="1.5">50% a mais</option>
          </select>
        </div>
      </div>

      <div className="cartao bloco">
        <h2 style={{ fontSize: 15, marginBottom: 12 }}>Alertas</h2>
        <label className="rotulo">Avisar quando a validade estiver a menos de (dias)</label>
        <input
          className="campo num" inputMode="numeric" value={f.diasAlertaValidade ?? 90}
          onChange={e => troca('diasAlertaValidade', e.target.value.replace(/\D/g, ''))}
        />
      </div>

      <div className="cartao bloco">
        <h2 style={{ fontSize: 15, marginBottom: 12 }}>Regras de lançamento</h2>
        <div style={{ display: 'grid', gap: 12 }}>
          <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 14.5 }}>
            <input
              type="checkbox" checked={Boolean(f.permitirSaldoNegativo)}
              onChange={e => troca('permitirSaldoNegativo', e.target.checked)}
              style={{ width: 22, height: 22, accentColor: 'var(--azul-600)', flex: 'none' }}
            />
            <span>
              Permitir saldo negativo
              <small style={{ display: 'block', color: 'var(--tinta-fraca)', fontSize: 12.5, marginTop: 2 }}>
                Deixe desligado para que uma saída maior que o saldo seja bloqueada.
              </small>
            </span>
          </label>
          <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 14.5 }}>
            <input
              type="checkbox" checked={Boolean(f.exigirMotivoSaida)}
              onChange={e => troca('exigirMotivoSaida', e.target.checked)}
              style={{ width: 22, height: 22, accentColor: 'var(--azul-600)', flex: 'none' }}
            />
            <span>Exigir motivo nas saídas</span>
          </label>
        </div>
      </div>

      <button
        className="btn bloco-largo"
        disabled={salvando}
        onClick={async () => {
          setSalvando(true)
          try {
            await salvarConfig({
              nomeUnidade: f.nomeUnidade || '',
              diasCobertura: numero(f.diasCobertura) || 30,
              diasHistoricoConsumo: numero(f.diasHistoricoConsumo) || 90,
              fatorSeguranca: Number(f.fatorSeguranca) || 1.2,
              diasAlertaValidade: numero(f.diasAlertaValidade) || 90,
              permitirSaldoNegativo: Boolean(f.permitirSaldoNegativo),
              exigirMotivoSaida: Boolean(f.exigirMotivoSaida)
            }, ctx)
            avisar('Configurações salvas.', 'ok')
          } catch (e) {
            avisar('Não foi possível salvar: ' + e.message, 'erro')
          } finally {
            setSalvando(false)
          }
        }}
      >{salvando ? 'Salvando…' : 'Salvar configurações'}</button>

      <div className="cartao" style={{ marginTop: 22 }}>
        <h2 style={{ fontSize: 15, marginBottom: 4 }}>Catálogo padrão</h2>
        <p className="dica" style={{ marginBottom: 12 }}>
          Adiciona os 239 itens padronizados da unidade que ainda não estiverem cadastrados.
          Nada é sobrescrito e nenhum saldo é alterado.
        </p>
        <button
          className="btn secundario"
          disabled={carregando}
          onClick={async () => {
            setCarregando(true)
            try {
              const n = await semear(ctx, { comEstoques: false })
              avisar(n ? `${n} itens adicionados.` : 'Todos os itens padrão já estão no catálogo.', 'ok')
            } catch (e) {
              avisar('Falhou: ' + e.message, 'erro')
            } finally {
              setCarregando(false)
            }
          }}
        >{carregando ? 'Carregando…' : 'Carregar itens padrão'}</button>
      </div>
    </>
  )
}
