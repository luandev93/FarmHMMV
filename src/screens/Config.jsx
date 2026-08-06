import { useEffect, useState } from 'react'
import { useAviso } from '../components/ui'
import { useAuth } from '../lib/auth'
import { useDados } from '../lib/store'
import { salvarConfig, semear, sincronizarCatalogoPublico, migrarParaPessoas } from '../lib/db'

export default function Config () {
  const { perfil, usuario } = useAuth()
  const dados = useDados()
  const avisar = useAviso()
  const [f, setF] = useState(dados.config)
  const [salvando, setSalvando] = useState(false)
  const [carregando, setCarregando] = useState(false)
  const [sincronizando, setSincronizando] = useState(false)
  const [migrando, setMigrando] = useState(false)

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
        <h2 style={{ fontSize: 15, marginBottom: 4 }}>Dispensação</h2>
        <p className="dica" style={{ marginBottom: 12 }}>
          Local de origem das requisições atendidas. Quais locais a enfermagem pode
          receber é definido em cada um, na tela de Locais de estoque.
        </p>
        <label className="rotulo" htmlFor="disp">Local de origem da dispensação</label>
        <select
          id="disp" className="campo" value={f.estoqueDispensacaoId || ''}
          onChange={e => troca('estoqueDispensacaoId', e.target.value)}
        >
          <option value="">Não definida</option>
          {dados.estoques.map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}
        </select>
        <button
          className="btn secundario" style={{ marginTop: 12 }}
          disabled={sincronizando}
          onClick={async () => {
            setSincronizando(true)
            try {
              const n = await sincronizarCatalogoPublico(ctx)
              avisar(`${n} itens disponíveis para a enfermagem.`, 'ok')
            } catch (e) {
              avisar('Falhou: ' + e.message, 'erro')
            } finally {
              setSincronizando(false)
            }
          }}
        >{sincronizando ? 'Sincronizando…' : 'Sincronizar catálogo público'}</button>
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
              exigirMotivoSaida: Boolean(f.exigirMotivoSaida),
              estoqueDispensacaoId: f.estoqueDispensacaoId || ''
            }, ctx)
            avisar('Configurações salvas.', 'ok')
          } catch (e) {
            avisar('Não foi possível salvar: ' + e.message, 'erro')
          } finally {
            setSalvando(false)
          }
        }}
      >{salvando ? 'Salvando…' : 'Salvar configurações'}</button>

      {!dados.config.pessoasMigradas && (
      <div className="cartao" style={{ marginTop: 22 }}>
        <h2 style={{ fontSize: 15, marginBottom: 4 }}>Cadastro único de pessoas</h2>
        <p className="dica" style={{ marginBottom: 12 }}>
          Traz para Pessoas quem ainda está só nos cadastros antigos de usuário ou de
          prescritor. Rode uma vez; execuções seguintes não duplicam. Se uma pessoa já
          existia nos dois cadastros antigos, ela pode aparecer duas vezes aqui — nesse
          caso, edite a duplicada sem acesso e a exclua.
        </p>
        <button
          className="btn secundario"
          disabled={migrando}
          onClick={async () => {
            setMigrando(true)
            try {
              const r = await migrarParaPessoas(ctx)
              await salvarConfig({ pessoasMigradas: true }, ctx)
              avisar(`${r.comAcesso} com acesso e ${r.semAcesso} sem acesso migrados.`, 'ok')
            } catch (e) {
              avisar('Falhou: ' + e.message, 'erro')
            } finally {
              setMigrando(false)
            }
          }}
        >{migrando ? 'Migrando…' : 'Migrar cadastros antigos'}</button>
      </div>
      )}

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
