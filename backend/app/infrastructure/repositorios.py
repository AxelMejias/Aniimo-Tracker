from collections.abc import Callable, Sequence
from datetime import datetime
from typing import Generic, Protocol, TypeVar
from uuid import UUID

from sqlalchemy import Select, delete, or_, select
from sqlalchemy.orm import Session, selectinload
from sqlalchemy.orm.interfaces import ORMOption

from app.domain.entidades import AniimoDelTeam, Sesion, Team, Usuario, normalizar_nombre_usuario
from app.domain.errores import EntidadNoEncontrada
from app.infrastructure.mapeo import (
    aniimo_a_dominio,
    sesion_a_dominio,
    team_a_dominio,
    usuario_a_dominio,
    volcar_aniimo,
    volcar_sesion,
    volcar_team,
    volcar_usuario,
)
from app.infrastructure.modelos import AniimoDelTeamModelo, SesionModelo, TeamModelo, UsuarioModelo


class ConId(Protocol):
    @property
    def id(self) -> UUID: ...


E = TypeVar("E", bound=ConId)
M = TypeVar("M")


class BaseRepository(Generic[E, M]):
    def __init__(
        self,
        session: Session,
        modelo: type[M],
        a_dominio: Callable[[M], E],
        volcar: Callable[[E, M], None],
        opciones_de_carga: Sequence[ORMOption] = (),
    ) -> None:
        self._session = session
        self._modelo = modelo
        self._a_dominio = a_dominio
        self._volcar = volcar
        self._opciones = tuple(opciones_de_carga)

    def agregar(self, entidad: E) -> None:
        fila = self._modelo()
        self._volcar(entidad, fila)
        self._session.add(fila)

    def actualizar(self, entidad: E) -> None:
        fila = self._session.get(self._modelo, entidad.id, options=self._opciones)
        if fila is None:
            raise EntidadNoEncontrada
        self._volcar(entidad, fila)

    def obtener(self, entidad_id: UUID) -> E | None:
        fila = self._session.get(self._modelo, entidad_id, options=self._opciones)
        return None if fila is None else self._a_dominio(fila)

    def listar(self) -> list[E]:
        return self._convertir(select(self._modelo))

    def borrar(self, entidad_id: UUID) -> None:
        fila = self._session.get(self._modelo, entidad_id)
        if fila is not None:
            self._session.delete(fila)

    def _convertir(self, consulta: Select[tuple[M]]) -> list[E]:
        filas = self._session.scalars(consulta.options(*self._opciones)).all()
        return [self._a_dominio(fila) for fila in filas]


class UsuarioRepository(BaseRepository[Usuario, UsuarioModelo]):
    def __init__(self, session: Session) -> None:
        super().__init__(session, UsuarioModelo, usuario_a_dominio, volcar_usuario)

    def obtener_por_nombre_usuario(self, nombre_usuario: str) -> Usuario | None:
        consulta = select(UsuarioModelo).where(
            UsuarioModelo.nombre_usuario == normalizar_nombre_usuario(nombre_usuario)
        )
        usuarios = self._convertir(consulta)
        return usuarios[0] if usuarios else None


class TeamRepository(BaseRepository[Team, TeamModelo]):
    def __init__(self, session: Session) -> None:
        super().__init__(session, TeamModelo, team_a_dominio, volcar_team)

    def listar_por_usuario(self, usuario_id: UUID) -> list[Team]:
        consulta = (
            select(TeamModelo).where(TeamModelo.usuario_id == usuario_id).order_by(TeamModelo.orden)
        )
        return self._convertir(consulta)


class AniimoDelTeamRepository(BaseRepository[AniimoDelTeam, AniimoDelTeamModelo]):
    def __init__(self, session: Session) -> None:
        super().__init__(
            session,
            AniimoDelTeamModelo,
            aniimo_a_dominio,
            volcar_aniimo,
            opciones_de_carga=(
                selectinload(AniimoDelTeamModelo.materiales),
                selectinload(AniimoDelTeamModelo.objetos),
            ),
        )

    def listar_por_team(self, team_id: UUID) -> list[AniimoDelTeam]:
        consulta = (
            select(AniimoDelTeamModelo)
            .where(AniimoDelTeamModelo.team_id == team_id)
            .order_by(AniimoDelTeamModelo.slot)
        )
        return self._convertir(consulta)


class SesionRepository(BaseRepository[Sesion, SesionModelo]):
    def __init__(self, session: Session) -> None:
        super().__init__(session, SesionModelo, sesion_a_dominio, volcar_sesion)

    def obtener_por_token_hash(self, token_hash: str) -> Sesion | None:
        consulta = select(SesionModelo).where(SesionModelo.token_hash == token_hash)
        sesiones = self._convertir(consulta)
        return sesiones[0] if sesiones else None

    def borrar_vencidas_de(self, usuario_id: UUID, ahora: datetime) -> None:
        self._session.execute(
            delete(SesionModelo).where(
                SesionModelo.usuario_id == usuario_id,
                or_(SesionModelo.expira_en <= ahora, SesionModelo.vence_en <= ahora),
            )
        )
