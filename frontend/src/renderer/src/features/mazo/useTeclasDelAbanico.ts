import { useEffect, useRef } from 'react'
import { idDelBotonDeGrupo } from './GrupoEnAbanico'
import type { Abanicos } from './useAbanicos'

interface OpcionesDeTeclas {
  readonly activo: boolean
  readonly abanicos: Abanicos
  readonly teamIdsDe: (grupoId: string) => readonly string[]
  readonly alAbrirTeam: (teamId: string) => void
}

const CAMPOS_DE_TEXTO = ['INPUT', 'TEXTAREA', 'SELECT']

function estaEnUnCampo(destino: EventTarget | null): boolean {
  if (!(destino instanceof HTMLElement)) {
    return false
  }
  return (
    CAMPOS_DE_TEXTO.includes(destino.tagName) ||
    destino.closest('[contenteditable=""], [contenteditable="true"]') !== null
  )
}

function grupoConElFoco(): string | null {
  const grupo = document.activeElement?.closest<HTMLElement>('[data-grupo-id]')
  return grupo?.dataset['grupoId'] ?? null
}

function teamConElFoco(): { teamId: string; grupoId: string | null } | null {
  const pila = document.activeElement?.closest<HTMLElement>('[data-team-id]')
  const teamId = pila?.dataset['teamId']
  if (pila === null || pila === undefined || teamId === undefined) {
    return null
  }
  return { teamId, grupoId: pila.closest<HTMLElement>('[data-grupo-id]')?.dataset['grupoId'] ?? null }
}

export function useTeclasDelAbanico(opciones: OpcionesDeTeclas): void {
  const ultimas = useRef(opciones)
  ultimas.current = opciones
  const { activo } = opciones

  useEffect(() => {
    if (!activo) {
      return
    }
    function alPresionar(evento: KeyboardEvent): void {
      const { abanicos, teamIdsDe, alAbrirTeam } = ultimas.current
      const conModificador = evento.ctrlKey || evento.altKey || evento.metaKey
      if (
        conModificador ||
        evento.repeat ||
        estaEnUnCampo(evento.target) ||
        document.querySelector('[role="alertdialog"]') !== null
      ) {
        return
      }
      const tecla = evento.key
      if (tecla === 't' || tecla === 'T') {
        const enFoco = teamConElFoco()
        const cartasDelTeam =
          enFoco !== null &&
          (enFoco.grupoId === null ||
            abanicos.estaAbierto(enFoco.grupoId) ||
            teamIdsDe(enFoco.grupoId).length <= 1)
        if (enFoco !== null && cartasDelTeam) {
          abanicos.alternarTeam(enFoco.teamId)
          return
        }
        const grupoEnFoco = grupoConElFoco()
        if (grupoEnFoco === null && abanicos.teamSobre !== null) {
          abanicos.alternarTeam(abanicos.teamSobre)
          return
        }
        const grupoId = grupoEnFoco ?? abanicos.sobre
        if (grupoId !== null && teamIdsDe(grupoId).length > 1) {
          abanicos.alternar(grupoId)
        }
      } else if (tecla === 'Escape') {
        const teamId = abanicos.teamAbierto
        if (teamId !== null) {
          abanicos.plegarTeam()
          document.querySelector<HTMLElement>(`[data-team-id="${teamId}"]`)?.focus()
          return
        }
        const grupoId = abanicos.abierto
        if (grupoId !== null) {
          abanicos.plegar()
          document.getElementById(idDelBotonDeGrupo(grupoId))?.focus()
        }
      } else if (/^[1-5]$/.test(tecla)) {
        const grupoId = abanicos.abierto
        const teamIds = grupoId === null ? [] : teamIdsDe(grupoId)
        const teamId = teamIds[Number(tecla) - 1]
        if (teamIds.length > 1 && teamId !== undefined) {
          alAbrirTeam(teamId)
        }
      }
    }
    window.addEventListener('keydown', alPresionar)
    return () => window.removeEventListener('keydown', alPresionar)
  }, [activo])
}
