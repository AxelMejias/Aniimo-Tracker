// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { fichaDeReferencia, fichaGuardadaDeReferencia } from '../../../../../tests/fixtures/ficha'
import { instalarApi } from '../../../../../tests/fixtures/apiFalsa'
import type { Ficha } from '../../../../shared/teams'
import FichaAniimo from './FichaAniimo'
import type { Recodificador } from './recodificarImagen'

afterEach(cleanup)

const TEAM_ID = '00000000-0000-4000-8000-000000000001'

const recodificadorFalso = (): Recodificador =>
  vi.fn(async () => ({ tipo: 'image/webp' as const, datos: new Uint8Array([1, 2, 3]) }))

interface Opciones {
  readonly recodificar?: Recodificador
  readonly alVolver?: () => void
  readonly alSesionVencida?: () => void
}

async function abrir(opciones: Opciones = {}): Promise<{
  alVolver: ReturnType<typeof vi.fn>
  alSesionVencida: ReturnType<typeof vi.fn>
  recodificar: Recodificador
}> {
  const alVolver = vi.fn(opciones.alVolver)
  const alSesionVencida = vi.fn(opciones.alSesionVencida)
  const recodificar = opciones.recodificar ?? recodificadorFalso()
  render(
    <FichaAniimo
      teamId={TEAM_ID}
      slot={1}
      alVolver={alVolver}
      alSesionVencida={alSesionVencida}
      recodificar={recodificar}
    />
  )
  await screen.findByLabelText('Nombre')
  return { alVolver, alSesionVencida, recodificar }
}

function escribir(etiqueta: string, valor: string): void {
  fireEvent.change(screen.getByLabelText(etiqueta), { target: { value: valor } })
}

function campo(etiqueta: string): HTMLInputElement {
  return screen.getByLabelText(etiqueta) as HTMLInputElement
}

function guardar(): void {
  fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))
}

function archivo(tipo: string, nombre = 'captura'): File {
  return new File([new Uint8Array([1, 2, 3, 4])], nombre, { type: tipo })
}

function pegar(...archivos: File[]): void {
  fireEvent.paste(screen.getByLabelText('Nombre'), { clipboardData: { files: archivos } })
}

const conFicha = (ficha: Ficha = fichaGuardadaDeReferencia()) => ({
  obtenerFicha: async () => ({ ok: true as const, ficha })
})

describe('carga de la ficha', () => {
  it('un slot vacio muestra la ficha en blanco con los seis stats en 0 y sin Borrar', async () => {
    instalarApi()
    await abrir()
    expect(campo('Nombre').value).toBe('')
    for (const stat of ['PS', 'ATQ', 'DEF física', 'DEF mágica', 'Regen', 'Quiebre']) {
      expect(campo(`${stat} valor`).value).toBe('0')
      expect(campo(`${stat} potencial`).value).toBe('0')
    }
    expect(screen.queryByRole('button', { name: 'Borrar' })).toBeNull()
  })

  it('un slot ocupado muestra los datos guardados y el boton Borrar', async () => {
    instalarApi({ teams: conFicha() })
    await abrir()
    expect(campo('Nombre').value).toBe('Irisalis')
    expect(campo('CP').value).toBe('3475')
    expect(campo('ATQ potencial').value).toBe('20')
    expect(campo('Material 1 nombre').value).toBe('Polvo estelar')
    expect(campo('Objeto equipado nombre').value).toBe('Corona antigua')
    expect(screen.getByRole('button', { name: 'Borrar' })).toBeInTheDocument()
  })

  it('un error al cargar se muestra y no ofrece guardar', async () => {
    instalarApi({ teams: { obtenerFicha: async () => ({ ok: false, error: 'sin-conexion' }) } })
    render(
      <FichaAniimo teamId={TEAM_ID} slot={1} alVolver={vi.fn()} alSesionVencida={vi.fn()} />
    )
    expect(await screen.findByText('No se pudo conectar con el servidor')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Guardar' })).toBeNull()
  })

  it('sesion-vencida al cargar avisa a la pagina', async () => {
    instalarApi({ teams: { obtenerFicha: async () => ({ ok: false, error: 'sesion-vencida' }) } })
    const alSesionVencida = vi.fn()
    render(
      <FichaAniimo
        teamId={TEAM_ID}
        slot={1}
        alVolver={vi.fn()}
        alSesionVencida={alSesionVencida}
      />
    )
    await waitFor(() => expect(alSesionVencida).toHaveBeenCalledTimes(1))
  })
})

describe('guardar', () => {
  it('editar sin tocar nada envia exactamente la ficha de referencia', async () => {
    const api = instalarApi({ teams: conFicha() })
    const { alVolver } = await abrir()
    guardar()
    await waitFor(() => expect(alVolver).toHaveBeenCalledTimes(1))
    expect(api.teams.guardarFicha).toHaveBeenCalledWith({
      teamId: TEAM_ID,
      slot: 1,
      ficha: fichaDeReferencia()
    })
    expect(api.teams.guardarImagen).not.toHaveBeenCalled()
  })

  it('los desplegables de elemento ofrecen solo el catalogo y envian el codigo', async () => {
    const api = instalarApi()
    await abrir()
    const desplegable = screen.getByLabelText('Elemento') as HTMLSelectElement
    const etiquetas = within(desplegable)
      .getAllByRole('option')
      .filter((opcion) => (opcion as HTMLOptionElement).value !== '')
      .map((opcion) => opcion.textContent)
    expect(etiquetas).toEqual([
      'Fuego',
      'Agua',
      'Planta',
      'Eléctrico',
      'Hielo',
      'Roca',
      'Viento',
      'Sagrado',
      'Oscuro'
    ])
    fireEvent.change(desplegable, { target: { value: 'electrico' } })
    escribir('Nombre', 'Voltix')
    escribir('Nivel', '5')
    guardar()
    await waitFor(() => expect(api.teams.guardarFicha).toHaveBeenCalledTimes(1))
    expect(api.teams.guardarFicha.mock.calls[0]?.[0].ficha.elemento).toBe('electrico')
  })

  it('los demas desplegables ofrecen sus catalogos con etiquetas en español', async () => {
    instalarApi()
    await abrir()
    const opciones = (etiqueta: string): (string | null)[] =>
      within(screen.getByLabelText(etiqueta))
        .getAllByRole('option')
        .filter((o) => (o as HTMLOptionElement).value !== '')
        .map((o) => o.textContent)
    expect(opciones('Rol')).toEqual(['DPS', 'Ayuda', 'Curación', 'Regen', 'Break'])
    expect(opciones('Potencial innato')).toEqual(['Común', 'Bueno', 'Élite', 'Perfecto'])
    expect(opciones('Objeto equipado rareza')).toEqual(['Rara', 'Épica', 'Legendaria'])
  })

  it('la personalidad se elige con un selector por letra', async () => {
    const api = instalarApi()
    await abrir()
    fireEvent.change(screen.getByLabelText('Personalidad letra 1'), { target: { value: 'I' } })
    fireEvent.change(screen.getByLabelText('Personalidad letra 2'), { target: { value: 'S' } })
    fireEvent.change(screen.getByLabelText('Personalidad letra 3'), { target: { value: 'T' } })
    fireEvent.change(screen.getByLabelText('Personalidad letra 4'), { target: { value: 'P' } })
    escribir('Nombre', 'Voltix')
    escribir('Nivel', '5')
    guardar()
    await waitFor(() => expect(api.teams.guardarFicha).toHaveBeenCalledTimes(1))
    expect(api.teams.guardarFicha.mock.calls[0]?.[0].ficha.personalidad).toBe('ISTP')
  })

  it('una personalidad incompleta se rechaza localmente', async () => {
    const api = instalarApi()
    await abrir()
    fireEvent.change(screen.getByLabelText('Personalidad letra 1'), { target: { value: 'I' } })
    escribir('Nombre', 'Voltix')
    escribir('Nivel', '5')
    guardar()
    expect(
      await screen.findByText('Completá las cuatro letras o dejá todas vacías')
    ).toBeInTheDocument()
    expect(api.teams.guardarFicha).not.toHaveBeenCalled()
  })

  it('un potencial de 21 muestra el tope junto al campo y no llama a la API', async () => {
    const api = instalarApi({ teams: conFicha() })
    await abrir()
    escribir('ATQ potencial', '21')
    guardar()
    expect(await screen.findByText('El potencial debe estar entre 0 y 20')).toBeInTheDocument()
    expect(campo('ATQ potencial')).toHaveAccessibleDescription(
      'El potencial debe estar entre 0 y 20'
    )
    expect(api.teams.guardarFicha).not.toHaveBeenCalled()
  })

  it.each([
    ['Nombre', '   ', 'El nombre debe tener entre 1 y 50 caracteres'],
    ['Nivel', '1000', 'Debe ser un número entero entre 1 y 999'],
    ['Nivel', 'abc', 'Debe ser un número entero entre 1 y 999'],
    ['CP', '10000000', 'Debe ser un número entero entre 0 y 9999999'],
    ['CP', '', 'Debe ser un número entero entre 0 y 9999999'],
    ['Estrella actual', '100', 'Debe ser un número entero entre 0 y 99'],
    ['Despertares usados', '44', 'No pueden superar los despertares totales'],
    ['Objeto equipado nivel', '100', 'Debe ser un número entero entre 1 y 99'],
    ['Material 1 tengo', '-1', 'Debe ser un número entero entre 0 y 9999999']
  ])('valida localmente %s = "%s"', async (etiqueta, valor, mensaje) => {
    const api = instalarApi({ teams: conFicha() })
    await abrir()
    escribir(etiqueta, valor)
    guardar()
    expect(await screen.findByText(mensaje)).toBeInTheDocument()
    expect(api.teams.guardarFicha).not.toHaveBeenCalled()
  })

  it('un error de campo del backend se muestra junto al campo sin perder los datos', async () => {
    instalarApi({
      teams: {
        ...conFicha(),
        guardarFicha: async () => ({
          ok: false,
          error: 'datos-invalidos',
          campos: ['entrenamiento.despertares_usados']
        })
      }
    })
    await abrir()
    escribir('Nombre', 'Editada')
    guardar()
    await waitFor(() =>
      expect(campo('Despertares usados')).toHaveAccessibleDescription('Valor no válido')
    )
    expect(campo('Nombre').value).toBe('Editada')
  })

  it('un campo de material del backend se traduce a la fila que corresponde', async () => {
    instalarApi({
      teams: {
        ...conFicha(),
        guardarFicha: async () => ({
          ok: false,
          error: 'datos-invalidos',
          campos: ['entrenamiento.materiales.1.tengo']
        })
      }
    })
    await abrir()
    guardar()
    await waitFor(() =>
      expect(campo('Material 2 tengo')).toHaveAccessibleDescription('Valor no válido')
    )
  })

  it('otros errores del backend se muestran como mensaje general', async () => {
    instalarApi({
      teams: { ...conFicha(), guardarFicha: async () => ({ ok: false, error: 'sin-conexion' }) }
    })
    const { alVolver } = await abrir()
    guardar()
    expect(await screen.findByText('No se pudo conectar con el servidor')).toBeInTheDocument()
    expect(alVolver).not.toHaveBeenCalled()
  })

  it('sesion-vencida al guardar avisa a la pagina', async () => {
    instalarApi({
      teams: { ...conFicha(), guardarFicha: async () => ({ ok: false, error: 'sesion-vencida' }) }
    })
    const { alSesionVencida } = await abrir()
    guardar()
    await waitFor(() => expect(alSesionVencida).toHaveBeenCalledTimes(1))
  })

  it('Guardar se deshabilita mientras espera la respuesta', async () => {
    let resolver: (valor: { ok: true; ficha: Ficha }) => void = () => undefined
    const api = instalarApi({
      teams: {
        ...conFicha(),
        guardarFicha: () => new Promise((resolve) => (resolver = resolve))
      }
    })
    const { alVolver } = await abrir()
    guardar()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Guardar' })).toBeDisabled())
    resolver({ ok: true, ficha: fichaGuardadaDeReferencia() })
    await waitFor(() => expect(alVolver).toHaveBeenCalledTimes(1))
    expect(api.teams.guardarFicha).toHaveBeenCalledTimes(1)
  })

  it('cancelar vuelve sin guardar', async () => {
    const api = instalarApi({ teams: conFicha() })
    const { alVolver } = await abrir()
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(alVolver).toHaveBeenCalledTimes(1)
    expect(api.teams.guardarFicha).not.toHaveBeenCalled()
  })
})

describe('valores derivados', () => {
  it('muestra despertares restantes y el estado de cada material sin enviarlos', async () => {
    const api = instalarApi({ teams: conFicha() })
    await abrir()
    expect(screen.getByText('Despertares restantes: 15')).toBeInTheDocument()
    expect(screen.getByText('Completo')).toBeInTheDocument()
    expect(screen.getByText('Faltan 1')).toBeInTheDocument()
    expect(screen.getByText('Faltan 7')).toBeInTheDocument()
    guardar()
    await waitFor(() => expect(api.teams.guardarFicha).toHaveBeenCalledTimes(1))
    const enviado = JSON.stringify(api.teams.guardarFicha.mock.calls[0]?.[0])
    expect(enviado).not.toMatch(/restantes|faltan|completo/i)
  })

  it('los derivados se recalculan al editar', async () => {
    instalarApi({ teams: conFicha() })
    await abrir()
    escribir('Despertares usados', '40')
    expect(screen.getByText('Despertares restantes: 3')).toBeInTheDocument()
    escribir('Material 2 tengo', '2')
    expect(screen.getAllByText('Completo')).toHaveLength(2)
  })
})

describe('contrato del objeto', () => {
  it('esta deshabilitado en un objeto epico de nivel 15 y se envia en false', async () => {
    const base = fichaGuardadaDeReferencia()
    const ficha: Ficha = {
      ...base,
      objetos: [{ ...base.objetos[0]!, rareza: 'epica', contrato: true }, base.objetos[1]!]
    }
    const api = instalarApi({ teams: conFicha(ficha) })
    await abrir()
    expect(campo('Objeto equipado contrato')).toBeDisabled()
    expect(campo('Objeto equipado contrato').checked).toBe(false)
    guardar()
    await waitFor(() => expect(api.teams.guardarFicha).toHaveBeenCalledTimes(1))
    expect(api.teams.guardarFicha.mock.calls[0]?.[0].ficha.objetos[0].contrato).toBe(false)
  })

  it('esta habilitado en un objeto legendario de nivel 15 y conserva su valor', async () => {
    const api = instalarApi({ teams: conFicha() })
    await abrir()
    expect(campo('Objeto equipado contrato')).toBeEnabled()
    expect(campo('Objeto equipado contrato').checked).toBe(true)
    fireEvent.click(campo('Objeto equipado contrato'))
    guardar()
    await waitFor(() => expect(api.teams.guardarFicha).toHaveBeenCalledTimes(1))
    expect(api.teams.guardarFicha.mock.calls[0]?.[0].ficha.objetos[0].contrato).toBe(false)
  })

  it('al bajar el nivel de un legendario el contrato se deshabilita y se envia en false', async () => {
    const api = instalarApi({ teams: conFicha() })
    await abrir()
    escribir('Objeto equipado nivel', '14')
    expect(campo('Objeto equipado contrato')).toBeDisabled()
    guardar()
    await waitFor(() => expect(api.teams.guardarFicha).toHaveBeenCalledTimes(1))
    expect(api.teams.guardarFicha.mock.calls[0]?.[0].ficha.objetos[0].contrato).toBe(false)
  })
})

describe('borrar el Aniimo', () => {
  it('pide confirmacion y vacia el slot', async () => {
    const api = instalarApi({ teams: conFicha() })
    const { alVolver } = await abrir()
    fireEvent.click(screen.getByRole('button', { name: 'Borrar' }))
    expect(api.teams.vaciarSlot).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar borrado' }))
    await waitFor(() => expect(alVolver).toHaveBeenCalledTimes(1))
    expect(api.teams.vaciarSlot).toHaveBeenCalledWith({ teamId: TEAM_ID, slot: 1 })
  })

  it('cancelar la confirmacion no llama a la API', async () => {
    const api = instalarApi({ teams: conFicha() })
    const { alVolver } = await abrir()
    fireEvent.click(screen.getByRole('button', { name: 'Borrar' }))
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Cancelar' }))
    expect(api.teams.vaciarSlot).not.toHaveBeenCalled()
    expect(alVolver).not.toHaveBeenCalled()
  })
})

describe('sin estilos inline', () => {
  it('la ficha completa no usa atributos style', async () => {
    instalarApi({ teams: conFicha() })
    const { container } = render(
      <FichaAniimo teamId={TEAM_ID} slot={1} alVolver={vi.fn()} alSesionVencida={vi.fn()} />
    )
    await screen.findByLabelText('Nombre')
    expect(container.querySelectorAll('[style]')).toHaveLength(0)
  })
})

describe('imagen en el cliente', () => {
  it('pegar una imagen llama al recodificador y muestra la vista previa recodificada', async () => {
    instalarApi()
    const { recodificar } = await abrir()
    const png = archivo('image/png')
    pegar(png)
    const vista = await screen.findByAltText('Vista previa del Aniimo')
    expect(recodificar).toHaveBeenCalledWith(png)
    expect(vista.getAttribute('src')).toBe('data:image/webp;base64,AQID')
  })

  it.each([
    ['GIF pegado', 'image/gif', 'pegar'],
    ['SVG pegado', 'image/svg+xml', 'pegar'],
    ['GIF elegido', 'image/gif', 'elegir'],
    ['SVG elegido', 'image/svg+xml', 'elegir']
  ])('%s muestra el mensaje y no llama al recodificador ni a la API', async (_caso, tipo, via) => {
    const api = instalarApi()
    const { recodificar } = await abrir()
    if (via === 'pegar') {
      pegar(archivo(tipo))
    } else {
      fireEvent.change(screen.getByLabelText('Elegir imagen'), {
        target: { files: [archivo(tipo)] }
      })
    }
    expect(
      await screen.findByText('Imagen no permitida: solo PNG, JPEG o WebP')
    ).toBeInTheDocument()
    expect(recodificar).not.toHaveBeenCalled()
    for (const funcion of Object.values(api.teams)) {
      if (funcion !== api.teams.obtenerFicha) {
        expect(funcion).not.toHaveBeenCalled()
      }
    }
  })

  it('el selector de archivos acepta solo PNG, JPEG y WebP', async () => {
    instalarApi()
    await abrir()
    expect(screen.getByLabelText('Elegir imagen').getAttribute('accept')).toBe(
      'image/png,image/jpeg,image/webp'
    )
  })

  it('elegir un archivo valido tambien recodifica', async () => {
    instalarApi()
    const { recodificar } = await abrir()
    const jpeg = archivo('image/jpeg')
    fireEvent.change(screen.getByLabelText('Elegir imagen'), { target: { files: [jpeg] } })
    await screen.findByAltText('Vista previa del Aniimo')
    expect(recodificar).toHaveBeenCalledWith(jpeg)
  })

  it('pegar texto sin archivos no hace nada', async () => {
    instalarApi()
    const { recodificar } = await abrir()
    fireEvent.paste(screen.getByLabelText('Nombre'), { clipboardData: { files: [] } })
    expect(recodificar).not.toHaveBeenCalled()
    expect(screen.queryByAltText('Vista previa del Aniimo')).toBeNull()
  })

  it('si el recodificador falla muestra el mensaje de imagen', async () => {
    instalarApi()
    await abrir({
      recodificar: async () => {
        throw new Error('no se pudo decodificar')
      }
    })
    pegar(archivo('image/png'))
    expect(await screen.findByText('No se pudo procesar la imagen')).toBeInTheDocument()
  })

  it('muestra la imagen guardada del Aniimo', async () => {
    const ficha: Ficha = { ...fichaGuardadaDeReferencia(), tieneImagen: true }
    const api = instalarApi({
      teams: {
        ...conFicha(ficha),
        obtenerImagen: async () => ({ ok: true, imagen: 'data:image/webp;base64,AAAA' })
      }
    })
    await abrir()
    const vista = await screen.findByAltText('Vista previa del Aniimo')
    expect(vista.getAttribute('src')).toBe('data:image/webp;base64,AAAA')
    expect(api.teams.obtenerImagen).toHaveBeenCalledWith({ teamId: TEAM_ID, slot: 1 })
  })

  it('quitar la imagen guardada la borra al guardar', async () => {
    const ficha: Ficha = { ...fichaGuardadaDeReferencia(), tieneImagen: true }
    const api = instalarApi({
      teams: {
        ...conFicha(ficha),
        obtenerImagen: async () => ({ ok: true, imagen: 'data:image/webp;base64,AAAA' })
      }
    })
    const { alVolver } = await abrir()
    await screen.findByAltText('Vista previa del Aniimo')
    fireEvent.click(screen.getByRole('button', { name: 'Quitar imagen' }))
    expect(screen.queryByAltText('Vista previa del Aniimo')).toBeNull()
    guardar()
    await waitFor(() => expect(alVolver).toHaveBeenCalledTimes(1))
    expect(api.teams.borrarImagen).toHaveBeenCalledWith({ teamId: TEAM_ID, slot: 1 })
  })
})

describe('alta con imagen', () => {
  it('guarda primero la ficha y despues la imagen, y vuelve a Mis teams', async () => {
    const api = instalarApi()
    const orden: string[] = []
    api.teams.guardarFicha.mockImplementation(async () => {
      orden.push('ficha')
      return { ok: true, ficha: fichaGuardadaDeReferencia() }
    })
    api.teams.guardarImagen.mockImplementation(async () => {
      orden.push('imagen')
      return { ok: true }
    })
    const { alVolver } = await abrir()
    escribir('Nombre', 'Voltix')
    escribir('Nivel', '5')
    pegar(archivo('image/png'))
    await screen.findByAltText('Vista previa del Aniimo')
    guardar()
    await waitFor(() => expect(alVolver).toHaveBeenCalledTimes(1))
    expect(orden).toEqual(['ficha', 'imagen'])
    expect(api.teams.guardarImagen).toHaveBeenCalledWith({
      teamId: TEAM_ID,
      slot: 1,
      tipo: 'image/webp',
      datos: new Uint8Array([1, 2, 3])
    })
  })

  it('si falla la imagen la ficha queda guardada y se muestra el mensaje', async () => {
    const api = instalarApi({
      teams: { guardarImagen: async () => ({ ok: false, error: 'imagen-invalida' }) }
    })
    const { alVolver } = await abrir()
    escribir('Nombre', 'Voltix')
    escribir('Nivel', '5')
    pegar(archivo('image/png'))
    await screen.findByAltText('Vista previa del Aniimo')
    guardar()
    expect(
      await screen.findByText('La imagen no es válida: solo PNG, JPEG o WebP de hasta 1 MiB')
    ).toBeInTheDocument()
    expect(api.teams.guardarFicha).toHaveBeenCalledTimes(1)
    expect(alVolver).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Borrar' })).toBeInTheDocument()
  })
})
