from app.domain.catalogos import Stat
from app.domain.entidades import (
    AniimoDelTeam,
    ImagenAniimo,
    MaterialEstrella,
    ObjetoTransportado,
    Sesion,
    Team,
    Usuario,
    ValoresDeStat,
)
from app.infrastructure.modelos import (
    AniimoDelTeamModelo,
    ImagenAniimoModelo,
    MaterialEstrellaModelo,
    ObjetoTransportadoModelo,
    SesionModelo,
    TeamModelo,
    UsuarioModelo,
)

_CAMPOS_DEL_ANIIMO = (
    "team_id",
    "slot",
    "nombre",
    "elemento",
    "rol",
    "potencial_innato",
    "personalidad",
    "nivel",
    "cp",
    "estrella_actual",
    "nivel_requerido_siguiente_etapa",
    "ganancia_despertar",
    "ganancia_seis_potenciales",
    "despertares_usados",
    "despertares_total",
    "notas_habilidades",
    "notas",
)

# Cada stat del dominio se guarda en cuatro columnas planas con este sufijo.
_COLUMNAS_DE_STAT = {
    "valor_actual": "valor",
    "potencial": "potencial",
    "bono_estrellas_incluido": "bono_estrellas",
    "notas": "notas",
}


def usuario_a_dominio(fila: UsuarioModelo) -> Usuario:
    return Usuario(
        nombre_usuario=fila.nombre_usuario,
        password_hash=fila.password_hash,
        id=fila.id,
        creado_en=fila.creado_en,
    )


def volcar_usuario(usuario: Usuario, fila: UsuarioModelo) -> None:
    fila.id = usuario.id
    fila.nombre_usuario = usuario.nombre_usuario
    fila.password_hash = usuario.password_hash
    fila.creado_en = usuario.creado_en


def sesion_a_dominio(fila: SesionModelo) -> Sesion:
    return Sesion(
        usuario_id=fila.usuario_id,
        token_hash=fila.token_hash,
        creada_en=fila.creada_en,
        expira_en=fila.expira_en,
        vence_en=fila.vence_en,
        id=fila.id,
    )


def volcar_sesion(sesion: Sesion, fila: SesionModelo) -> None:
    fila.id = sesion.id
    fila.usuario_id = sesion.usuario_id
    fila.token_hash = sesion.token_hash
    fila.creada_en = sesion.creada_en
    fila.expira_en = sesion.expira_en
    fila.vence_en = sesion.vence_en


def team_a_dominio(fila: TeamModelo) -> Team:
    return Team(usuario_id=fila.usuario_id, nombre=fila.nombre, orden=fila.orden, id=fila.id)


def volcar_team(team: Team, fila: TeamModelo) -> None:
    fila.id = team.id
    fila.usuario_id = team.usuario_id
    fila.nombre = team.nombre
    fila.orden = team.orden


def _stat_a_dominio(fila: AniimoDelTeamModelo, stat: Stat) -> ValoresDeStat:
    return ValoresDeStat(
        **{
            campo: getattr(fila, f"{stat}_{columna}")
            for campo, columna in _COLUMNAS_DE_STAT.items()
        }
    )


def aniimo_a_dominio(fila: AniimoDelTeamModelo) -> AniimoDelTeam:
    return AniimoDelTeam(
        id=fila.id,
        stats={stat: _stat_a_dominio(fila, stat) for stat in Stat},
        materiales=tuple(
            MaterialEstrella(m.posicion, m.nombre, m.tengo, m.necesito) for m in fila.materiales
        ),
        objetos=tuple(
            ObjetoTransportado(
                posicion=o.posicion,
                nombre=o.nombre,
                rareza=o.rareza,
                nivel=o.nivel,
                contrato=o.contrato,
                efecto_nucleo_notas=o.efecto_nucleo_notas,
            )
            for o in fila.objetos
        ),
        **{campo: getattr(fila, campo) for campo in _CAMPOS_DEL_ANIIMO},
    )


def volcar_aniimo(aniimo: AniimoDelTeam, fila: AniimoDelTeamModelo) -> None:
    fila.id = aniimo.id
    for campo in _CAMPOS_DEL_ANIIMO:
        setattr(fila, campo, getattr(aniimo, campo))
    for stat, valores in aniimo.stats.items():
        for campo, columna in _COLUMNAS_DE_STAT.items():
            setattr(fila, f"{stat}_{columna}", getattr(valores, campo))
    _volcar_materiales(aniimo.materiales, fila)
    _volcar_objetos(aniimo.objetos, fila)


# Los hijos existentes se reutilizan por posicion (su clave) y el resto se descarta, en lugar
# de borrar y reinsertar con la misma clave primaria dentro de un mismo flush.
def _volcar_materiales(materiales: tuple[MaterialEstrella, ...], fila: AniimoDelTeamModelo) -> None:
    existentes = {m.posicion: m for m in fila.materiales}
    nuevos: list[MaterialEstrellaModelo] = []
    for material in materiales:
        hijo = existentes.get(material.posicion) or MaterialEstrellaModelo(
            posicion=material.posicion
        )
        hijo.nombre = material.nombre
        hijo.tengo = material.tengo
        hijo.necesito = material.necesito
        nuevos.append(hijo)
    fila.materiales = nuevos


def _volcar_objetos(objetos: tuple[ObjetoTransportado, ...], fila: AniimoDelTeamModelo) -> None:
    existentes = {o.posicion: o for o in fila.objetos}
    nuevos: list[ObjetoTransportadoModelo] = []
    for objeto in objetos:
        hijo = existentes.get(objeto.posicion) or ObjetoTransportadoModelo(posicion=objeto.posicion)
        hijo.nombre = objeto.nombre
        hijo.rareza = objeto.rareza
        hijo.nivel = objeto.nivel
        hijo.contrato = objeto.contrato
        hijo.efecto_nucleo_notas = objeto.efecto_nucleo_notas
        nuevos.append(hijo)
    fila.objetos = nuevos


def imagen_a_dominio(fila: ImagenAniimoModelo) -> ImagenAniimo:
    return ImagenAniimo(aniimo_id=fila.aniimo_del_team_id, tipo=fila.tipo, datos=fila.datos)


def volcar_imagen(imagen: ImagenAniimo, fila: ImagenAniimoModelo) -> None:
    fila.aniimo_del_team_id = imagen.aniimo_id
    fila.tipo = imagen.tipo
    fila.datos = imagen.datos
