from collections.abc import Callable, Sequence
from datetime import datetime
from typing import Generic, Protocol, TypeVar
from uuid import UUID

from sqlalchemy import Select, delete, or_, select
from sqlalchemy.orm import Session, selectinload
from sqlalchemy.orm.interfaces import ORMOption

from app.domain.entidades import (
    AniimoDelTeam,
    ImagenAniimo,
    Sesion,
    Team,
    Usuario,
    normalizar_nombre_usuario,
)
from app.domain.errores import EntidadNoEncontrada
from app.infrastructure.mapeo import (
    aniimo_a_dominio,
    imagen_a_dominio,
    sesion_a_dominio,
    team_a_dominio,
    usuario_a_dominio,
    volcar_aniimo,
    volcar_imagen,
    volcar_sesion,
    volcar_team,
    volcar_usuario,
)
from app.infrastructure.modelos import (
    AniimoDelTeamModelo,
    ImagenAniimoModelo,
    SesionModelo,
    TeamModelo,
    UsuarioModelo,
)


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

    def obtener_de_usuario(self, team_id: UUID, usuario_id: UUID) -> Team | None:
        consulta = select(TeamModelo).where(
            TeamModelo.id == team_id, TeamModelo.usuario_id == usuario_id
        )
        teams = self._convertir(consulta)
        return teams[0] if teams else None


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

    def listar_por_teams(self, team_ids: Sequence[UUID]) -> list[AniimoDelTeam]:
        if not team_ids:
            return []
        consulta = (
            select(AniimoDelTeamModelo)
            .where(AniimoDelTeamModelo.team_id.in_(team_ids))
            .order_by(AniimoDelTeamModelo.team_id, AniimoDelTeamModelo.slot)
        )
        return self._convertir(consulta)

    def obtener_por_slot(self, team_id: UUID, slot: int) -> AniimoDelTeam | None:
        consulta = select(AniimoDelTeamModelo).where(
            AniimoDelTeamModelo.team_id == team_id, AniimoDelTeamModelo.slot == slot
        )
        aniimos = self._convertir(consulta)
        return aniimos[0] if aniimos else None


class ImagenAniimoRepository:
    def __init__(self, session: Session) -> None:
        self._session = session

    def guardar(self, imagen: ImagenAniimo) -> None:
        fila = self._session.get(ImagenAniimoModelo, imagen.aniimo_id)
        if fila is None:
            fila = ImagenAniimoModelo()
            self._session.add(fila)
        volcar_imagen(imagen, fila)

    def obtener(self, aniimo_id: UUID) -> ImagenAniimo | None:
        fila = self._session.get(ImagenAniimoModelo, aniimo_id)
        return None if fila is None else imagen_a_dominio(fila)

    def borrar(self, aniimo_id: UUID) -> None:
        self._session.execute(
            delete(ImagenAniimoModelo).where(ImagenAniimoModelo.aniimo_del_team_id == aniimo_id)
        )

    def ids_con_imagen(self, aniimo_ids: Sequence[UUID]) -> set[UUID]:
        if not aniimo_ids:
            return set()
        consulta = select(ImagenAniimoModelo.aniimo_del_team_id).where(
            ImagenAniimoModelo.aniimo_del_team_id.in_(aniimo_ids)
        )
        return set(self._session.scalars(consulta))


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
