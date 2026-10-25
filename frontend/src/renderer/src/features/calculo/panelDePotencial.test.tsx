// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { instalarApi } from '../../../../../tests/fixtures/apiFalsa'
import { catalogoDeReferencia, potencialDeReferencia } from '../../../../../tests/fixtures/calculo'
import { fichaDeReferencia } from '../../../../../tests/fixtures/ficha'
import type {
  CatalogoResumen,
  Potencial,
  ResultadoCatalogo,
  ResultadoPotencial
} from '../../../../shared/calculo'
import type { Ficha } from '../../../../shared/teams'
import FichaAniimo from '../aniimo/FichaAniimo'
import FichaDeSoloLectura from '../aniimo/FichaDeSoloLectura'

afterEach(cleanup)

const TEAM_ID = '00000000-0000-4000-8000-000000000001'

function fichaIrisalis(cambios: Partial<Ficha> = {}): Ficha {
  const base = fichaDeReferencia()
  const objetos = base.objetos.map((objeto) =>
    objeto.posicion === 'equipado' ? { ...objeto, nombre: 'Ejemplo objeto X', nivel: 2 } : objeto
  )
  return { ...base, objetos, slot: 1, tieneImagen: false, ...cambios }
}

function conFicha(ficha: Ficha = fichaIrisalis()) {
  return { obtenerFicha: async () => ({ ok: true as const, ficha }) }
}

async function abrirEditor(): Promise<void> {
  render(
    <FichaAniimo
      teamId={TEAM_ID}
      slot={1}
      alVolver={vi.fn()}
      alSesionVencida={vi.fn()}
      recodificar={vi.fn()}
    />
  )
  await screen.findByLabelText('Nombre')
}

async function abrirPanel(): Promise<void> {
  fireEvent.click(screen.getByRole('button', { name: 'Potencial y Despertar' }))
  await screen.findByRole('button', { name: 'Calcular potencial' })
}

async function calculado(): Promise<void> {
  await abrirPanel()
  fireEvent.click(screen.getByRole('button', { name: 'Calcular potencial' }))
  await screen.findByRole('table', { name: 'Potencial efectivo por stat' })
}

function campo(etiqueta: string): HTMLInputElement {
  return screen.getByLabelText(etiqueta) as HTMLInputElement
}

function fila(etiqueta: string): HTMLElement {
  const encontrada = within(screen.getByRole('table', { name: 'Potencial efectivo por stat' }))
    .getAllByRole('row')
    .find((candidata) => within(candidata).queryByRole('rowheader', { name: etiqueta }) !== null)
  if (encontrada === undefined) {
    throw new Error(`no hay fila para ${etiqueta}`)
  }
  return encontrada
}

function celdas(etiqueta: string): string[] {
  return within(fila(etiqueta))
    .getAllByRole('cell')
    .map((celda) => celda.textContent ?? '')
}

function conPotencial(cambios: (base: Potencial) => Potencial): {
  potencial: () => Promise<ResultadoPotencial>
} {
  return { potencial: async () => ({ ok: true, potencial: cambios(potencialDeReferencia()) }) }
}

function conCatalogo(catalogo: CatalogoResumen): { obtenerCatalogo: () => Promise<ResultadoCatalogo> } {
  return { obtenerCatalogo: async () => ({ ok: true, catalogo }) }
}

describe('apertura de la seccion', () => {
  it('esta plegada y no pide el catalogo hasta abrirla', async () => {
    const api = instalarApi({ teams: conFicha() })
    await abrirEditor()

    expect(screen.getByRole('button', { name: 'Potencial y Despertar' })).toHaveAttribute(
      'aria-expanded',
      'false'
    )
    expect(screen.queryByRole('button', { name: 'Calcular potencial' })).toBeNull()
    expect(api.calculo.obtenerCatalogo).not.toHaveBeenCalled()
  })

  it('comparte el catalogo con la sugerencia: se pide una sola vez', async () => {
    const api = instalarApi({ teams: conFicha() })
    await abrirEditor()
    await abrirPanel()

    fireEvent.click(screen.getByRole('button', { name: 'Sugerencia de stats' }))
    await screen.findByLabelText('Especie del catálogo')

    expect(api.calculo.obtenerCatalogo).toHaveBeenCalledTimes(1)
  })

  it('preselecciona el objeto equipado por nombre', async () => {
    instalarApi({ teams: conFicha() })
    await abrirEditor()
    await abrirPanel()

    expect((campo('Objeto equipado del catálogo') as unknown as HTMLSelectElement).value).toBe(
      'ejemplo-objeto-x'
    )
  })

  it('un error del catalogo se muestra y la ficha sigue funcionando', async () => {
    instalarApi({
      teams: conFicha(),
      calculo: { obtenerCatalogo: async () => ({ ok: false, error: 'no-disponible' }) }
    })
    await abrirEditor()
    fireEvent.click(screen.getByRole('button', { name: 'Potencial y Despertar' }))

    expect(await screen.findByText(/El cálculo no está disponible/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Guardar' })).toBeEnabled()
  })
})

describe('calcular potencial', () => {
  it('manda el pedido de Irisalis con el objeto elegido y la fecha de la ficha', async () => {
    const api = instalarApi({ teams: conFicha() })
    await abrirEditor()
    await calculado()

    expect(api.calculo.potencial).toHaveBeenCalledTimes(1)
    expect(api.calculo.potencial).toHaveBeenCalledWith({
      nivel: 60,
      etapaEstrella: 6,
      potenciales: { ps: 11, atq: 20, def_fisica: 5, def_magica: 4, regen: 20, quiebre: 6 },
      personalidad: 'ENFJ',
      objetoEquipado: { objetoId: 'ejemplo-objeto-x', nivel: 2 },
      despertaresUsados: 28,
      despertaresTotal: 43,
      fechaParche: '2026-10-26'
    })
  })

  it('muestra ATQ con N 22, 5 saltos, faltan 2 y no por Despertar, y PS con N 13 y si', async () => {
    instalarApi({ teams: conFicha() })
    await abrirEditor()
    await calculado()

    expect(celdas('ATQ')).toEqual(['20', '2', '0', '22', '5', '24', '2', 'no: solo estrellas u objetos'])
    expect(celdas('PS')).toEqual(['11', '2', '0', '13', '3', '16', '3', 'sí'])
  })

  it('muestra los parametros con su confianza y la fecha de parche del catalogo', async () => {
    instalarApi({ teams: conFicha() })
    await abrirEditor()
    await calculado()

    expect(screen.getByText('≈ +0,8% por punto, +4% cada 4 (medido)')).toBeInTheDocument()
    expect(screen.getByText('Parche del catálogo: 2026-09-23')).toBeInTheDocument()
  })

  it('muestra el sin cupo cuando el backend lo indica', async () => {
    instalarApi({
      teams: conFicha(),
      calculo: conPotencial((base) => ({
        ...base,
        potencial: {
          ...base.potencial!,
          stats: {
            ...base.potencial!.stats,
            ps: { ...base.potencial!.stats.ps, viaDespertar: 'sin-cupo' }
          }
        }
      }))
    })
    await abrirEditor()
    await calculado()

    expect(celdas('PS').at(-1)).toBe('sin cupo')
  })
})

describe('entrada invalida', () => {
  it('con la etapa sin cargar el boton queda deshabilitado con el motivo', async () => {
    const api = instalarApi({ teams: conFicha(fichaIrisalis({ etapaEstrella: null })) })
    await abrirEditor()
    await abrirPanel()

    expect(screen.getByRole('button', { name: 'Calcular potencial' })).toBeDisabled()
    expect(screen.getByText('Cargá la etapa de estrella (T0-T7)')).toBeInTheDocument()
    expect(api.calculo.potencial).not.toHaveBeenCalled()
  })

  it('con 44 despertares usados de 43 queda deshabilitado con el motivo', async () => {
    const api = instalarApi({ teams: conFicha() })
    await abrirEditor()
    await abrirPanel()

    fireEvent.change(campo('Despertares usados'), { target: { value: '44' } })

    expect(screen.getByRole('button', { name: 'Calcular potencial' })).toBeDisabled()
    expect(
      screen.getByText('Los despertares usados no pueden superar los totales')
    ).toBeInTheDocument()
    expect(api.calculo.potencial).not.toHaveBeenCalled()
  })
})

describe('cupo de Despertar', () => {
  const cupoDe = (total: number, cupo: number) =>
    conPotencial((base) => ({
      ...base,
      despertar: {
        ...base.despertar!,
        cupoSugerido: cupo,
        totalCargado: total,
        diferencia: cupo - total
      }
    }))

  it('muestra el sugerido, el cargado, la diferencia y el desglose', async () => {
    instalarApi({ teams: conFicha(), calculo: cupoDe(25, 30) })
    await abrirEditor()
    await calculado()

    const cupo = screen.getByRole('region', { name: 'Cupo de Despertar' })
    expect(within(cupo).getByText('Cupo sugerido: 30')).toBeInTheDocument()
    expect(within(cupo).getByText('Total cargado: 25')).toBeInTheDocument()
    expect(within(cupo).getByText('Diferencia: +5')).toBeInTheDocument()
    expect(within(cupo).getByText('nivel 45: +5')).toBeInTheDocument()
    expect(within(cupo).getByText('etapa 6: +8')).toBeInTheDocument()
  })

  it('Usar cambia solo los despertares totales del formulario y no guarda', async () => {
    const api = instalarApi({ teams: conFicha(), calculo: cupoDe(25, 30) })
    await abrirEditor()
    await calculado()
    const antes = { usados: campo('Despertares usados').value, nivel: campo('Nivel').value }

    fireEvent.click(screen.getByRole('button', { name: 'Usar cupo sugerido' }))

    expect(campo('Despertares totales').value).toBe('30')
    expect(campo('Despertares usados').value).toBe(antes.usados)
    expect(campo('Nivel').value).toBe(antes.nivel)
    expect(api.teams.guardarFicha).not.toHaveBeenCalled()
  })

  it('despues de usarlo el resultado queda desactualizado', async () => {
    instalarApi({ teams: conFicha(), calculo: cupoDe(25, 30) })
    await abrirEditor()
    await calculado()

    fireEvent.click(screen.getByRole('button', { name: 'Usar cupo sugerido' }))

    expect(screen.getByText(/desactualizado/)).toBeInTheDocument()
  })

  it('sin la seccion despertar el bloque dice sin datos y el resto se muestra', async () => {
    instalarApi({
      teams: conFicha(),
      calculo: conPotencial((base) => ({
        ...base,
        despertar: null,
        sinDatos: ['despertar']
      }))
    })
    await abrirEditor()
    await calculado()

    const cupo = screen.getByRole('region', { name: 'Cupo de Despertar' })
    expect(within(cupo).getByText('sin datos')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Usar cupo sugerido' })).toBeNull()
    expect(celdas('PS')).toHaveLength(8)
  })
})

describe('personalidad', () => {
  it('muestra los cuatro slots con sus bonos y marca la letra inferida', async () => {
    instalarApi({ teams: conFicha() })
    await abrirEditor()
    await calculado()

    const region = screen.getByRole('region', { name: 'Personalidad' })
    expect(within(region).getByText('Energetic (E)')).toBeInTheDocument()
    expect(within(region).getByText('ATQ +2%')).toBeInTheDocument()
    expect(within(region).getByText('Prob. de critico +5%')).toBeInTheDocument()
    expect(within(region).getAllByText('letra inferida')).toHaveLength(2)
  })

  it('el slot Instinctive de INFJ muestra la marca y Nimble no', async () => {
    instalarApi({
      teams: conFicha(),
      calculo: conPotencial((base) => ({
        ...base,
        personalidad: [
          {
            letra: 'I',
            nombre: 'Instinctive',
            letraConfirmada: false,
            confianza: 'medido',
            bonos: [{ stat: 'regen', descripcion: 'regen', porcentaje: 4 }]
          },
          {
            letra: 'N',
            nombre: 'Nimble',
            letraConfirmada: true,
            confianza: 'medido',
            bonos: []
          }
        ]
      }))
    })
    await abrirEditor()
    await calculado()

    const instinctive = screen.getByText('Instinctive (I)').closest('li')!
    const nimble = screen.getByText('Nimble (N)').closest('li')!
    expect(within(instinctive).getByText('letra inferida')).toBeInTheDocument()
    expect(within(nimble).queryByText('letra inferida')).toBeNull()
    expect(within(instinctive).getByText('Regen +4%')).toBeInTheDocument()
  })

  it('un slot sin datos del catalogo se muestra sin nombre', async () => {
    instalarApi({
      teams: conFicha(),
      calculo: conPotencial((base) => ({
        ...base,
        personalidad: [
          { letra: 'P', nombre: null, letraConfirmada: false, confianza: null, bonos: [] }
        ]
      }))
    })
    await abrirEditor()
    await calculado()

    expect(screen.getByText('P: sin datos')).toBeInTheDocument()
  })

  it('sin la seccion personalidad dice sin datos', async () => {
    instalarApi({
      teams: conFicha(),
      calculo: conPotencial((base) => ({ ...base, personalidad: null, sinDatos: ['personalidad'] }))
    })
    await abrirEditor()
    await calculado()

    const region = screen.getByRole('region', { name: 'Personalidad' })
    expect(within(region).getByText('sin datos')).toBeInTheDocument()
  })
})

describe('avisos de version', () => {
  it('sin parche cargado en la ficha dice que el parche es desconocido', async () => {
    instalarApi({ teams: conFicha(fichaIrisalis({ fechaParche: null })) })
    await abrirEditor()
    await calculado()

    expect(screen.getByText('Parche del juego desconocido')).toBeInTheDocument()
    expect(screen.getByText('Datos anteriores a: 2026-09-23 Actualizacion del 23/09')).toBeInTheDocument()
  })

  it('con la ficha al dia no hay avisos', async () => {
    instalarApi({
      teams: conFicha(),
      calculo: conPotencial((base) => ({ ...base, versionDesconocida: false, avisos: [] }))
    })
    await abrirEditor()
    await calculado()

    expect(screen.queryByText('Parche del juego desconocido')).toBeNull()
    expect(screen.queryByText(/Datos anteriores a/)).toBeNull()
  })
})

describe('secciones del catalogo sin datos', () => {
  it('sin la seccion potencial el bloque dice sin datos', async () => {
    instalarApi({
      teams: conFicha(),
      calculo: conPotencial((base) => ({ ...base, potencial: null, sinDatos: ['potencial'] }))
    })
    await abrirEditor()
    await abrirPanel()
    fireEvent.click(screen.getByRole('button', { name: 'Calcular potencial' }))

    const region = await screen.findByRole('region', { name: 'Potencial efectivo' })
    expect(within(region).getByText('sin datos')).toBeInTheDocument()
    expect(screen.queryByRole('table', { name: 'Potencial efectivo por stat' })).toBeNull()
  })
})

describe('objeto equipado', () => {
  it('un objeto que no suma potencial se explica', async () => {
    instalarApi({
      teams: conFicha(),
      calculo: conPotencial((base) => ({
        ...base,
        objeto: { aplicado: false, nota: 'sin-bono-de-potencial' }
      }))
    })
    await abrirEditor()
    await calculado()

    expect(
      screen.getByText('El objeto equipado no suma potencial: no tiene bono de potencial para su nivel.')
    ).toBeInTheDocument()
  })

  it('cambiar el objeto elegido marca el resultado como desactualizado', async () => {
    instalarApi({ teams: conFicha() })
    await abrirEditor()
    await calculado()

    fireEvent.change(campo('Objeto equipado del catálogo'), { target: { value: '' } })

    expect(screen.getByText(/desactualizado/)).toBeInTheDocument()
  })

  it('sin objeto equipado en la ficha no ofrece el selector y manda null', async () => {
    const base = fichaIrisalis()
    const objetos = base.objetos.filter((o) => o.posicion !== 'equipado')
    const api = instalarApi({ teams: conFicha({ ...base, objetos }) })
    await abrirEditor()
    await calculado()

    expect(screen.queryByLabelText('Objeto equipado del catálogo')).toBeNull()
    expect(api.calculo.potencial.mock.calls[0]?.[0].objetoEquipado).toBeNull()
  })
})

describe('desactualizado y errores', () => {
  it('cambiar un potencial o la etapa despues de calcular lo marca desactualizado', async () => {
    instalarApi({ teams: conFicha() })
    await abrirEditor()
    await calculado()
    expect(screen.queryByText(/desactualizado/)).toBeNull()

    fireEvent.change(campo('ATQ potencial'), { target: { value: '19' } })
    expect(screen.getByText(/desactualizado/)).toBeInTheDocument()

    fireEvent.change(campo('ATQ potencial'), { target: { value: '20' } })
    expect(screen.queryByText(/desactualizado/)).toBeNull()

    fireEvent.change(campo('Etapa de estrella'), { target: { value: '5' } })
    expect(screen.getByText(/desactualizado/)).toBeInTheDocument()
  })

  it('un error del calculo se muestra y no bloquea Guardar', async () => {
    instalarApi({
      teams: conFicha(),
      calculo: { potencial: async () => ({ ok: false, error: 'sin-conexion' }) }
    })
    await abrirEditor()
    await abrirPanel()
    fireEvent.click(screen.getByRole('button', { name: 'Calcular potencial' }))

    expect(await screen.findByText('No se pudo conectar con el servidor')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Guardar' })).toBeEnabled()
  })

  it('sesion vencida avisa a la pagina', async () => {
    const alSesionVencida = vi.fn()
    instalarApi({
      teams: conFicha(),
      calculo: { potencial: async () => ({ ok: false, error: 'sesion-vencida' }) }
    })
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
    await abrirPanel()
    fireEvent.click(screen.getByRole('button', { name: 'Calcular potencial' }))

    await waitFor(() => expect(alSesionVencida).toHaveBeenCalledTimes(1))
  })

  it('usa un catalogo real sin cartel de ejemplo en este panel', async () => {
    instalarApi({
      teams: conFicha(),
      calculo: conCatalogo({ ...catalogoDeReferencia(), esEjemplo: false })
    })
    await abrirEditor()
    await abrirPanel()

    expect(screen.getByText('Parche del catálogo: 2026-09-23')).toBeInTheDocument()
  })
})

describe('fuera de la ficha propia y estilos', () => {
  it('la ficha de solo lectura no ofrece la seccion', () => {
    instalarApi()
    render(<FichaDeSoloLectura ficha={fichaIrisalis()} imagen={null} />)

    expect(screen.queryByText('Potencial y Despertar')).toBeNull()
  })

  it('el resultado calculado no usa atributos style', async () => {
    instalarApi({ teams: conFicha() })
    await abrirEditor()
    await calculado()

    expect(document.body.querySelector('[style]')).toBeNull()
  })
})
