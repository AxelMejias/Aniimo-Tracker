// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { catalogoDeReferencia, sugerenciaDeReferencia } from '../../../../../tests/fixtures/calculo'
import { instalarApi } from '../../../../../tests/fixtures/apiFalsa'
import { fichaDeReferencia } from '../../../../../tests/fixtures/ficha'
import type {
  CatalogoResumen,
  ResultadoCalcular,
  ResultadoCatalogo,
  Sugerencia
} from '../../../../shared/calculo'
import type { Ficha } from '../../../../shared/teams'
import FichaAniimo from '../aniimo/FichaAniimo'

afterEach(cleanup)

const TEAM_ID = '00000000-0000-4000-8000-000000000001'
const TEXTO_DE_EJEMPLO =
  'Datos de ejemplo: estos números son inventados y no sirven para el juego real.'

function fichaEjemplo(cambios: Partial<Ficha> = {}): Ficha {
  const base = fichaDeReferencia()
  const objetos = base.objetos.map((objeto) =>
    objeto.posicion === 'equipado' ? { ...objeto, nombre: 'Ejemplo objeto X', nivel: 1 } : objeto
  )
  return { ...base, nombre: 'ejemplo aniimo a', objetos, slot: 1, tieneImagen: false, ...cambios }
}

function conFicha(ficha: Ficha = fichaEjemplo()) {
  return { obtenerFicha: async () => ({ ok: true as const, ficha }) }
}

async function abrirEditor(): Promise<{ alSesionVencida: ReturnType<typeof vi.fn> }> {
  const alSesionVencida = vi.fn()
  render(
    <FichaAniimo
      teamId={TEAM_ID}
      slot={1}
      alVolver={vi.fn()}
      alSesionVencida={alSesionVencida}
      recodificar={vi.fn()}
    />
  )
  await screen.findByLabelText('Nombre')
  return { alSesionVencida }
}

async function abrirPanel(): Promise<void> {
  fireEvent.click(screen.getByRole('button', { name: 'Sugerencia de stats' }))
  await screen.findByLabelText('Especie del catálogo')
}

function fila(etiqueta: string): HTMLElement {
  const encontrada = screen
    .getAllByRole('row')
    .find((candidata) => within(candidata).queryByRole('rowheader', { name: etiqueta }) !== null)
  if (encontrada === undefined) {
    throw new Error(`no hay fila para ${etiqueta}`)
  }
  return encontrada
}

function campo(etiqueta: string): HTMLInputElement {
  return screen.getByLabelText(etiqueta) as HTMLInputElement
}

function calcular(): void {
  fireEvent.click(screen.getByRole('button', { name: 'Calcular' }))
}

async function calculado(): Promise<void> {
  await abrirPanel()
  calcular()
  await screen.findByRole('table')
}

function conSugerencia(cambios: (base: Sugerencia) => Sugerencia): {
  calcular: () => Promise<ResultadoCalcular>
} {
  return { calcular: async () => ({ ok: true, sugerencia: cambios(sugerenciaDeReferencia()) }) }
}

describe('apertura de la seccion', () => {
  it('esta plegada y no pide el catalogo hasta abrirla', async () => {
    const api = instalarApi({ teams: conFicha() })
    await abrirEditor()

    expect(screen.getByRole('button', { name: 'Sugerencia de stats' })).toHaveAttribute(
      'aria-expanded',
      'false'
    )
    expect(screen.queryByLabelText('Especie del catálogo')).toBeNull()
    expect(api.calculo.obtenerCatalogo).not.toHaveBeenCalled()
  })

  it('al abrirla pide el catalogo una sola vez, aunque se cierre y se vuelva a abrir', async () => {
    const api = instalarApi({ teams: conFicha() })
    await abrirEditor()
    await abrirPanel()

    const alternar = screen.getByRole('button', { name: 'Sugerencia de stats' })
    fireEvent.click(alternar)
    fireEvent.click(alternar)

    await screen.findByLabelText('Especie del catálogo')
    expect(api.calculo.obtenerCatalogo).toHaveBeenCalledTimes(1)
  })

  it('muestra el cartel fijo de datos de ejemplo', async () => {
    instalarApi({ teams: conFicha() })
    await abrirEditor()
    await abrirPanel()

    expect(screen.getByText(TEXTO_DE_EJEMPLO)).toBeInTheDocument()
  })

  it('no muestra el cartel cuando el catalogo no es de ejemplo', async () => {
    const real: CatalogoResumen = { ...catalogoDeReferencia(), esEjemplo: false }
    instalarApi({
      teams: conFicha(),
      calculo: { obtenerCatalogo: async () => ({ ok: true, catalogo: real }) }
    })
    await abrirEditor()
    await abrirPanel()

    expect(screen.queryByText(TEXTO_DE_EJEMPLO)).toBeNull()
  })

  it('lista lo que el catalogo no incluye', async () => {
    const parcial: CatalogoResumen = { ...catalogoDeReferencia(), sinDatos: ['cp', 'objetos'] }
    instalarApi({
      teams: conFicha(),
      calculo: { obtenerCatalogo: async () => ({ ok: true, catalogo: parcial }) }
    })
    await abrirEditor()
    await abrirPanel()

    expect(screen.getByText('No incluye: cp, objetos')).toBeInTheDocument()
  })
})

describe('especie y objetos del catalogo', () => {
  it('preselecciona la especie y el objeto cuando el nombre de la ficha coincide', async () => {
    instalarApi({ teams: conFicha() })
    await abrirEditor()
    await abrirPanel()

    expect(campo('Especie del catálogo').value).toBe('ejemplo-a')
    expect(campo('Objeto equipado del catálogo').value).toBe('ejemplo-objeto-x')
    expect(campo('Objeto alternativo del catálogo').value).toBe('')
    expect(screen.getByRole('button', { name: 'Calcular' })).toBeEnabled()
  })

  it('con un nombre de especie que no coincide queda sin elegir y Calcular deshabilitado', async () => {
    instalarApi({ teams: conFicha(fichaEjemplo({ nombre: 'Irisalis' })) })
    await abrirEditor()
    await abrirPanel()

    expect(campo('Especie del catálogo').value).toBe('')
    expect(screen.getByRole('button', { name: 'Calcular' })).toBeDisabled()
    expect(screen.getByText('Elegí una especie del catálogo para calcular')).toBeInTheDocument()
  })

  it('elegir la especie a mano habilita Calcular', async () => {
    instalarApi({ teams: conFicha(fichaEjemplo({ nombre: 'Irisalis' })) })
    await abrirEditor()
    await abrirPanel()

    fireEvent.change(campo('Especie del catálogo'), { target: { value: 'ejemplo-b' } })

    expect(screen.getByRole('button', { name: 'Calcular' })).toBeEnabled()
  })

  it('con un objeto sin coincidencia queda sin elegir y Calcular sigue habilitado', async () => {
    const base = fichaEjemplo()
    const objetos = base.objetos.map((o) =>
      o.posicion === 'equipado' ? { ...o, nombre: 'Corona antigua' } : o
    )
    instalarApi({ teams: conFicha({ ...base, objetos }) })
    await abrirEditor()
    await abrirPanel()

    expect(campo('Objeto equipado del catálogo').value).toBe('')
    expect(screen.getByRole('button', { name: 'Calcular' })).toBeEnabled()
  })

  it('no ofrece selector para un objeto que no esta cargado en la ficha', async () => {
    const base = fichaEjemplo()
    instalarApi({ teams: conFicha({ ...base, objetos: [] }) })
    await abrirEditor()
    await abrirPanel()

    expect(screen.queryByLabelText('Objeto equipado del catálogo')).toBeNull()
    expect(screen.queryByLabelText('Objeto alternativo del catálogo')).toBeNull()
  })

  it('calcular manda la especie, el nivel de la ficha y el objeto elegido', async () => {
    const api = instalarApi({ teams: conFicha() })
    await abrirEditor()
    await calculado()

    expect(api.calculo.calcular).toHaveBeenCalledTimes(1)
    expect(api.calculo.calcular).toHaveBeenCalledWith({
      especieId: 'ejemplo-a',
      nivel: 60,
      potenciales: { ps: 11, atq: 20, def_fisica: 5, def_magica: 4, regen: 20, quiebre: 6 },
      etapaEstrella: 6,
      personalidad: 'ENFJ',
      objetos: [
        { posicion: 'equipado', objetoId: 'ejemplo-objeto-x', nivel: 1 },
        { posicion: 'alternativo', objetoId: null, nivel: 4 }
      ]
    })
  })
})

describe('entrada incompleta', () => {
  it('con el nivel vacio Calcular queda deshabilitado, con el motivo y sin llamar al calculo', async () => {
    const api = instalarApi({ teams: conFicha() })
    await abrirEditor()
    await abrirPanel()

    fireEvent.change(campo('Nivel'), { target: { value: '' } })

    expect(screen.getByRole('button', { name: 'Calcular' })).toBeDisabled()
    expect(screen.getByText('Revisá el nivel: debe ser un número entre 1 y 999')).toBeInTheDocument()
    expect(api.calculo.calcular).not.toHaveBeenCalled()
  })

  it('con un potencial no numerico Calcular queda deshabilitado', async () => {
    instalarApi({ teams: conFicha() })
    await abrirEditor()
    await abrirPanel()

    fireEvent.change(campo('ATQ potencial'), { target: { value: 'x' } })

    expect(screen.getByRole('button', { name: 'Calcular' })).toBeDisabled()
    expect(screen.getByText(/Revisá el potencial de ATQ/)).toBeInTheDocument()
  })
})

describe('interruptor de objetos', () => {
  it('esta encendido por defecto y apagarlo cambia lo mostrado sin otra request', async () => {
    const api = instalarApi({ teams: conFicha() })
    await abrirEditor()
    await calculado()

    expect(screen.getByLabelText('Incluir objetos')).toBeChecked()
    expect(within(fila('ATQ')).getByText('522 aprox.')).toBeInTheDocument()
    expect(within(fila('CP')).getByText('642 aprox.')).toBeInTheDocument()

    fireEvent.click(screen.getByLabelText('Incluir objetos'))

    expect(within(fila('ATQ')).getByText('474 aprox.')).toBeInTheDocument()
    expect(within(fila('CP')).getByText('594 aprox.')).toBeInTheDocument()
    expect(api.calculo.calcular).toHaveBeenCalledTimes(1)
  })

  it('Usar aplica el valor que muestra el interruptor', async () => {
    instalarApi({ teams: conFicha() })
    await abrirEditor()
    await calculado()
    fireEvent.click(screen.getByLabelText('Incluir objetos'))

    fireEvent.click(screen.getByRole('button', { name: 'Usar ATQ' }))

    expect(campo('ATQ valor').value).toBe('474')
  })
})

describe('usar una sugerencia', () => {
  it('Usar en ATQ cambia solo ATQ y no guarda nada', async () => {
    const api = instalarApi({ teams: conFicha() })
    await abrirEditor()
    const antes = Object.fromEntries(
      ['PS', 'DEF física', 'DEF mágica', 'Regen', 'Quiebre', 'CP'].map((e) => [
        e,
        e === 'CP' ? campo('CP').value : campo(`${e} valor`).value
      ])
    )
    await calculado()

    fireEvent.click(screen.getByRole('button', { name: 'Usar ATQ' }))

    expect(campo('ATQ valor').value).toBe('522')
    expect(campo('PS valor').value).toBe(antes.PS)
    expect(campo('CP').value).toBe(antes.CP)
    expect(api.teams.guardarFicha).not.toHaveBeenCalled()
  })

  it('Usar en el CP cambia solo el CP', async () => {
    const api = instalarApi({ teams: conFicha() })
    await abrirEditor()
    const atqAntes = campo('ATQ valor').value
    await calculado()

    fireEvent.click(screen.getByRole('button', { name: 'Usar CP' }))

    expect(campo('CP').value).toBe('642')
    expect(campo('ATQ valor').value).toBe(atqAntes)
    expect(api.teams.guardarFicha).not.toHaveBeenCalled()
  })

  it('Usar todas aplica los stats con valor y el CP, y salta los nulos', async () => {
    instalarApi({
      teams: conFicha(),
      calculo: conSugerencia((base) => ({
        ...base,
        stats: {
          ...base.stats,
          quiebre: {
            ...base.stats.quiebre,
            valor: null,
            valorConObjetos: null,
            motivo: 'fuera-de-rango'
          }
        },
        cp: { ...base.cp, valor: null, valorConObjetos: null, motivo: 'sin-datos' }
      }))
    })
    await abrirEditor()
    const quiebreAntes = campo('Quiebre valor').value
    const cpAntes = campo('CP').value
    await calculado()

    fireEvent.click(screen.getByRole('button', { name: 'Usar todas' }))

    expect(campo('PS valor').value).toBe('1000')
    expect(campo('ATQ valor').value).toBe('522')
    expect(campo('Quiebre valor').value).toBe(quiebreAntes)
    expect(campo('CP').value).toBe(cpAntes)
  })

  it('nada cambia sin un clic en Usar', async () => {
    instalarApi({ teams: conFicha() })
    await abrirEditor()
    const antes = campo('ATQ valor').value
    await calculado()

    expect(campo('ATQ valor').value).toBe(antes)
  })

  it('muestra lo cargado, lo sugerido y la diferencia', async () => {
    instalarApi({ teams: conFicha() })
    await abrirEditor()
    await calculado()

    const atq = within(fila('ATQ'))
    expect(atq.getByText('723')).toBeInTheDocument()
    expect(atq.getByText('522 aprox.')).toBeInTheDocument()
    expect(atq.getByText('-201')).toBeInTheDocument()
    expect(within(fila('PS')).getByText('1000')).toBeInTheDocument()
    expect(within(fila('PS')).getByText('-10321')).toBeInTheDocument()
  })

  it('el desglose lista cada termino', async () => {
    instalarApi({ teams: conFicha() })
    await abrirEditor()
    await calculado()

    const desglose = within(fila('ATQ'))
    expect(desglose.getByText('Desglose')).toBeInTheDocument()
    expect(desglose.getByText(/base: nivel 30/)).toBeInTheDocument()
  })
})

describe('casos sin valor', () => {
  it('un stat fuera de rango muestra el motivo y su Usar esta deshabilitado', async () => {
    instalarApi({
      teams: conFicha(),
      calculo: conSugerencia((base) => ({
        ...base,
        stats: {
          ...base.stats,
          ps: { ...base.stats.ps, valor: null, valorConObjetos: null, motivo: 'fuera-de-rango' }
        }
      }))
    })
    await abrirEditor()
    await calculado()

    expect(within(fila('PS')).getByText('fuera del rango medido')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Usar PS' })).toBeDisabled()
  })

  it('el CP sin formula dice sin datos y su Usar esta deshabilitado, con los stats a la vista', async () => {
    instalarApi({
      teams: conFicha(),
      calculo: conSugerencia((base) => ({
        ...base,
        cp: { ...base.cp, valor: null, valorConObjetos: null, motivo: 'sin-datos' },
        sinDatos: ['cp']
      }))
    })
    await abrirEditor()
    await calculado()

    expect(within(fila('CP')).getByText('sin datos')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Usar CP' })).toBeDisabled()
    expect(within(fila('ATQ')).getByText('522 aprox.')).toBeInTheDocument()
    expect(screen.getByText('No incluye: cp')).toBeInTheDocument()
  })

  it('una nota visible por cada objeto que no se tuvo en cuenta', async () => {
    instalarApi({
      teams: conFicha(),
      calculo: conSugerencia((base) => ({
        ...base,
        objetos: [
          { posicion: 'equipado', aplicado: false, nota: 'objeto-desconocido' },
          { posicion: 'alternativo', aplicado: false, nota: 'alternativo-no-suma' }
        ]
      }))
    })
    await abrirEditor()
    await calculado()

    expect(
      screen.getByText('El objeto equipado no se tuvo en cuenta: no está en el catálogo.')
    ).toBeInTheDocument()
    expect(
      screen.getByText('El objeto alternativo no se tuvo en cuenta: el alternativo no suma.')
    ).toBeInTheDocument()
    expect(within(fila('ATQ')).getByText('522 aprox.')).toBeInTheDocument()
  })

  it('un objeto aplicado no deja ninguna nota', async () => {
    instalarApi({ teams: conFicha() })
    await abrirEditor()
    await calculado()

    expect(screen.queryByText(/no se tuvo en cuenta/)).toBeNull()
  })
})

describe('guardar sin usar la sugerencia', () => {
  it('calcular y guardar sin Usar envia exactamente lo cargado a mano', async () => {
    const api = instalarApi({ teams: conFicha(fichaEjemplo()) })
    await abrirEditor()
    await calculado()

    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))

    await waitFor(() => expect(api.teams.guardarFicha).toHaveBeenCalledTimes(1))
    const enviada = api.teams.guardarFicha.mock.calls[0]?.[0].ficha
    expect(enviada.cp).toBe(3475)
    expect(enviada.stats.atq.valorActual).toBe(723)
    expect(enviada.stats.ps.valorActual).toBe(11321)
  })

  it('usar un stat y guardar envia ese valor', async () => {
    const api = instalarApi({ teams: conFicha() })
    await abrirEditor()
    await calculado()
    fireEvent.click(screen.getByRole('button', { name: 'Usar ATQ' }))

    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))

    await waitFor(() => expect(api.teams.guardarFicha).toHaveBeenCalledTimes(1))
    expect(api.teams.guardarFicha.mock.calls[0]?.[0].ficha.stats.atq.valorActual).toBe(522)
    expect(JSON.stringify(api.teams.guardarFicha.mock.calls[0]?.[0])).not.toMatch(
      /especie|ejemplo-a|incluirObjetos/i
    )
  })
})

describe('estrella actual', () => {
  it('cambiarla no desactualiza la sugerencia porque ningun calculo la usa', async () => {
    instalarApi({ teams: conFicha() })
    await abrirEditor()
    await calculado()

    fireEvent.change(campo('Estrella actual'), { target: { value: '9' } })

    expect(screen.queryByText(/desactualizada/)).toBeNull()
  })

  it('con la etapa sin cargar Calcular queda deshabilitado con el motivo', async () => {
    const api = instalarApi({
      teams: conFicha(fichaEjemplo({ etapaEstrella: null }))
    })
    await abrirEditor()
    await abrirPanel()

    expect(screen.getByRole('button', { name: 'Calcular' })).toBeDisabled()
    expect(screen.getByText('Cargá la etapa de estrella (T0-T7)')).toBeInTheDocument()
    expect(api.calculo.calcular).not.toHaveBeenCalled()
  })
})

describe('sugerencia desactualizada', () => {
  it.each([
    ['Nivel', '61'],
    ['ATQ potencial', '19'],
    ['Etapa de estrella', '3']
  ])('cambiar %s despues de calcular la marca como desactualizada', async (etiqueta, valor) => {
    instalarApi({ teams: conFicha() })
    await abrirEditor()
    await calculado()
    expect(screen.queryByText(/desactualizada/)).toBeNull()

    fireEvent.change(campo(etiqueta), { target: { value: valor } })

    expect(screen.getByText(/desactualizada/)).toBeInTheDocument()
  })

  it('cambiar una letra de la personalidad o el nivel del objeto tambien', async () => {
    instalarApi({ teams: conFicha() })
    await abrirEditor()
    await calculado()

    fireEvent.change(screen.getByLabelText('Personalidad letra 1'), { target: { value: 'I' } })

    expect(screen.getByText(/desactualizada/)).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Personalidad letra 1'), { target: { value: 'E' } })
    expect(screen.queryByText(/desactualizada/)).toBeNull()

    fireEvent.change(campo('Objeto equipado nivel'), { target: { value: '2' } })
    expect(screen.getByText(/desactualizada/)).toBeInTheDocument()
  })

  it('cambiar la especie o el objeto elegido tambien, y volver a calcular la limpia', async () => {
    instalarApi({ teams: conFicha() })
    await abrirEditor()
    await calculado()

    fireEvent.change(campo('Especie del catálogo'), { target: { value: 'ejemplo-b' } })
    expect(screen.getByText(/desactualizada/)).toBeInTheDocument()

    calcular()
    await waitFor(() => expect(screen.queryByText(/desactualizada/)).toBeNull())
  })

  it('cambiar un valor cargado o el interruptor no la desactualiza', async () => {
    instalarApi({ teams: conFicha() })
    await abrirEditor()
    await calculado()

    fireEvent.change(campo('ATQ valor'), { target: { value: '1' } })
    fireEvent.click(screen.getByLabelText('Incluir objetos'))

    expect(screen.queryByText(/desactualizada/)).toBeNull()
  })
})

describe('errores', () => {
  it('no-disponible al pedir el catalogo muestra el mensaje y Guardar sigue funcionando', async () => {
    const api = instalarApi({
      teams: conFicha(),
      calculo: {
        obtenerCatalogo: async (): Promise<ResultadoCatalogo> => ({
          ok: false,
          error: 'no-disponible'
        })
      }
    })
    await abrirEditor()
    fireEvent.click(screen.getByRole('button', { name: 'Sugerencia de stats' }))

    expect(
      await screen.findByText(
        'El cálculo no está disponible: el catálogo de crecimiento es inválido'
      )
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Calcular' })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    await waitFor(() => expect(api.teams.guardarFicha).toHaveBeenCalledTimes(1))
  })

  it('sin conexion al pedir el catalogo muestra el mensaje', async () => {
    instalarApi({
      teams: conFicha(),
      calculo: { obtenerCatalogo: async () => ({ ok: false, error: 'sin-conexion' }) }
    })
    await abrirEditor()
    fireEvent.click(screen.getByRole('button', { name: 'Sugerencia de stats' }))

    expect(await screen.findByText('No se pudo conectar con el servidor')).toBeInTheDocument()
  })

  it('sesion vencida al pedir el catalogo avisa a la pagina', async () => {
    instalarApi({
      teams: conFicha(),
      calculo: { obtenerCatalogo: async () => ({ ok: false, error: 'sesion-vencida' }) }
    })
    const { alSesionVencida } = await abrirEditor()
    fireEvent.click(screen.getByRole('button', { name: 'Sugerencia de stats' }))

    await waitFor(() => expect(alSesionVencida).toHaveBeenCalledTimes(1))
  })

  it('un error al calcular se muestra y conserva lo anterior', async () => {
    let llamada = 0
    instalarApi({
      teams: conFicha(),
      calculo: {
        calcular: async (): Promise<ResultadoCalcular> => {
          llamada += 1
          return llamada === 1
            ? { ok: true, sugerencia: sugerenciaDeReferencia() }
            : { ok: false, error: 'sin-conexion' }
        }
      }
    })
    await abrirEditor()
    await calculado()

    calcular()

    expect(await screen.findByText('No se pudo conectar con el servidor')).toBeInTheDocument()
    expect(within(fila('ATQ')).getByText('522 aprox.')).toBeInTheDocument()
  })

  it('especie desconocida al calcular lo explica', async () => {
    instalarApi({
      teams: conFicha(),
      calculo: { calcular: async () => ({ ok: false, error: 'especie-desconocida' }) }
    })
    await abrirEditor()
    await abrirPanel()
    calcular()

    expect(
      await screen.findByText('La especie elegida no está en el catálogo')
    ).toBeInTheDocument()
  })

  it('Calcular se deshabilita mientras espera', async () => {
    let resolver: (valor: ResultadoCalcular) => void = () => undefined
    instalarApi({
      teams: conFicha(),
      calculo: { calcular: () => new Promise((resolve) => (resolver = resolve)) }
    })
    await abrirEditor()
    await abrirPanel()
    calcular()

    await waitFor(() => expect(screen.getByRole('button', { name: 'Calcular' })).toBeDisabled())
    resolver({ ok: true, sugerencia: sugerenciaDeReferencia() })
    await screen.findByRole('table')
    expect(screen.getByRole('button', { name: 'Calcular' })).toBeEnabled()
  })
})

describe('sin estilos inline', () => {
  it('ningun elemento del panel con una sugerencia tiene style', async () => {
    instalarApi({ teams: conFicha() })
    await abrirEditor()
    await calculado()

    const panel = screen.getByRole('button', { name: 'Sugerencia de stats' }).closest('section')
    expect(panel).not.toBeNull()
    expect(panel?.querySelectorAll('[style]')).toHaveLength(0)
  })
})

describe('estimacion sin verificar', () => {
  const TEXTO =
    'Estimación sin verificar: los valores finales y el CP no están confirmados en el juego.'

  it('se muestra mientras el catalogo diga estimacionVerificada false', async () => {
    instalarApi({ teams: conFicha() })
    await abrirEditor()
    await abrirPanel()

    expect(screen.getByText(TEXTO)).toBeInTheDocument()
  })

  it('se muestra tambien con un catalogo real (esEjemplo false)', async () => {
    const real: CatalogoResumen = { ...catalogoDeReferencia(), esEjemplo: false }
    instalarApi({
      teams: conFicha(),
      calculo: { obtenerCatalogo: async () => ({ ok: true, catalogo: real }) }
    })
    await abrirEditor()
    await abrirPanel()

    expect(screen.getByText(TEXTO)).toBeInTheDocument()
    expect(screen.queryByText(TEXTO_DE_EJEMPLO)).toBeNull()
  })

  it('no aparece cuando el catalogo esta verificado', async () => {
    const verificado: CatalogoResumen = { ...catalogoDeReferencia(), estimacionVerificada: true }
    instalarApi({
      teams: conFicha(),
      calculo: { obtenerCatalogo: async () => ({ ok: true, catalogo: verificado }) }
    })
    await abrirEditor()
    await abrirPanel()

    expect(screen.queryByText(TEXTO)).toBeNull()
  })
})
