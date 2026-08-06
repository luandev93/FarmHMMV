import { useMemo, useRef, useState } from 'react'
import { Confirmar, Icone, Painel, Vazio, useAviso } from '../components/ui'
import { useAuth } from '../lib/auth'
import { useDados } from '../lib/store'
import {
  salvarItem, excluirItem, semear, lerCSV, prepararImportacao, aplicarImportacao,
  mesclarItens, aprovarItem, descartarProposta
} from '../lib/db'
import {
  CLASSES_CONTROLE, FORMAS_FARMACEUTICAS, GRUPOS_ATC, TIPOS_ITEM, UNIDADES,
  baixarCSV, formasPorGrupo, formatarNumero, semAcento, siglaDaForma
} from '../lib/utils'

const VAZIO = {
  codigo: '', descricao: '', principioAtivo: '', concentracao: '', formaFarmaceutica: '',
  unidade: 'UNIDADE', tipo: 'MEDICAMENTO', grupoATC: '', grupoFarmacologico: '',
  posologia: '', indicacao: '', efeitosAdversos: '', controlado: '',
  termolabil: false, altaVigilancia: false, controlaLote: true,
  precoMin: null, precoMax: null, precoContrato: null,
  marca: '', fornecedor: '', contrato: '', codigoContrato: '',
  estoqueMinimo: 0, ativo: true, foraDoContrato: false
}

export default function Catalogo () {
  const { perfil, usuario, ehFarmaceutico, ehAdm } = useAuth()
  const dados = useDados()
  const avisar = useAviso()

  const [busca, setBusca] = useState('')
  const [tipo, setTipo] = useState('')
  const [editando, setEditando] = useState(null)
  const [excluindo, setExcluindo] = useState(null)
  const [carregandoPadrao, setCarregandoPadrao] = useState(false)
  const [previa, setPrevia] = useState(null)
  const [criarNovos, setCriarNovos] = useState(false)
  const [aplicando, setAplicando] = useState(false)
  const [mesclando, setMesclando] = useState(null)
  const [descartando, setDescartando] = useState(null)
  const arquivo = useRef(null)

  const ctx = { uid: usuario.uid, nome: perfil.nome, funcao: perfil.funcao }

  const lista = useMemo(() => {
    const t = semAcento(busca).trim()
    return dados.itens.filter(i => {
      if (tipo === 'pendentes') return Boolean(i.pendente)
      if (i.pendente) return false
      if (tipo && i.tipo !== tipo) return false
      if (!t) return true
      return semAcento(
        [i.descricao, i.principioAtivo, i.codigo, i.grupoFarmacologico, i.marca].join(' ')
      ).includes(t)
    })
  }, [dados.itens, busca, tipo])

  async function carregarPadrao () {
    setCarregandoPadrao(true)
    try {
      const n = await semear(ctx, { comEstoques: false })
      avisar(n ? `${n} itens adicionados ao catálogo.` : 'O catálogo padrão já está carregado.', 'ok')
    } catch (e) {
      avisar('Não foi possível carregar: ' + e.message, 'erro')
    } finally {
      setCarregandoPadrao(false)
    }
  }

  function exportar () {
    const l = [[
      'Código', 'Descrição', 'Tipo', 'Princípio ativo', 'Concentração', 'Forma', 'Unidade',
      'Grupo ATC', 'Grupo farmacológico', 'Controle', 'Termolábil', 'Alta vigilância',
      'Estoque mínimo', 'Preço de contrato', 'PMVG mín. (referência)', 'PMVG máx. (referência)',
      'Marca', 'Contrato', 'Ativo'
    ]]
    lista.forEach(i => l.push([
      i.codigo, i.descricao, i.tipo, i.principioAtivo, i.concentracao, i.formaFarmaceutica,
      i.unidade, i.grupoATC, i.grupoFarmacologico, i.controlado,
      i.termolabil ? 'sim' : '', i.altaVigilancia ? 'sim' : '',
      i.estoqueMinimo || 0,
      i.precoContrato ?? '', i.precoMin ?? '', i.precoMax ?? '',
      i.marca, i.contrato, i.ativo === false ? 'não' : 'sim'
    ]))
    baixarCSV('catalogo.csv', l)
  }

  return (
    <>
      <div className="bloco">
        <input
          className="campo" type="search" value={busca} onChange={e => setBusca(e.target.value)}
          placeholder="Buscar item no catálogo"
        />
      </div>

      <div className="pilulas">
        <button className="pilula" aria-pressed={!tipo} onClick={() => setTipo('')}>Todos</button>
        {dados.itensPendentes.length > 0 && (
          <button
            className="pilula" aria-pressed={tipo === 'pendentes'}
            onClick={() => setTipo('pendentes')}
            style={{ borderColor: 'var(--transf)', color: tipo === 'pendentes' ? undefined : 'var(--transf)' }}
          >Aguardando aprovação ({dados.itensPendentes.length})</button>
        )}
        {Object.entries(TIPOS_ITEM).map(([id, nome]) => (
          <button key={id} className="pilula" aria-pressed={tipo === id} onClick={() => setTipo(id)}>
            {nome}
          </button>
        ))}
      </div>

      {ehFarmaceutico && (
        <>
          <div className="acoes bloco">
            <button className="btn" onClick={() => setEditando({ ...VAZIO })}>
              <Icone nome="entrada" tamanho={18} /> Novo item
            </button>
            <button className="btn secundario" onClick={exportar}>
              <Icone nome="baixar" tamanho={18} /> Exportar
            </button>
          </div>

          {!ehAdm && (
            <p className="dica bloco">
              Você pode propor itens novos. Eles ficam aguardando a aprovação do
              administrador antes de aparecerem nos lançamentos.
            </p>
          )}

          <input
            ref={arquivo} type="file" accept=".csv,text/csv" style={{ display: 'none' }}
            onChange={async e => {
              const f = e.target.files?.[0]
              e.target.value = ''
              if (!f) return
              try {
                const texto = await f.text()
                const resultado = prepararImportacao(lerCSV(texto), dados.itens)
                setCriarNovos(false)
                setPrevia({ ...resultado, nomeArquivo: f.name })
              } catch (err) {
                avisar(err.message, 'erro')
              }
            }}
          />
          {ehAdm && (
            <button className="btn secundario bloco-largo bloco" onClick={() => arquivo.current?.click()}>
              <Icone nome="etiqueta" tamanho={18} /> Importar planilha
            </button>
          )}
        </>
      )}

      {dados.itens.length === 0 && (
        <Vazio
          titulo="Catálogo vazio"
          texto="Carregue a lista padronizada da unidade (239 itens com grupo ATC, apresentação e preço de referência) ou cadastre item por item."
          acao={
            ehFarmaceutico && (
              <button className="btn" onClick={carregarPadrao} disabled={carregandoPadrao}>
                {carregandoPadrao ? 'Carregando…' : 'Carregar catálogo padrão'}
              </button>
            )
          }
        />
      )}

      <p className="dica" style={{ marginBottom: 8 }}>
        {lista.length} item(ns){busca || tipo ? ' nesta busca' : ' no catálogo'}
      </p>

      <div className="lista">
        {lista.slice(0, 300).map(i => (
          <button key={i.id} className="linha-item" onClick={() => setEditando(i)}>
            <div className="corpo">
              <div className="nome" style={{ opacity: i.ativo === false ? .5 : 1 }}>{i.descricao}</div>
              <div className="meta">
                <span className="etq">{i.codigo}</span>
                <span>{TIPOS_ITEM[i.tipo] || i.tipo}</span>
                {i.grupoATC && <span className="etq">Grupo {i.grupoATC}</span>}
                {i.controlado && <span className="etq controle">{i.controlado}</span>}
                {i.termolabil && <span className="etq frio">2–8 °C</span>}
                {i.ativo === false && <span className="etq alerta">inativo</span>}
                {i.pendente && <span className="etq atencao">aguardando aprovação</span>}
                {i.foraDoContrato && <span className="etq atencao">fora do contrato</span>}
                {Number(i.estoqueMinimo) > 0 && <span>mín. {i.estoqueMinimo}</span>}
              </div>
            </div>
            <div className="valor">
              <div className="n num">{formatarNumero(dados.saldoTotal(i.id))}</div>
              <div className="u">{i.unidade?.toLowerCase()}</div>
            </div>
          </button>
        ))}
      </div>

      {lista.length > 300 && (
        <p className="dica" style={{ marginTop: 10 }}>
          Mostrando os 300 primeiros. Refine a busca para encontrar o restante.
        </p>
      )}

      {previa && (
        <Painel
          titulo="Conferir antes de aplicar"
          descricao={previa.nomeArquivo}
          aoFechar={() => setPrevia(null)}
          rodape={
            <>
              <button className="btn secundario" onClick={() => setPrevia(null)}>Cancelar</button>
              <button
                className="btn"
                disabled={aplicando || (!previa.atualizacoes.length && !(criarNovos && previa.novos.length))}
                onClick={async () => {
                  setAplicando(true)
                  try {
                    const r = await aplicarImportacao(previa, ctx, { criarNovos })
                    setPrevia(null)
                    avisar(`${r.atualizados} atualizado(s), ${r.criados} criado(s).`, 'ok')
                  } catch (err) {
                    avisar('Falhou: ' + err.message, 'erro')
                  } finally {
                    setAplicando(false)
                  }
                }}
              >{aplicando ? 'Gravando…' : 'Aplicar'}</button>
            </>
          }
        >
          <div className="indicadores" style={{ marginTop: 14 }}>
            <div className="indicador">
              <div className="n num">{previa.atualizacoes.length}</div>
              <div className="r">itens a atualizar</div>
            </div>
            <div className="indicador atencao">
              <div className="n num">{previa.novos.length}</div>
              <div className="r">códigos novos</div>
            </div>
          </div>

          {previa.novos.length > 0 && (
            <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 14.5, marginTop: 14 }}>
              <input
                type="checkbox" checked={criarNovos} onChange={e => setCriarNovos(e.target.checked)}
                style={{ width: 22, height: 22, accentColor: 'var(--azul-600)', flex: 'none' }}
              />
              <span>
                Criar os {previa.novos.length} códigos que ainda não existem
                <small style={{ display: 'block', color: 'var(--tinta-fraca)', fontSize: 12.5, marginTop: 2 }}>
                  Deixe desmarcado para só atualizar o que já está cadastrado.
                </small>
              </span>
            </label>
          )}

          {previa.ignoradas.length > 0 && (
            <p className="dica" style={{ marginTop: 12 }}>
              {previa.ignoradas.length} linha(s) sem alteração ou sem código correspondente.
            </p>
          )}

          <h3 style={{ fontSize: 14, marginTop: 18, marginBottom: 8 }}>O que vai mudar</h3>
          {previa.atualizacoes.length === 0 ? (
            <p className="dica">Nenhuma alteração nos itens já cadastrados.</p>
          ) : (
            <table className="tabela">
              <thead><tr><th>Item</th><th>Alterações</th></tr></thead>
              <tbody>
                {previa.atualizacoes.slice(0, 60).map(a => (
                  <tr key={a.item.id}>
                    <td>
                      <b>{a.item.codigo}</b><br />
                      <span className="dica">{a.item.descricao}</span>
                    </td>
                    <td>
                      {Object.entries(a.mudancas).map(([campo, v]) => (
                        <div key={campo} style={{ fontSize: 12.5 }}>
                          {campo}: <b>{String(v)}</b>
                        </div>
                      ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {previa.atualizacoes.length > 60 && (
            <p className="dica" style={{ marginTop: 8 }}>
              Mostrando as 60 primeiras de {previa.atualizacoes.length}.
            </p>
          )}
        </Painel>
      )}

      {editando && (
        <FormularioItem
          item={editando}
          somenteLeitura={editando.id ? !ehAdm : !ehFarmaceutico}
          aoFechar={() => setEditando(null)}
          aoExcluir={() => { setExcluindo(editando); setEditando(null) }}
          aoMesclar={() => { setMesclando(editando); setEditando(null) }}
          ehAdm={ehAdm}
          aoAprovar={async () => {
            await aprovarItem(editando, ctx)
            setEditando(null)
            avisar('Item aprovado e liberado para uso.', 'ok')
          }}
          aoDescartar={() => { setDescartando(editando); setEditando(null) }}
          aoSalvar={async dadosItem => {
            await salvarItem(dadosItem, ctx, editando.id || null)
            setEditando(null)
            avisar('Item salvo.', 'ok')
          }}
        />
      )}

      {mesclando && (
        <PainelMesclagem
          origem={mesclando}
          aoFechar={() => setMesclando(null)}
          aoConfirmar={async destino => {
            const movido = await mesclarItens(mesclando, destino, ctx)
            setMesclando(null)
            avisar(
              movido > 0
                ? `${movido} unidade(s) movidas para ${destino.codigo}.`
                : 'Itens mesclados.',
              'ok'
            )
          }}
        />
      )}

      {descartando && (
        <Confirmar
          titulo="Descartar a proposta?"
          texto={`"${descartando.descricao}" some do catálogo. Use quando o item for duplicado ou tiver sido cadastrado por engano — ${descartando.propostoPor || 'quem propôs'} não é avisado pelo sistema.`}
          rotuloConfirmar="Descartar"
          perigo
          aoFechar={() => setDescartando(null)}
          aoConfirmar={async () => {
            await descartarProposta(descartando, ctx, 'duplicado ou cadastrado por engano')
            setDescartando(null)
            avisar('Proposta descartada.', 'ok')
          }}
        />
      )}

      {excluindo && (
        <Confirmar
          titulo="Excluir do catálogo?"
          texto={`"${excluindo.descricao}" sai do catálogo. Itens com saldo não podem ser excluídos — nesse caso, desative em vez de excluir.`}
          rotuloConfirmar="Excluir"
          perigo
          aoFechar={() => setExcluindo(null)}
          aoConfirmar={async () => {
            try {
              await excluirItem(excluindo, ctx)
              avisar('Item excluído.', 'ok')
            } catch (e) {
              avisar(e.message, 'erro')
            } finally {
              setExcluindo(null)
            }
          }}
        />
      )}
    </>
  )
}

function FormularioItem ({
  item, aoSalvar, aoFechar, aoExcluir, aoMesclar, aoAprovar, aoDescartar, ehAdm, somenteLeitura
}) {
  const [f, setF] = useState({ ...VAZIO, ...item })
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  const troca = (campo, valor) => setF(a => ({ ...a, [campo]: valor }))
  const numero = v => (v === '' || v === null || v === undefined ? null : Number(String(v).replace(',', '.')))

  async function enviar () {
    if (!f.descricao.trim()) return setErro('A descrição é obrigatória.')
    if (!f.codigo.trim()) return setErro('O código é obrigatório.')
    setSalvando(true)
    setErro('')
    try {
      await aoSalvar({
        ...f,
        precoMin: numero(f.precoMin),
        precoMax: numero(f.precoMax),
        precoContrato: numero(f.precoContrato),
        estoqueMinimo: Number(f.estoqueMinimo) || 0
      })
    } catch (e) {
      setErro(e.message || 'Não foi possível salvar.')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Painel
      titulo={item.id ? 'Editar item' : 'Novo item'}
      aoFechar={aoFechar}
      rodape={
        item.pendente && ehAdm ? (
          <>
            <button className="btn secundario perigo" onClick={aoDescartar}>Descartar</button>
            <button className="btn" onClick={async () => { await enviar(); await aoAprovar() }} disabled={salvando}>
              {salvando ? 'Aprovando…' : 'Aprovar'}
            </button>
          </>
        ) : somenteLeitura ? (
          <button className="btn secundario" onClick={aoFechar}>Fechar</button>
        ) : (
          <>
            {item.id && <button className="btn secundario perigo" onClick={aoExcluir}>Excluir</button>}
            <button className="btn" onClick={enviar} disabled={salvando}>
              {salvando ? 'Salvando…' : 'Salvar item'}
            </button>
          </>
        )
      }
    >
      {item.pendente && (
        <div className="aviso-caixa" style={{ marginTop: 12 }}>
          Proposto por <b>{item.propostoPor || 'não informado'}</b>. Confira a descrição e
          se já não existe item igual antes de aprovar.
        </div>
      )}

      {somenteLeitura && item.id && (
        <div className="info-caixa" style={{ marginTop: 12 }}>
          Só o administrador altera o cadastro de itens já existentes.
        </div>
      )}

      {item.id && ehAdm && (
        <button
          className="btn secundario bloco-largo" style={{ marginTop: 14 }}
          onClick={aoMesclar}
        >
          <Icone nome="transferencia" tamanho={18} /> Este item é duplicado de outro
        </button>
      )}

      {item.mescladoCodigo && (
        <div className="aviso-caixa" style={{ marginTop: 12 }}>
          Este item foi absorvido por <b>{item.mescladoCodigo}</b> e não aparece mais nas buscas.
        </div>
      )}

      <fieldset disabled={somenteLeitura} style={{ border: 0, padding: 0, margin: 0 }}>
        <div className="campos">
          <div className="linha-campos">
            <div>
              <label className="rotulo">Código</label>
              <input className="campo" value={f.codigo} onChange={e => troca('codigo', e.target.value.toUpperCase())} />
            </div>
            <div>
              <label className="rotulo">Tipo</label>
              <select className="campo" value={f.tipo} onChange={e => troca('tipo', e.target.value)}>
                {Object.entries(TIPOS_ITEM).map(([id, nome]) => <option key={id} value={id}>{nome}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="rotulo">Descrição (é o que aparece na busca)</label>
            <input className="campo" value={f.descricao} onChange={e => troca('descricao', e.target.value)} />
          </div>

          <div className="linha-campos">
            <div>
              <label className="rotulo">Princípio ativo (DCB)</label>
              <input className="campo" value={f.principioAtivo} onChange={e => troca('principioAtivo', e.target.value)} />
            </div>
            <div>
              <label className="rotulo">Concentração</label>
              <input className="campo" value={f.concentracao} onChange={e => troca('concentracao', e.target.value)} />
            </div>
          </div>

          <div className="linha-campos">
            <div>
              <label className="rotulo">Forma farmacêutica</label>
              <select
                className="campo" value={f.formaFarmaceutica}
                onChange={e => troca('formaFarmaceutica', e.target.value)}
              >
                <option value="">Não informada</option>
                {/* Preserva o que já estava gravado, mesmo fora da lista padrão. */}
                {f.formaFarmaceutica &&
                  !FORMAS_FARMACEUTICAS.some(x => x.n === f.formaFarmaceutica) && (
                    <option value={f.formaFarmaceutica}>{f.formaFarmaceutica} (fora do padrão)</option>
                  )}
                {formasPorGrupo().map(([grupo, itens]) => (
                  <optgroup key={grupo} label={grupo}>
                    {itens.map(x => (
                      <option key={x.n} value={x.n}>
                        {x.n}{x.s ? ` — ${x.s}` : ''}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
              {siglaDaForma(f.formaFarmaceutica) && (
                <p className="dica" style={{ marginTop: 5 }}>
                  Abreviação: <b>{siglaDaForma(f.formaFarmaceutica)}</b>
                </p>
              )}
            </div>
            <div>
              <label className="rotulo">Unidade de contagem</label>
              <select className="campo" value={f.unidade} onChange={e => troca('unidade', e.target.value)}>
                {UNIDADES.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
          </div>

          <div className="linha-campos">
            <div>
              <label className="rotulo">Grupo ATC</label>
              <select className="campo" value={f.grupoATC} onChange={e => troca('grupoATC', e.target.value)}>
                <option value="">Não se aplica</option>
                {Object.entries(GRUPOS_ATC).map(([l, n]) => <option key={l} value={l}>{l} — {n}</option>)}
              </select>
            </div>
            <div>
              <label className="rotulo">Controle especial</label>
              <select className="campo" value={f.controlado} onChange={e => troca('controlado', e.target.value)}>
                <option value="">Não controlado</option>
                {Object.entries(CLASSES_CONTROLE).map(([l, n]) => <option key={l} value={l}>{n}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="rotulo">Grupo farmacológico</label>
            <input className="campo" value={f.grupoFarmacologico} onChange={e => troca('grupoFarmacologico', e.target.value)} />
          </div>

          <div>
            <label className="rotulo">Posologia de referência</label>
            <input className="campo" value={f.posologia} onChange={e => troca('posologia', e.target.value)} />
          </div>

          <div>
            <label className="rotulo">Indicação</label>
            <textarea className="campo" value={f.indicacao} onChange={e => troca('indicacao', e.target.value)} />
          </div>

          <div>
            <label className="rotulo">Efeitos adversos comuns</label>
            <textarea className="campo" value={f.efeitosAdversos} onChange={e => troca('efeitosAdversos', e.target.value)} />
          </div>

          <div className="linha-campos">
            <div>
              <label className="rotulo">Estoque mínimo</label>
              <input
                className="campo num" inputMode="numeric" value={f.estoqueMinimo}
                onChange={e => troca('estoqueMinimo', e.target.value.replace(/\D/g, ''))}
              />
            </div>
            <div>
              <label className="rotulo">Preço de contrato (R$)</label>
              <input
                className="campo num" inputMode="decimal" value={f.precoContrato ?? ''}
                onChange={e => troca('precoContrato', e.target.value)}
              />
            </div>
          </div>

          <p className="dica">
            Só o preço de contrato entra nos totais do sistema. Os campos de PMVG
            abaixo ficam guardados apenas como referência de mercado.
          </p>
          <div className="linha-campos">
            <div>
              <label className="rotulo">PMVG mínimo (R$)</label>
              <input className="campo num" inputMode="decimal" value={f.precoMin ?? ''} onChange={e => troca('precoMin', e.target.value)} />
            </div>
            <div>
              <label className="rotulo">PMVG máximo (R$)</label>
              <input className="campo num" inputMode="decimal" value={f.precoMax ?? ''} onChange={e => troca('precoMax', e.target.value)} />
            </div>
          </div>

          <div className="linha-campos">
            <div>
              <label className="rotulo">Marca / fabricante</label>
              <input className="campo" value={f.marca} onChange={e => troca('marca', e.target.value)} />
            </div>
            <div>
              <label className="rotulo">Fornecedor</label>
              <input className="campo" value={f.fornecedor} onChange={e => troca('fornecedor', e.target.value)} />
            </div>
          </div>

          <div className="linha-campos">
            <div>
              <label className="rotulo">Contrato</label>
              <input className="campo" value={f.contrato} onChange={e => troca('contrato', e.target.value)} />
            </div>
            <div>
              <label className="rotulo">Item no contrato</label>
              <input className="campo" value={f.codigoContrato} onChange={e => troca('codigoContrato', e.target.value)} />
            </div>
          </div>

          <div style={{ display: 'grid', gap: 10 }}>
            <Marcador rotulo="Guardar entre 2 e 8 °C" valor={f.termolabil} aoTrocar={v => troca('termolabil', v)} />
            <Marcador rotulo="Medicamento de alta vigilância" valor={f.altaVigilancia} aoTrocar={v => troca('altaVigilancia', v)} />
            <Marcador rotulo="Controlar lote e validade" valor={f.controlaLote} aoTrocar={v => troca('controlaLote', v)} />
            <Marcador rotulo="Item fora do contrato" valor={f.foraDoContrato} aoTrocar={v => troca('foraDoContrato', v)} />
            <Marcador rotulo="Item ativo (aparece na busca)" valor={f.ativo !== false} aoTrocar={v => troca('ativo', v)} />
          </div>

          {erro && <div className="erro-caixa">{erro}</div>}
        </div>
      </fieldset>
    </Painel>
  )
}

function Marcador ({ rotulo, valor, aoTrocar }) {
  return (
    <label style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 14.5 }}>
      <input
        type="checkbox" checked={Boolean(valor)} onChange={e => aoTrocar(e.target.checked)}
        style={{ width: 22, height: 22, accentColor: 'var(--azul-600)' }}
      />
      {rotulo}
    </label>
  )
}


/**
 * Junta dois cadastros do mesmo produto. O saldo vai para o item escolhido e o
 * duplicado é desativado — nada é apagado, e o histórico dos dois permanece.
 */
function PainelMesclagem ({ origem, aoConfirmar, aoFechar }) {
  const dados = useDados()
  const [busca, setBusca] = useState('')
  const [destino, setDestino] = useState(null)
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState('')

  const saldoOrigem = dados.saldoTotal(origem.id)

  const candidatos = useMemo(() => {
    const t = semAcento(busca).trim()
    if (!t) return []
    return dados.itens
      .filter(i => i.id !== origem.id && i.ativo !== false)
      .filter(i => semAcento(`${i.descricao} ${i.principioAtivo} ${i.codigo}`).includes(t))
      .slice(0, 20)
  }, [busca, dados.itens, origem.id])

  return (
    <Painel
      titulo="Juntar itens duplicados"
      descricao={`${origem.codigo} — ${origem.descricao}`}
      aoFechar={aoFechar}
      rodape={
        <>
          <button className="btn secundario" onClick={aoFechar}>Cancelar</button>
          <button
            className="btn" disabled={!destino || ocupado}
            onClick={async () => {
              setOcupado(true)
              setErro('')
              try { await aoConfirmar(destino) } catch (e) { setErro(e.message) } finally { setOcupado(false) }
            }}
          >{ocupado ? 'Juntando…' : 'Juntar'}</button>
        </>
      }
    >
      <div className="info-caixa" style={{ marginTop: 12 }}>
        O saldo de <b>{origem.codigo}</b> ({formatarNumero(saldoOrigem)} {origem.unidade?.toLowerCase()})
        passa para o item que você escolher. Depois disso, <b>{origem.codigo}</b> sai das
        buscas e dos lançamentos, mas continua no histórico.
      </div>

      <div style={{ marginTop: 14 }}>
        <label className="rotulo">Item que vai continuar</label>
        {destino ? (
          <div className="item-escolhido">
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 14.5, fontWeight: 650 }}>{destino.descricao}</div>
              <div className="dica" style={{ marginTop: 3 }}>
                {destino.codigo} · saldo atual {formatarNumero(dados.saldoTotal(destino.id))}
              </div>
            </div>
            <button className="x" onClick={() => setDestino(null)} aria-label="Trocar">×</button>
          </div>
        ) : (
          <>
            <input
              className="campo" value={busca} onChange={e => setBusca(e.target.value)}
              placeholder="Busque o item correto" autoFocus
            />
            {candidatos.length > 0 && (
              <div className="sugestoes" style={{ position: 'static', marginTop: 8, maxHeight: 260 }}>
                {candidatos.map(i => (
                  <button key={i.id} className="sugestao" onClick={() => setDestino(i)}>
                    <div className="principal">{i.descricao}</div>
                    <div className="meta">
                      <span className="etq">{i.codigo}</span>
                      <span>saldo {formatarNumero(dados.saldoTotal(i.id))}</span>
                      {i.unidade !== origem.unidade && (
                        <span className="etq alerta">unidade diferente: {i.unidade?.toLowerCase()}</span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {destino && destino.unidade !== origem.unidade && (
        <div className="aviso-caixa" style={{ marginTop: 14 }}>
          As unidades são diferentes ({origem.unidade?.toLowerCase()} e {destino.unidade?.toLowerCase()}).
          Confirme que é o mesmo produto antes de juntar — o saldo é somado sem conversão.
        </div>
      )}

      {erro && <div className="erro-caixa" style={{ marginTop: 14 }}>{erro}</div>}
    </Painel>
  )
}
