import { useEffect, useMemo, useRef, useState } from 'react'
import BuscaItem from '../components/BuscaItem'
import BuscaProfissional from '../components/BuscaProfissional'
import { Confirmar, Icone, Vazio, useAviso } from '../components/ui'
import { useAuth } from '../lib/auth'
import { useDados } from '../lib/store'
import { salvarLancamentos } from '../lib/db'
import {
  ACOES_ESTOQUE, FINALIDADES_CONSUMO, MOTIVOS_ENTRADA, MOTIVOS_DESCARTE, MOTIVOS_DEVOLUCAO,
  cpfValido, dataBR, formatarNumero, idAleatorio, mascaraCPF, nomeDaEmbalagem,
  temEmbalagem, unidadesPorEmbalagem, vibrar
} from '../lib/utils'

const RASCUNHO = 'rascunho-movimentacao'

const ICONES = {
  entrada: 'entrada',
  consumo: 'saida',
  devolucao: 'volta',
  transferencia: 'transferencia',
  descarte: 'lixeira'
}
const TOTAL_ACOES_MANUAIS = Object.keys(ACOES_ESTOQUE).filter(acao => acao !== 'devolucao').length

/* Tipos que somam ao estoque em vez de retirar. */
const SOMA_AO_ESTOQUE = ['entrada', 'devolucao']

export default function Movimentar ({ estornoPendente, aoConsumirEstorno }) {
  const { perfil, usuario } = useAuth()
  const dados = useDados()
  const avisar = useAviso()

  const [estoqueId, setEstoqueId] = useState(() => localStorage.getItem('estoque-atual') || '')
  const [destinoId, setDestinoId] = useState('')
  const [acao, setAcao] = useState('entrada')
  const [item, setItem] = useState(null)
  const [qtd, setQtd] = useState('')
  const [lote, setLote] = useState('')
  const [validade, setValidade] = useState('')
  const [motivo, setMotivo] = useState('')
  const [observacao, setObservacao] = useState('')
  const [detalhesAbertos, setDetalhes] = useState(false)

  // Consumo
  const [finalidade, setFinalidade] = useState('')
  const [pacienteNome, setPacienteNome] = useState('')
  const [pacienteCPF, setPacienteCPF] = useState('')
  const [prescritor, setPrescritor] = useState(null)
  const [responsavel, setResponsavel] = useState(null)
  const [destinoInterno, setDestinoInterno] = useState('')

  // Descarte
  const [loteEscolhido, setLoteEscolhido] = useState(null)
  const [estornoDe, setEstornoDe] = useState('')
  const [maximoEstorno, setMaximoEstorno] = useState(0)
  // Entrada de item que vem em caixa: digita-se caixas, grava-se unidades.
  const [emEmbalagem, setEmEmbalagem] = useState(false)

  const [linhas, setLinhas] = useState(() => {
    try { return JSON.parse(localStorage.getItem(RASCUNHO) || '[]') } catch { return [] }
  })
  const [editandoId, setEditandoId] = useState(null)
  const [salvando, setSalvando] = useState(false)
  const [confirmando, setConfirmando] = useState(false)
  const [erro, setErro] = useState('')
  const [chaveBusca, setChaveBusca] = useState(0)
  const campoQtd = useRef(null)

  useEffect(() => {
    if (!estoqueId && dados.estoques.length) setEstoqueId(dados.estoques[0].id)
  }, [dados.estoques, estoqueId])

  // Estorno aberto a partir do histórico: chega com o lançamento já montado.
  useEffect(() => {
    if (!estornoPendente) return
    const m = estornoPendente
    setAcao('devolucao')
    setEstoqueId(m.estoqueId)
    setItem(dados.itemPorId(m.itemId) || null)
    setQtd(String(m.maximo || m.qtd))
    setMaximoEstorno(Number(m.maximo || m.qtd))
    setMotivo('Erro de dispensação')
    setPacienteNome(m.pacienteNome || '')
    setDestinoInterno(m.destinoInterno || m.estoqueNome || '')
    setObservacao(`Estorno do consumo de ${m.itemDescricao}`)
    setEstornoDe(m.id)
    aoConsumirEstorno && aoConsumirEstorno()
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [estornoPendente, dados, aoConsumirEstorno])

  useEffect(() => {
    if (estoqueId) localStorage.setItem('estoque-atual', estoqueId)
  }, [estoqueId])

  useEffect(() => {
    localStorage.setItem(RASCUNHO, JSON.stringify(linhas))
  }, [linhas])

  const estoque = dados.estoques.find(e => e.id === estoqueId)
  const destino = dados.estoques.find(e => e.id === destinoId)
  const acoesPermitidas = estoqueId ? dados.acoesDe(estoqueId) : []
  const acoesPermitidasNaUI = useMemo(
    () => acoesPermitidas.filter(acaoPermitida => acaoPermitida !== 'devolucao'),
    [acoesPermitidas]
  )
  const destinosPermitidos = estoqueId ? dados.destinosDe(estoqueId) : []

  // Se o local não aceitar a ação escolhida, cai na primeira que ele aceita.
  useEffect(() => {
    if (!acoesPermitidas.includes(acao)) {
      const proximaAcao = acoesPermitidasNaUI[0] || acoesPermitidas[0]
      if (!proximaAcao) return
      setAcao(proximaAcao)
      setErro('')
    }
  }, [estoqueId, acoesPermitidas, acoesPermitidasNaUI, acao])

  useEffect(() => {
    if (destinoId && !destinosPermitidos.some(d => d.id === destinoId)) setDestinoId('')
  }, [estoqueId, destinoId, destinosPermitidos])

  const saldoAtual = item && estoqueId ? dados.saldoDe(estoqueId, item.id) : 0
  const lotesDoItem = useMemo(
    () => (item && estoqueId ? dados.lotesDe(estoqueId, item.id) : [])
      .slice()
      .sort((a, b) => ((a.validade || '9999') < (b.validade || '9999') ? -1 : 1)),
    [item, estoqueId, dados]
  )

  const resumo = useMemo(() => {
    const conta = {}
    linhas.forEach(l => { conta[l.tipo] = (conta[l.tipo] || 0) + 1 })
    return conta
  }, [linhas])

  function limparFormulario () {
    setItem(null); setQtd(''); setLote(''); setValidade('')
    setObservacao(''); setEditandoId(null); setErro('')
    setFinalidade(''); setPacienteNome(''); setPacienteCPF('')
    setPrescritor(null); setResponsavel(null); setDestinoInterno('')
    setLoteEscolhido(null); setMotivo(''); setEstornoDe(''); setMaximoEstorno(0)
    setEmEmbalagem(false)
    setChaveBusca(k => k + 1)
  }

  function adicionar () {
    setErro('')
    if (!estoqueId) return setErro('Escolha o estoque.')
    if (acao === 'transferencia' && !destinoId) return setErro('Escolha o estoque de destino.')
    if (acao === 'transferencia' && destinoId === estoqueId) return setErro('Origem e destino precisam ser diferentes.')
    if (!item) return setErro('Escolha o item.')
    if (acao === 'consumo' && !finalidade) return setErro('Escolha se é dispensação a paciente ou consumo interno.')
    if (acao === 'descarte' && !motivo) return setErro('Informe o motivo do descarte.')
    if (acao === 'devolucao' && !motivo) return setErro('Informe o motivo da devolução.')

    const digitado = Number(String(qtd).replace(',', '.'))
    if (!(digitado > 0)) return setErro('Informe uma quantidade maior que zero.')
    const quantidade = emEmbalagem ? digitado * unidadesPorEmbalagem(item) : digitado
    if (estornoDe && maximoEstorno && quantidade > maximoEstorno) {
      return setErro(`O estorno não pode passar de ${maximoEstorno} — é o que resta da saída original.`)
    }

    if (!SOMA_AO_ESTOQUE.includes(acao)) {
      const jaNoRascunho = linhas
        .filter(l => l.id !== editandoId && l.itemId === item.id && l.estoqueId === estoqueId &&
          !SOMA_AO_ESTOQUE.includes(l.tipo))
        .reduce((s, l) => s + Number(l.qtd), 0)

      const disponivel = loteEscolhido
        ? (lotesDoItem.find(l => (l.lote || '') === (loteEscolhido.lote || '') &&
            (l.validade || null) === (loteEscolhido.validade || null))?.qtd || 0)
        : saldoAtual

      if (jaNoRascunho + quantidade > disponivel) {
        return setErro(
          `Saldo insuficiente: há ${formatarNumero(disponivel)} ${item.unidade?.toLowerCase()}` +
          (loteEscolhido ? ` no lote ${loteEscolhido.lote || 'sem lote'}` : ` em ${estoque?.nome}`) +
          (jaNoRascunho ? ` e ${formatarNumero(jaNoRascunho)} já está reservado nesta lista.` : '.')
        )
      }
    }

    const linha = {
      id: editandoId || idAleatorio(),
      tipo: acao,
      estoqueId,
      estoqueNome: estoque?.nome || '',
      estoqueDestinoId: acao === 'transferencia' ? destinoId : null,
      estoqueDestinoNome: acao === 'transferencia' ? destino?.nome || '' : null,
      itemId: item.id,
      itemCodigo: item.codigo,
      itemDescricao: item.descricao,
      itemUnidade: item.unidade,
      itemTipo: item.tipo,
      itemGrupoATC: item.grupoATC,
      itemGrupoFarmacologico: item.grupoFarmacologico,
      itemControlado: item.controlado,
      qtd: quantidade,
      lote: SOMA_AO_ESTOQUE.includes(acao) ? lote.trim() : '',
      validade: SOMA_AO_ESTOQUE.includes(acao) ? (validade || null) : null,
      loteEscolhido: acao === 'descarte' ? loteEscolhido : null,
      motivo,
      observacao: observacao.trim(),
      finalidade: acao === 'consumo' ? finalidade : '',
      pacienteNome: (acao === 'devolucao' || (acao === 'consumo' && finalidade === 'paciente'))
        ? pacienteNome.trim() : '',
      pacienteCPF: acao === 'consumo' && finalidade === 'paciente' ? pacienteCPF.trim() : '',
      prescritorNome: acao === 'consumo' && finalidade === 'paciente' ? (prescritor?.nome || '') : '',
      prescritorConselho: acao === 'consumo' && finalidade === 'paciente' ? (prescritor?.conselho || '') : '',
      responsavelNome: acao === 'consumo' ? (responsavel?.nome || '') : '',
      responsavelConselho: acao === 'consumo' ? (responsavel?.conselho || '') : '',
      destinoInterno: (acao === 'devolucao' || (acao === 'consumo' && finalidade === 'interno'))
        ? destinoInterno.trim() : '',
      estornoDe: estornoDe || ''
    }

    setLinhas(atual => (editandoId ? atual.map(l => (l.id === editandoId ? linha : l)) : [linha, ...atual]))
    vibrar()
    limparFormulario()
  }

  function editar (linha) {
    setAcao(linha.tipo)
    setEstoqueId(linha.estoqueId)
    setDestinoId(linha.estoqueDestinoId || '')
    setItem(dados.itemPorId(linha.itemId) || null)
    setQtd(String(linha.qtd))
    setLote(linha.lote || '')
    setValidade(linha.validade || '')
    setMotivo(linha.motivo || '')
    setObservacao(linha.observacao || '')
    setFinalidade(linha.finalidade || '')
    setPacienteNome(linha.pacienteNome || '')
    setPacienteCPF(linha.pacienteCPF || '')
    setPrescritor(linha.prescritorNome ? { nome: linha.prescritorNome, conselho: linha.prescritorConselho } : null)
    setResponsavel(linha.responsavelNome ? { nome: linha.responsavelNome, conselho: linha.responsavelConselho } : null)
    setDestinoInterno(linha.destinoInterno || '')
    setLoteEscolhido(linha.loteEscolhido || null)
    setEditandoId(linha.id)
    setDetalhes(Boolean(linha.lote || linha.validade || linha.observacao))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function salvar () {
    setConfirmando(false)
    setSalvando(true)
    setErro('')
    try {
      const ctx = { uid: usuario.uid, nome: perfil.nome, funcao: perfil.farmacia?.funcao || '' }
      const total = await salvarLancamentos(linhas, ctx, {
        permitirNegativo: dados.config.permitirSaldoNegativo
      })
      setLinhas([])
      limparFormulario()
      avisar(`${total} lançamento(s) gravados no estoque.`, 'ok')
    } catch (e) {
      console.error('ERRO AO SALVAR LANCAMENTOS', e)
      setErro(e.message || 'Não foi possível salvar.')
      avisar('Nada foi gravado. Veja o aviso na tela.', 'erro')
     
    } finally {
      setSalvando(false)
    }
  }

  if (!dados.estoques.length) {
    return (
      <Vazio
        titulo="Nenhum local de estoque cadastrado"
        texto="Peça ao administrador para cadastrar os locais em Mais › Locais de estoque."
      />
    )
  }

  const cpfSuspeito = pacienteCPF.replace(/\D/g, '').length === 11 && !cpfValido(pacienteCPF)

  return (
    <>
      <div className="bloco">
        <label className="rotulo" htmlFor="estoque">
          {acao === 'transferencia' ? 'Estoque de origem' : 'Estoque'}
        </label>
        <select id="estoque" className="campo" value={estoqueId} onChange={e => setEstoqueId(e.target.value)}>
          {dados.estoques.map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}
        </select>
      </div>

      <div className="bloco">
        <label className="rotulo">O que você vai fazer</label>
        <div className="acao-grupo">
          {Object.entries(ACOES_ESTOQUE)
            .filter(([id]) => id !== 'devolucao' && acoesPermitidas.includes(id))
            .map(([id, rotulo]) => (
              <button
                key={id}
                className={'acao-btn ' + id}
                aria-pressed={acao === id}
                onClick={() => { setAcao(id); setErro(''); setMotivo(''); vibrar() }}
              >
                <Icone nome={ICONES[id]} />
                {rotulo}
              </button>
            ))}
        </div>
        {acoesPermitidasNaUI.length > 0 && acoesPermitidasNaUI.length < TOTAL_ACOES_MANUAIS && (
          <p className="dica" style={{ marginTop: 7 }}>
            {estoque?.nome} está configurado para{' '}
            {acoesPermitidasNaUI.map(a => ACOES_ESTOQUE[a].toLowerCase()).join(', ')}.
          </p>
        )}
      </div>

      {acao === 'transferencia' && (
        <div className="bloco">
          <label className="rotulo" htmlFor="destino">Estoque de destino</label>
          <select id="destino" className="campo" value={destinoId} onChange={e => setDestinoId(e.target.value)}>
            <option value="">Escolha o destino…</option>
            {destinosPermitidos.map(e => <option key={e.id} value={e.id}>{e.nome}</option>)}
          </select>
        </div>
      )}

      <div className="bloco">
        <label className="rotulo">Item</label>
        <BuscaItem
          key={chaveBusca}
          estoqueId={estoqueId}
          escolhido={item}
          aoEscolher={i => { setItem(i); setTimeout(() => campoQtd.current?.focus(), 60) }}
          aoLimpar={() => { setItem(null); setChaveBusca(k => k + 1) }}
        />
      </div>

      {item && (
        <>
          {temEmbalagem(item) && SOMA_AO_ESTOQUE.includes(acao) && (
            <div className="bloco">
              <label className="rotulo">Vou lançar em</label>
              <div className="acao-grupo" style={{ gridTemplateColumns: '1fr 1fr' }}>
                <button
                  className="acao-btn consumo" aria-pressed={!emEmbalagem}
                  onClick={() => setEmEmbalagem(false)} style={{ minHeight: 50 }}
                >{item.unidade?.toLowerCase()}</button>
                <button
                  className="acao-btn consumo" aria-pressed={emEmbalagem}
                  onClick={() => setEmEmbalagem(true)} style={{ minHeight: 50 }}
                >{nomeDaEmbalagem(item).toLowerCase()} c/{unidadesPorEmbalagem(item)}</button>
              </div>
            </div>
          )}

          <div className="bloco">
            <label className="rotulo" htmlFor="qtd">
              Quantidade em {emEmbalagem
                ? `${nomeDaEmbalagem(item).toLowerCase()} de ${unidadesPorEmbalagem(item)}`
                : item.unidade?.toLowerCase()}
            </label>
            <input
              id="qtd" ref={campoQtd} className="campo num" value={qtd}
              onChange={e => setQtd(e.target.value.replace(/[^\d.,]/g, ''))}
              onKeyDown={e => { if (e.key === 'Enter') adicionar() }}
              inputMode="decimal" placeholder="0" enterKeyHint="done"
            />
            {emEmbalagem && qtd && (
              <p className="dica" style={{ marginTop: 6 }}>
                Entram <b>{formatarNumero(Number(String(qtd).replace(',', '.')) * unidadesPorEmbalagem(item))}</b>
                {' '}{item.unidade?.toLowerCase()} no estoque.
              </p>
            )}

            <div className="pilulas" style={{ marginTop: 8, marginBottom: 0 }}>
              {[1, 5, 10, 20, 50, 100].map(n => (
                <button
                  key={n} className="pilula"
                  onClick={() => { setQtd(v => String((Number(String(v).replace(',', '.')) || 0) + n)); vibrar(8) }}
                >+{n}</button>
              ))}
              {qtd && <button className="pilula" onClick={() => setQtd('')}>limpar</button>}
            </div>
          </div>

          {/* ---------- CONSUMO ---------- */}
          {acao === 'consumo' && (
            <div className="bloco">
              <label className="rotulo">Para que foi usado</label>
              <div className="acao-grupo" style={{ gridTemplateColumns: '1fr 1fr' }}>
                {Object.entries(FINALIDADES_CONSUMO).map(([id, rotulo]) => (
                  <button
                    key={id} className="acao-btn consumo" aria-pressed={finalidade === id}
                    onClick={() => { setFinalidade(id); setErro(''); vibrar(8) }}
                    style={{ minHeight: 54 }}
                  >{rotulo}</button>
                ))}
              </div>

              {finalidade === 'paciente' && (
                <div className="cartao" style={{ marginTop: 12, display: 'grid', gap: 12 }}>
                  <p className="dica">Todos os campos abaixo são opcionais.</p>
                  <div>
                    <label className="rotulo" htmlFor="pac">Paciente</label>
                    <input
                      id="pac" className="campo" value={pacienteNome}
                      onChange={e => setPacienteNome(e.target.value)}
                      autoCapitalize="words" placeholder="Nome do paciente"
                    />
                  </div>
                  <div>
                    <label className="rotulo" htmlFor="cpf">CPF</label>
                    <input
                      id="cpf" className="campo num" value={pacienteCPF} inputMode="numeric"
                      onChange={e => setPacienteCPF(mascaraCPF(e.target.value))}
                      placeholder="000.000.000-00"
                    />
                    {cpfSuspeito && (
                      <p className="dica" style={{ color: 'var(--transf)', marginTop: 5 }}>
                        Esse CPF não passa na conferência dos dígitos. Confira — mesmo assim dá para salvar.
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="rotulo">Prescritor</label>
                    <BuscaProfissional
                      tipos={['prescritor']} rotulo="prescritor"
                      escolhido={prescritor}
                      aoEscolher={setPrescritor}
                      aoLimpar={() => setPrescritor(null)}
                    />
                  </div>
                  <div>
                    <label className="rotulo">Quem administrou / dispensou</label>
                    <BuscaProfissional
                      tipos={['enfermeiro', 'tecnico', 'farmaceutico']} rotulo="responsável"
                      escolhido={responsavel}
                      aoEscolher={setResponsavel}
                      aoLimpar={() => setResponsavel(null)}
                    />
                  </div>
                </div>
              )}

              {finalidade === 'interno' && (
                <div className="cartao" style={{ marginTop: 12, display: 'grid', gap: 12 }}>
                  <div>
                    <label className="rotulo" htmlFor="dint">Onde foi usado</label>
                    <input
                      id="dint" className="campo" value={destinoInterno}
                      onChange={e => setDestinoInterno(e.target.value)}
                      placeholder="Ex.: sala de curativo, carrinho de emergência"
                    />
                  </div>
                  <div>
                    <label className="rotulo">Responsável</label>
                    <BuscaProfissional
                      tipos={['enfermeiro', 'tecnico', 'farmaceutico']} rotulo="responsável"
                      escolhido={responsavel}
                      aoEscolher={setResponsavel}
                      aoLimpar={() => setResponsavel(null)}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ---------- DEVOLUÇÃO ---------- */}
          {acao === 'devolucao' && (
            <div className="bloco">
              {estornoDe && (
                <div className="aviso-caixa" style={{ marginBottom: 12 }}>
                  Estorno de uma saída já registrada. Máximo a devolver: <b>{maximoEstorno}</b>.
                </div>
              )}
              <div className="info-caixa" style={{ marginBottom: 12 }}>
                O item volta para o saldo deste estoque. Use para sobra de setor,
                alta do paciente ou correção de uma baixa feita errado.
              </div>

              <label className="rotulo" htmlFor="mdev">Motivo da devolução</label>
              <select id="mdev" className="campo" value={motivo} onChange={e => { setMotivo(e.target.value); setErro('') }}>
                <option value="">Escolha o motivo…</option>
                {MOTIVOS_DEVOLUCAO.map(m => <option key={m} value={m}>{m}</option>)}
              </select>

              <div className="cartao" style={{ marginTop: 12, display: 'grid', gap: 12 }}>
                <p className="dica">Quem devolveu, se quiser registrar.</p>
                <div>
                  <label className="rotulo" htmlFor="devsetor">Setor de origem</label>
                  <input
                    id="devsetor" className="campo" value={destinoInterno}
                    onChange={e => setDestinoInterno(e.target.value)}
                    placeholder="Ex.: Clínica Médica, Emergência"
                  />
                </div>
                <div>
                  <label className="rotulo" htmlFor="devpac">Paciente</label>
                  <input
                    id="devpac" className="campo" value={pacienteNome}
                    onChange={e => setPacienteNome(e.target.value)}
                    autoCapitalize="words"
                  />
                </div>
              </div>
            </div>
          )}

          {/* ---------- DESCARTE ---------- */}
          {acao === 'descarte' && (
            <div className="bloco">
              <label className="rotulo" htmlFor="mdesc">Motivo do descarte</label>
              <select id="mdesc" className="campo" value={motivo} onChange={e => { setMotivo(e.target.value); setErro('') }}>
                <option value="">Escolha o motivo…</option>
                {MOTIVOS_DESCARTE.map(m => <option key={m} value={m}>{m}</option>)}
              </select>

              {lotesDoItem.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <label className="rotulo">Lote a descartar</label>
                  <div className="pilulas" style={{ marginBottom: 0 }}>
                    <button
                      className="pilula" aria-pressed={!loteEscolhido}
                      onClick={() => setLoteEscolhido(null)}
                    >Automático (vence antes)</button>
                    {lotesDoItem.map(l => (
                      <button
                        key={l.id} className="pilula"
                        aria-pressed={
                          loteEscolhido?.lote === (l.lote || '') &&
                          loteEscolhido?.validade === (l.validade || null)
                        }
                        onClick={() => setLoteEscolhido({ lote: l.lote || '', validade: l.validade || null })}
                      >
                        {l.lote || 'sem lote'} · {dataBR(l.validade)} · {formatarNumero(l.qtd)}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ---------- Detalhes ---------- */}
          <div className="bloco">
            <button className="btn fantasma pequeno" style={{ padding: 0 }} onClick={() => setDetalhes(v => !v)}>
              {detalhesAbertos ? '− ' : '+ '}
              {SOMA_AO_ESTOQUE.includes(acao) ? 'Lote, validade e origem (opcional)' : 'Outros detalhes (opcional)'}
            </button>

            {detalhesAbertos && (
              <div className="cartao" style={{ marginTop: 10, display: 'grid', gap: 12 }}>
                {SOMA_AO_ESTOQUE.includes(acao) && (
                  <>
                    <div className="linha-campos">
                      <div>
                        <label className="rotulo" htmlFor="lote">Lote</label>
                        <input
                          id="lote" className="campo" value={lote}
                          onChange={e => setLote(e.target.value.toUpperCase())}
                          placeholder="Ex.: ABC1234" autoCapitalize="characters"
                        />
                      </div>
                      <div>
                        <label className="rotulo" htmlFor="validade">Validade</label>
                        <input
                          id="validade" className="campo" type="date" value={validade}
                          onChange={e => setValidade(e.target.value)}
                        />
                      </div>
                    </div>
                    {acao === 'entrada' && (
                      <div>
                        <label className="rotulo" htmlFor="morig">Origem</label>
                        <select id="morig" className="campo" value={motivo} onChange={e => setMotivo(e.target.value)}>
                          <option value="">Não informar</option>
                          {MOTIVOS_ENTRADA.map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                      </div>
                    )}
                  </>
                )}
                <div>
                  <label className="rotulo" htmlFor="obs">Observação</label>
                  <textarea
                    id="obs" className="campo" value={observacao}
                    onChange={e => setObservacao(e.target.value)}
                    placeholder="Qualquer detalhe que precise ficar registrado"
                    style={{ minHeight: 70 }}
                  />
                </div>
              </div>
            )}
          </div>

          {erro && <div className="erro-caixa bloco">{erro}</div>}

          <div className="acoes bloco">
            {editandoId && <button className="btn secundario" onClick={limparFormulario}>Cancelar edição</button>}
            <button className="btn" onClick={adicionar}>
              <Icone nome={editandoId ? 'certo' : 'entrada'} tamanho={18} />
              {editandoId ? 'Atualizar lançamento' : 'Adicionar à lista'}
            </button>
          </div>
        </>
      )}

      {!item && erro && <div className="erro-caixa bloco">{erro}</div>}

      <div className="bloco" style={{ marginTop: 22 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 10 }}>
          <h2 style={{ fontSize: 16 }}>Lançamentos pendentes</h2>
          <span className="dica">{linhas.length ? `${linhas.length} na lista` : 'nada ainda'}</span>
        </div>

        {linhas.length === 0 ? (
          <Vazio
            titulo="A lista está vazia"
            texto="Escolha o item e a quantidade acima. Nada muda no estoque enquanto você não salvar."
          />
        ) : (
          <div className="rascunho">
            {linhas.map(l => (
              <div key={l.id} className={'lanc ' + l.tipo}>
                <div className="corpo">
                  <div className="titulo">{l.itemDescricao}</div>
                  <div className="sub">
                    {l.tipo === 'transferencia'
                      ? `${l.estoqueNome} → ${l.estoqueDestinoNome}`
                      : l.estoqueNome}
                    {l.finalidade === 'paciente' && ` · ${l.pacienteNome || 'paciente não identificado'}`}
                    {l.finalidade === 'interno' && ` · uso interno${l.destinoInterno ? ': ' + l.destinoInterno : ''}`}
                    {l.prescritorNome && ` · presc. ${l.prescritorNome}`}
                    {l.lote && ` · lote ${l.lote}`}
                    {l.validade && ` · vence ${dataBR(l.validade)}`}
                    {l.loteEscolhido && ` · lote ${l.loteEscolhido.lote || 'sem lote'}`}
                    {l.motivo && ` · ${l.motivo}`}
                  </div>
                </div>
                <div className={'qtd num ' + l.tipo}>
                  {SOMA_AO_ESTOQUE.includes(l.tipo) ? '+' : l.tipo === 'transferencia' ? '⇄' : '−'}
                  {formatarNumero(l.qtd)}
                </div>
                <div className="btns">
                  <button onClick={() => editar(l)} aria-label="Editar lançamento">
                    <Icone nome="lapis" tamanho={16} />
                  </button>
                  <button onClick={() => setLinhas(a => a.filter(x => x.id !== l.id))} aria-label="Remover lançamento">
                    <Icone nome="lixeira" tamanho={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {linhas.length > 0 && (
        <div className="barra-salvar">
          <div className="resumo">
            <b>{linhas.length} lançamento{linhas.length > 1 ? 's' : ''}</b>
            {Object.entries(resumo)
              .map(([t, n]) => `${n} ${ACOES_ESTOQUE[t]?.toLowerCase() || t}`)
              .join(' · ')}
          </div>
          <button className="btn" onClick={() => setConfirmando(true)} disabled={salvando}>
            {salvando ? 'Gravando…' : 'Salvar no estoque'}
          </button>
        </div>
      )}

      {confirmando && (
        <Confirmar
          titulo="Gravar no estoque?"
          texto={`${linhas.length} lançamento(s) serão aplicados aos saldos. Depois de gravado, o histórico não pode ser apagado — a correção é feita por um novo lançamento ou pelo inventário.`}
          rotuloConfirmar="Gravar agora"
          aoConfirmar={salvar}
          aoFechar={() => setConfirmando(false)}
        />
      )}
    </>
  )
}
