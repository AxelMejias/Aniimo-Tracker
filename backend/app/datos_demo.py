import argparse
import os
import sys
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import date, timedelta
from uuid import UUID

from pydantic import SecretStr, ValidationError
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy import create_engine
from sqlalchemy.engine import make_url
from sqlalchemy.exc import ArgumentError, SQLAlchemyError
from sqlalchemy.orm import Session, sessionmaker

from app.application.amigos import ServicioDeAmigos
from app.application.auth import HasherDeContrasenas, ServicioDeAuth
from app.application.grupos import ServicioDeGrupos
from app.application.teams import DatosDeFicha, ServicioDeTeams
from app.application.unit_of_work import UnitOfWork
from app.core.reloj import ahora_utc
from app.domain.catalogos import Elemento, PosicionObjeto, PotencialInnato, Rareza, Rol, Stat
from app.domain.entidades import MaterialEstrella, ObjetoTransportado, ValoresDeStat
from app.domain.errores import ErrorDeDominio
from app.infrastructure.contrasenas import HasherArgon2
from app.infrastructure.database import make_session_factory

PUERTO_BASE_DE_DESARROLLO = 5434
HOSTS_DE_LOOPBACK = frozenset({"127.0.0.1", "localhost"})
LARGO_MINIMO_DE_CONTRASENA = 12
LARGO_MAXIMO_DE_CONTRASENA = 128
SEGUNDOS_DE_ESPERA_DE_LA_BASE = 5

CUENTAS_DE_DEMO = ("demo_ana", "demo_beto", "demo_caro")

MENSAJE_YA_EXISTEN = "Los datos de demo ya existen; usá --reiniciar para recrearlos."


class ErrorDeDemo(Exception):
    pass


def motivo_para_rechazar_base(database_url: str, test_database_url: str | None) -> str | None:
    try:
        url = make_url(database_url)
    except ArgumentError:
        return "DATABASE_URL es inválida: no se puede interpretar."
    if url.host not in HOSTS_DE_LOOPBACK:
        return "DATABASE_URL no apunta a loopback (127.0.0.1 o localhost): no es la base local."
    if url.port != PUERTO_BASE_DE_DESARROLLO:
        return (
            f"DATABASE_URL debe usar el puerto {PUERTO_BASE_DE_DESARROLLO} "
            "(el de la base de desarrollo en docker-compose.yml)."
        )
    if test_database_url:
        try:
            if url == make_url(test_database_url):
                return "DATABASE_URL es igual a TEST_DATABASE_URL: esa es la base de tests."
        except ArgumentError:
            pass
    return None


class ConfiguracionDeDemo(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str
    datos_demo_contrasena: SecretStr = SecretStr("")

    def contrasena(self) -> str:
        valor = self.datos_demo_contrasena.get_secret_value()
        if not LARGO_MINIMO_DE_CONTRASENA <= len(valor) <= LARGO_MAXIMO_DE_CONTRASENA:
            raise ErrorDeDemo(
                "Definí DATOS_DEMO_CONTRASENA en backend/.env con entre "
                f"{LARGO_MINIMO_DE_CONTRASENA} y {LARGO_MAXIMO_DE_CONTRASENA} caracteres."
            )
        return valor


@dataclass(frozen=True, slots=True)
class ResumenDeDemo:
    cuentas: tuple[str, ...] = CUENTAS_DE_DEMO
    teams: int = 0
    aniimos: int = 0
    borradas: tuple[str, ...] = ()
    ya_existian: bool = False

    def texto(self) -> str:
        if self.ya_existian:
            return MENSAJE_YA_EXISTEN
        lineas: list[str] = []
        if self.borradas:
            lineas.append(f"Borradas: {', '.join(self.borradas)}")
        lineas.append(f"Cuentas de demo creadas: {', '.join(self.cuentas)}")
        lineas.append(f"Teams: {self.teams}, Aniimo: {self.aniimos}")
        lineas.append(
            "demo_ana y demo_beto son amigos; demo_caro tiene una solicitud pendiente a demo_ana."
        )
        lineas.append("La contraseña es la de DATOS_DEMO_CONTRASENA en backend/.env.")
        return "\n".join(lineas)


def _stats(base: int, potencial: int) -> dict[Stat, ValoresDeStat]:
    return {
        stat: ValoresDeStat(
            valor_actual=base + indice * 37,
            potencial=(potencial + indice) % 21,
            bono_estrellas_incluido=indice * 5,
        )
        for indice, stat in enumerate(Stat)
    }


def _ficha(nombre: str, nivel: int, **cambios: object) -> DatosDeFicha:
    base = {
        "nombre": nombre,
        "elemento": Elemento.FUEGO,
        "rol": Rol.DPS,
        "potencial_innato": PotencialInnato.BUENO,
        "personalidad": "INTJ",
        "nivel": nivel,
        "cp": nivel * 55,
        "fecha_parche": date(2026, 10, 26),
        "etapa_estrella": 2,
        "stats": _stats(nivel * 12, 5),
        "estrella_actual": 1,
        "nivel_requerido_siguiente_etapa": nivel + 5,
        "ganancia_despertar": 2,
        "ganancia_seis_potenciales": 1,
        "despertares_usados": 10,
        "despertares_total": 30,
        "materiales": (),
        "objetos": (),
        "notas_habilidades": None,
        "notas": None,
        "notas_privadas": False,
    }
    return DatosDeFicha(**{**base, **cambios})  # type: ignore[arg-type]


_OBJETO_DE_DEMO = ObjetoTransportado(
    posicion=PosicionObjeto.EQUIPADO,
    nombre="Amuleto de demo",
    rareza=Rareza.EPICA,
    nivel=8,
    contrato=True,
    efecto_nucleo_notas="Efecto inventado para la demo",
)

_ANA_PRINCIPAL = (
    _ficha(
        "Demoflama",
        60,
        elemento=Elemento.FUEGO,
        rol=Rol.DPS,
        potencial_innato=PotencialInnato.PERFECTO,
        personalidad="ENFJ",
        estrella_actual=3,
        etapa_estrella=4,
        despertares_usados=28,
        despertares_total=43,
        materiales=(
            MaterialEstrella(posicion=1, nombre="Polvo de demo", tengo=120, necesito=60),
            MaterialEstrella(posicion=2, nombre="Fragmento de demo", tengo=1, necesito=2),
        ),
        objetos=(_OBJETO_DE_DEMO,),
        notas="Probar este equipo contra el jefe de la semana.",
        notas_habilidades="Habilidad 1: golpe de demo | Habilidad 2: aura de demo",
        notas_privadas=True,
    ),
    _ficha(
        "Demobrisa",
        45,
        elemento=Elemento.VIENTO,
        rol=Rol.AYUDA,
        potencial_innato=PotencialInnato.ELITE,
        personalidad="ISFP",
        estrella_actual=0,
        etapa_estrella=1,
        despertares_usados=0,
        despertares_total=20,
    ),
    _ficha(
        "Demohielo",
        72,
        elemento=Elemento.HIELO,
        rol=Rol.CURACION,
        potencial_innato=PotencialInnato.COMUN,
        personalidad="ESTP",
        estrella_actual=5,
        etapa_estrella=6,
        despertares_usados=40,
        despertares_total=40,
        fecha_parche=None,
    ),
)
_ELEMENTOS = tuple(Elemento)
_ROLES = tuple(Rol)


def _equipo(*nombres: str) -> tuple[DatosDeFicha, ...]:
    return tuple(
        _ficha(
            nombre,
            30 + indice * 6,
            elemento=_ELEMENTOS[indice % len(_ELEMENTOS)],
            rol=_ROLES[indice % len(_ROLES)],
        )
        for indice, nombre in enumerate(nombres)
    )


_ANA_JEFES = (
    _ficha("Demovolt", 55, elemento=Elemento.ELECTRICO, rol=Rol.BREAK, personalidad="ENTP"),
    _ficha("Demoroca", 38, elemento=Elemento.ROCA, rol=Rol.AYUDA, personalidad="ISTJ"),
)
_ANA_TORRE = _equipo("Demoluz", "Demoflama", "Demobrisa", "Demovolt")
_BETO_RANKED = _ANA_JEFES
_CARO = (_ficha("Demosombra", 66, elemento=Elemento.OSCURO, rol=Rol.DPS, personalidad="INFP"),)

# Team: (nombre, fichas, oculto, slot de portada). Grupo: (nombre, teams, team de portada).
_TeamDeDemo = tuple[str, Sequence[DatosDeFicha], bool, int | None]
_GrupoDeDemo = tuple[str, Sequence[_TeamDeDemo], str]

_ANA_GRUPOS: tuple[_GrupoDeDemo, ...] = (
    (
        "Buildeado",
        (
            ("Principal", _ANA_PRINCIPAL, False, None),
            ("Jefes", _ANA_JEFES, True, None),
            ("Torre", _ANA_TORRE, False, 3),
            ("Raid", _equipo("Demoroca", "Demohielo", "Demoluz"), False, None),
            ("PvP", _equipo("Demovolt", "Demoflama", "Demobrisa", "Demoroca"), False, None),
        ),
        "Principal",
    ),
    (
        "En proceso",
        (
            ("Pruebas", _equipo("Demoluz"), False, None),
            ("Subiendo", _equipo("Demohielo", "Demobrisa"), False, None),
            ("Hielo", _equipo("Demohielo"), False, None),
        ),
        "Pruebas",
    ),
    (
        "Homeland",
        (
            ("Casa", _equipo("Demoroca", "Demoluz", "Demoflama", "Demobrisa"), False, None),
            ("Jardín", _equipo("Demobrisa", "Demohielo"), False, None),
        ),
        "Casa",
    ),
)
_ANA_SUELTOS: tuple[_TeamDeDemo, ...] = (
    ("Farmeo", (), False, None),
    ("Eventos", _equipo("Demovolt"), False, None),
)
_BETO_GRUPOS: tuple[_GrupoDeDemo, ...] = (
    (
        "Competitivo",
        (
            ("Ranked", _BETO_RANKED, False, None),
            ("Torneo", _equipo("Demoluz"), False, None),
            ("Entrenamiento", _equipo("Demoflama", "Demobrisa", "Demohielo"), False, None),
        ),
        "Ranked",
    ),
)
_BETO_SUELTOS: tuple[_TeamDeDemo, ...] = (("Paseo", _equipo("Demoroca"), False, None),)


_CUENTAS: tuple[tuple[Sequence[_GrupoDeDemo], Sequence[_TeamDeDemo]], ...] = (
    (_ANA_GRUPOS, _ANA_SUELTOS),
    (_BETO_GRUPOS, _BETO_SUELTOS),
    ((), (("Demo Caro", _CARO, False, None),)),
)


def _cargar_team(teams: ServicioDeTeams, usuario_id: UUID, equipo: _TeamDeDemo) -> UUID:
    nombre, fichas, oculto, portada_slot = equipo
    resumen = teams.crear(usuario_id, nombre)
    team_id = resumen.team.id
    if oculto:
        teams.editar(usuario_id, team_id, oculto_para_amigos=True)
    for slot, ficha in enumerate(fichas, start=1):
        teams.guardar_ficha(usuario_id, team_id, slot, ficha)
    if portada_slot is not None:
        teams.editar(usuario_id, team_id, portada_slot=portada_slot)
    return team_id


def _cargar_grupo(
    teams: ServicioDeTeams, grupos: ServicioDeGrupos, usuario_id: UUID, grupo: _GrupoDeDemo
) -> None:
    nombre, equipos, nombre_de_portada = grupo
    lista = grupos.crear(usuario_id, nombre)
    grupo_id = next(g.grupo.id for g in lista.grupos if g.grupo.nombre == nombre)
    ids = {equipo[0]: _cargar_team(teams, usuario_id, equipo) for equipo in equipos}
    for team_id in ids.values():
        grupos.agregar_team(usuario_id, grupo_id, team_id)
    grupos.editar(usuario_id, grupo_id, portada_team_id=ids[nombre_de_portada])


def _cargar_cuenta(
    teams: ServicioDeTeams,
    grupos: ServicioDeGrupos,
    usuario_id: UUID,
    con_grupos: Sequence[_GrupoDeDemo],
    sueltos: Sequence[_TeamDeDemo],
) -> None:
    for grupo in con_grupos:
        _cargar_grupo(teams, grupos, usuario_id, grupo)
    for equipo in sueltos:
        _cargar_team(teams, usuario_id, equipo)


def _contar(con_grupos: Sequence[_GrupoDeDemo], sueltos: Sequence[_TeamDeDemo]) -> tuple[int, int]:
    equipos = [e for _, miembros, _ in con_grupos for e in miembros] + list(sueltos)
    return len(equipos), sum(len(e[1]) for e in equipos)


def crear_datos_demo(
    auth: ServicioDeAuth,
    teams: ServicioDeTeams,
    grupos: ServicioDeGrupos,
    amigos: ServicioDeAmigos,
    contrasena: str,
) -> ResumenDeDemo:
    ana, beto, caro = (auth.registrar(nombre, contrasena) for nombre in CUENTAS_DE_DEMO)
    for usuario, (con_grupos, sueltos) in zip((ana, beto, caro), _CUENTAS, strict=True):
        _cargar_cuenta(teams, grupos, usuario.id, con_grupos, sueltos)
    amigos.enviar_solicitud(ana.id, beto.id)
    amigos.aceptar(beto.id, ana.id)
    amigos.enviar_solicitud(caro.id, ana.id)
    conteos = [_contar(con_grupos, sueltos) for con_grupos, sueltos in _CUENTAS]
    return ResumenDeDemo(teams=sum(c[0] for c in conteos), aniimos=sum(c[1] for c in conteos))


def borrar_datos_demo(session_factory: sessionmaker[Session]) -> tuple[str, ...]:
    borradas: list[str] = []
    for nombre in CUENTAS_DE_DEMO:
        with UnitOfWork(session_factory) as uow:
            usuario = uow.usuarios.obtener_por_nombre_usuario(nombre)
            if usuario is not None:
                uow.usuarios.borrar(usuario.id)
                uow.commit()
                borradas.append(nombre)
    return tuple(borradas)


def _existe_alguna_cuenta_de_demo(session_factory: sessionmaker[Session]) -> bool:
    with UnitOfWork(session_factory) as uow:
        return any(
            uow.usuarios.obtener_por_nombre_usuario(nombre) is not None
            for nombre in CUENTAS_DE_DEMO
        )


def preparar_datos_demo(
    auth: ServicioDeAuth,
    teams: ServicioDeTeams,
    grupos: ServicioDeGrupos,
    amigos: ServicioDeAmigos,
    session_factory: sessionmaker[Session],
    contrasena: str,
    *,
    reiniciar: bool,
) -> ResumenDeDemo:
    borradas: tuple[str, ...] = ()
    if reiniciar:
        borradas = borrar_datos_demo(session_factory)
    elif _existe_alguna_cuenta_de_demo(session_factory):
        return ResumenDeDemo(ya_existian=True)
    creado = crear_datos_demo(auth, teams, grupos, amigos, contrasena)
    return ResumenDeDemo(teams=creado.teams, aniimos=creado.aniimos, borradas=borradas)


def _fallar(mensaje: str) -> int:
    print(f"No se tocó nada. {mensaje}", file=sys.stderr)
    return 1


def main(
    argv: Sequence[str] | None = None,
    *,
    configuracion: ConfiguracionDeDemo | None = None,
    test_database_url: str | None = None,
    session_factory: sessionmaker[Session] | None = None,
    hasher: HasherDeContrasenas | None = None,
) -> int:
    parser = argparse.ArgumentParser(
        prog="python -m app.datos_demo",
        description="Crea las cuentas de demo (demo_ana, demo_beto, demo_caro) en la base local.",
    )
    parser.add_argument(
        "--reiniciar",
        action="store_true",
        help="borra y recrea solo las tres cuentas de demo",
    )
    args = parser.parse_args(argv)

    try:
        config = configuracion or ConfiguracionDeDemo()
    except ValidationError:
        return _fallar("Falta DATABASE_URL: revisá backend/.env.")

    motivo = motivo_para_rechazar_base(
        config.database_url, test_database_url or os.environ.get("TEST_DATABASE_URL")
    )
    if motivo is not None:
        return _fallar(motivo)
    try:
        contrasena = config.contrasena()
    except ErrorDeDemo as error:
        return _fallar(str(error))

    if session_factory is None:
        engine = create_engine(
            config.database_url,
            connect_args={"connect_timeout": SEGUNDOS_DE_ESPERA_DE_LA_BASE},
        )
        session_factory = make_session_factory(engine)
    reloj = ahora_utc
    auth = ServicioDeAuth(
        session_factory,
        hasher or HasherArgon2(),
        timedelta(minutes=30),
        timedelta(hours=12),
        reloj,
    )
    try:
        resumen = preparar_datos_demo(
            auth,
            ServicioDeTeams(session_factory),
            ServicioDeGrupos(session_factory),
            ServicioDeAmigos(session_factory, reloj),
            session_factory,
            contrasena,
            reiniciar=args.reiniciar,
        )
    except (SQLAlchemyError, ErrorDeDominio):
        return _fallar(
            "No se pudo usar la base de desarrollo. ¿Está levantada y migrada? "
            "(docker compose up -d db; alembic upgrade head)"
        )
    print(resumen.texto())
    return 0


if __name__ == "__main__":
    sys.exit(main())
