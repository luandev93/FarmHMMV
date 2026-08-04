import { useMemo, useState } from 'react'
import { Confirmar, Icone, Painel, Vazio, useAviso } from '../components/ui'
import { useAuth } from '../lib/auth'
import { useDados } from '../lib/store'
import { salvarItem, excluirItem, semear } from '../lib/db'
import {
  CLASSES_CONTROLE, GRUPOS_ATC, TIPOS_ITEM, UNIDADES,
  baixarCSV, formatarNumero, semAcento
} from '../lib/utils'

const VAZIO = {
  codigo: '', descricao: '', principioAtivo: '', concentracao: '', formaFarmaceutica: '',
  unidade: 'UNIDADE', tipo: 'MEDICAMENTO', grupoATC: '', grupoFarmacologico: '',
  posologia: '', indicacao: '', efeitosAdversos: '', controlado: '',
  termolabil: false, altaVigilancia: false, controlaLote: true,
  precoMin: null, precoMax: null, precoContrato: null,
  marca: '', fornecedor: '', contrato: '', codigoContrato: '',
  estoqueMinimo: 0, ativo: true
}

export default function Catalogo () {
  const { perfil, usuario, ehFarmaceutico } = useAuth()
  const dados = useDados()
  const avisar = useAviso()

  const [busca, setBusca] = useState('')
  const [tipo, setTipo] = useState('')
  const [editando, setEditando] = useState(null)
  const [excluindo, setExcluindo] = useState(null)
  const [carregandoPadrao, setCarregandoPadrao] = useState(false)

  const ctx = { uid: usuario.uid, nome: perfil.nome, funcao: perfil.funcao }

  const lista = useMemo(() => {
    const t = semAcento(busca).trim()
    return dados.itens.filter(i => {
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
        {Object.entries(TIPOS_ITEM).map(([id, nome]) => (
          <button key={id} className="pilula" aria-pressed={tipo === id} onClick={() => setTipo(id)}>
            {nome}
          </button>
        ))}
      </div>

      {ehFarmaceutico && (
        <div className="acoes bloco">
          <button className="btn" onClick={() => setEditando({ ...VAZIO })}>
            <Icone nome="entrada" tamanho={18} /> Novo item
          </button>
          <button className="btn secundario" onClick={exportar}>
            <Icone nome="baixar" tamanho={18} /> CSV
          </button>
        </div>
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

      {editando && (
        <FormularioItem
          item={editando}
          somenteLeitura={!ehFarmaceutico}
          aoFechar={() => setEditando(null)}
          aoExcluir={() => { setExcluindo(editando); setEditando(null) }}
          aoSalvar={async dadosItem => {
            await salvarItem(dadosItem, ctx, editando.id || null)
            setEditando(null)
            avisar('Item salvo.', 'ok')
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

function FormularioItem ({ item, aoSalvar, aoFechar, aoExcluir, somenteLeitura }) {
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
        somenteLeitura ? (
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
              <input className="campo" value={f.formaFarmaceutica} onChange={e => troca('formaFarmaceutica', e.target.value)} />
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
