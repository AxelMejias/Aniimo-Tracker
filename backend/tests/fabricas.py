from sqlalchemy.orm import Session, sessionmaker

from app.application.unit_of_work import UnitOfWork
from app.domain.entidades import AniimoDelTeam, Team, Usuario


def persistir_usuario(
    session_factory: sessionmaker[Session], nombre_usuario: str = "axel"
) -> Usuario:
    usuario = Usuario(nombre_usuario, "hash-de-prueba")
    with UnitOfWork(session_factory) as uow:
        uow.usuarios.agregar(usuario)
        uow.commit()
    return usuario


def persistir_team(
    session_factory: sessionmaker[Session], usuario: Usuario, orden: int = 1
) -> Team:
    team = Team(usuario_id=usuario.id, nombre=f"Team {orden}", orden=orden)
    with UnitOfWork(session_factory) as uow:
        uow.teams.agregar(team)
        uow.commit()
    return team


def persistir_aniimo(session_factory: sessionmaker[Session], aniimo: AniimoDelTeam) -> None:
    with UnitOfWork(session_factory) as uow:
        uow.aniimos.agregar(aniimo)
        uow.commit()
