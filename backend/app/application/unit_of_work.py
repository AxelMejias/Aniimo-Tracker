from types import TracebackType
from typing import Self

from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, sessionmaker

from app.domain.catalogos import Stat
from app.domain.errores import (
    AmistadExistente,
    DespertaresInconsistentes,
    ErrorDeDominio,
    ErrorDeIntegridad,
    ImagenDemasiadoGrande,
    ImagenInvalida,
    LimiteDeGruposAlcanzado,
    LimiteDeTeamsAlcanzado,
    NombreUsuarioDuplicado,
    PersonalidadInvalida,
    PosicionDeGrupoOcupada,
    PosicionDeTeamOcupada,
    PotencialFueraDeRango,
    SlotInvalido,
    SlotOcupado,
)
from app.infrastructure.repositorios import (
    AmistadRepository,
    AniimoDelTeamRepository,
    GrupoDeTeamsRepository,
    ImagenAniimoRepository,
    SesionRepository,
    TeamRepository,
    UsuarioRepository,
)

_ERROR_POR_CONSTRAINT: dict[str, type[ErrorDeDominio]] = {
    "uq_usuario_nombre_usuario": NombreUsuarioDuplicado,
    "uq_team_usuario_id_orden": PosicionDeTeamOcupada,
    "uq_aniimo_del_team_team_id_slot": SlotOcupado,
    "uq_amistad_usuario_a_id_usuario_b_id": AmistadExistente,
    "uq_grupo_de_teams_usuario_id_orden": PosicionDeGrupoOcupada,
    "ck_team_orden_rango": LimiteDeTeamsAlcanzado,
    "ck_team_portada_slot_rango": SlotInvalido,
    "ck_grupo_de_teams_orden_rango": LimiteDeGruposAlcanzado,
    "ck_imagen_aniimo_tamano": ImagenDemasiadoGrande,
    "ck_imagen_aniimo_tipo": ImagenInvalida,
    "ck_aniimo_del_team_slot_rango": SlotInvalido,
    "ck_aniimo_del_team_personalidad_formato": PersonalidadInvalida,
    "ck_aniimo_del_team_despertares_consistentes": DespertaresInconsistentes,
    **{f"ck_aniimo_del_team_{stat}_potencial_rango": PotencialFueraDeRango for stat in Stat},
}


_UNICIDADES_DE_ORDEN = "uq_team_usuario_id_orden, uq_grupo_de_teams_usuario_id_orden"


def _nombre_del_constraint(error: IntegrityError) -> str | None:
    diag = getattr(error.orig, "diag", None)
    return getattr(diag, "constraint_name", None)


def _traducir(error: IntegrityError) -> ErrorDeDominio:
    nombre = _nombre_del_constraint(error)
    return _ERROR_POR_CONSTRAINT.get(nombre or "", ErrorDeIntegridad)()


class UnitOfWork:
    def __init__(self, session_factory: sessionmaker[Session]) -> None:
        self._session_factory = session_factory

    def __enter__(self) -> Self:
        self.session = self._session_factory()
        self.usuarios = UsuarioRepository(self.session)
        self.teams = TeamRepository(self.session)
        self.grupos = GrupoDeTeamsRepository(self.session)
        self.aniimos = AniimoDelTeamRepository(self.session)
        self.sesiones = SesionRepository(self.session)
        self.imagenes = ImagenAniimoRepository(self.session)
        self.amistades = AmistadRepository(self.session)
        self._unicidad_diferida = False
        return self

    def __exit__(
        self,
        tipo: type[BaseException] | None,
        error: BaseException | None,
        traza: TracebackType | None,
    ) -> None:
        self.session.rollback()
        self.session.close()

    def diferir_unicidad_de_orden(self) -> None:
        self.session.execute(text(f"SET CONSTRAINTS {_UNICIDADES_DE_ORDEN} DEFERRED"))
        self._unicidad_diferida = True

    def commit(self) -> None:
        traducido: ErrorDeDominio | None = None
        try:
            self.session.flush()
            if self._unicidad_diferida:
                self.session.execute(text(f"SET CONSTRAINTS {_UNICIDADES_DE_ORDEN} IMMEDIATE"))
            self.session.commit()
        except IntegrityError as error:
            self.session.rollback()
            traducido = _traducir(error)
        # Se lanza fuera del except para que el error de dominio no arrastre el SQL ni los
        # parametros (password_hash) del IntegrityError original en el traceback.
        if traducido is not None:
            raise traducido
