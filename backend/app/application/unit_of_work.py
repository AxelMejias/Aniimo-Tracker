from types import TracebackType
from typing import Self

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, sessionmaker

from app.domain.catalogos import Stat
from app.domain.errores import (
    DespertaresInconsistentes,
    ErrorDeDominio,
    ErrorDeIntegridad,
    LimiteDeTeamsAlcanzado,
    NombreUsuarioDuplicado,
    PersonalidadInvalida,
    PosicionDeTeamOcupada,
    PotencialFueraDeRango,
    SlotInvalido,
    SlotOcupado,
)
from app.infrastructure.repositorios import (
    AniimoDelTeamRepository,
    TeamRepository,
    UsuarioRepository,
)

_ERROR_POR_CONSTRAINT: dict[str, type[ErrorDeDominio]] = {
    "uq_usuario_nombre_usuario": NombreUsuarioDuplicado,
    "uq_team_usuario_id_orden": PosicionDeTeamOcupada,
    "uq_aniimo_del_team_team_id_slot": SlotOcupado,
    "ck_team_orden_rango": LimiteDeTeamsAlcanzado,
    "ck_aniimo_del_team_slot_rango": SlotInvalido,
    "ck_aniimo_del_team_personalidad_formato": PersonalidadInvalida,
    "ck_aniimo_del_team_despertares_consistentes": DespertaresInconsistentes,
    **{f"ck_aniimo_del_team_{stat}_potencial_rango": PotencialFueraDeRango for stat in Stat},
}


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
        self.aniimos = AniimoDelTeamRepository(self.session)
        return self

    def __exit__(
        self,
        tipo: type[BaseException] | None,
        error: BaseException | None,
        traza: TracebackType | None,
    ) -> None:
        self.session.rollback()
        self.session.close()

    def commit(self) -> None:
        traducido: ErrorDeDominio | None = None
        try:
            self.session.flush()
            self.session.commit()
        except IntegrityError as error:
            self.session.rollback()
            traducido = _traducir(error)
        # Se lanza fuera del except para que el error de dominio no arrastre el SQL ni los
        # parametros (password_hash) del IntegrityError original en el traceback.
        if traducido is not None:
            raise traducido
