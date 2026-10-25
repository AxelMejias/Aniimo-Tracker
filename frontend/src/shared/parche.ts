export const PATRON_DE_FECHA_DE_PARCHE = /^\d{4}-\d{2}-\d{2}$/
export const ANIO_MINIMO_DE_PARCHE = 2020
export const ANIO_MAXIMO_DE_PARCHE = 2099
export const ETAPA_MAXIMA_DE_ESTRELLA = 7

export function esFechaDeParche(valor: unknown): valor is string {
  if (typeof valor !== 'string' || !PATRON_DE_FECHA_DE_PARCHE.test(valor)) {
    return false
  }
  const [anio, mes, dia] = valor.split('-').map(Number)
  if (anio < ANIO_MINIMO_DE_PARCHE || anio > ANIO_MAXIMO_DE_PARCHE) {
    return false
  }
  const fecha = new Date(Date.UTC(anio, mes - 1, dia))
  return (
    fecha.getUTCFullYear() === anio && fecha.getUTCMonth() === mes - 1 && fecha.getUTCDate() === dia
  )
}

export function esEtapaDeEstrella(valor: unknown): valor is number {
  return (
    typeof valor === 'number' &&
    Number.isSafeInteger(valor) &&
    valor >= 0 &&
    valor <= ETAPA_MAXIMA_DE_ESTRELLA
  )
}
