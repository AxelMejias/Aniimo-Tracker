from dataclasses import fields
from datetime import UTC, datetime, timedelta
from typing import Any

from fastapi.testclient import TestClient
from httpx import Response
from sqlalchemy.orm import Session, sessionmaker

from app.application.teams import DatosDeFicha
from app.application.unit_of_work import UnitOfWork
from app.domain.entidades import AniimoDelTeam, Sesion, Team, Usuario
from app.infrastructure.contrasenas import HasherArgon2


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


def sesion_de_prueba(
    usuario: Usuario,
    token_hash: str = "a" * 64,
    creada_en: datetime | None = None,
    expira_en: datetime | None = None,
    vence_en: datetime | None = None,
) -> Sesion:
    creada = creada_en or datetime(2026, 1, 1, 10, 0, tzinfo=UTC)
    return Sesion(
        usuario_id=usuario.id,
        token_hash=token_hash,
        creada_en=creada,
        expira_en=expira_en or creada + timedelta(minutes=30),
        vence_en=vence_en or creada + timedelta(hours=12),
    )


def persistir_sesion(session_factory: sessionmaker[Session], sesion: Sesion) -> Sesion:
    with UnitOfWork(session_factory) as uow:
        uow.sesiones.agregar(sesion)
        uow.commit()
    return sesion


class RelojFalso:
    def __init__(self, ahora: datetime | None = None) -> None:
        self.ahora = ahora or datetime(2026, 1, 1, 10, 0, tzinfo=UTC)

    def __call__(self) -> datetime:
        return self.ahora

    def avanzar(self, **delta: float) -> None:
        self.ahora += timedelta(**delta)


class HasherEspia:
    def __init__(self, hasher: HasherArgon2 | None = None) -> None:
        self._hasher = hasher or hasher_barato()
        self.verificaciones: list[str] = []

    def hashear(self, contrasena: str) -> str:
        return self._hasher.hashear(contrasena)

    def verificar(self, contrasena: str, hash_guardado: str) -> bool:
        self.verificaciones.append(hash_guardado)
        return self._hasher.verificar(contrasena, hash_guardado)

    def necesita_rehash(self, hash_guardado: str) -> bool:
        return self._hasher.necesita_rehash(hash_guardado)


def hasher_barato(time_cost: int = 1) -> HasherArgon2:
    return HasherArgon2(time_cost=time_cost, memory_cost=8, parallelism=1)


CLAVE = "una-clave-larga"


def registrar(cliente: TestClient, nombre: str = "axel", contrasena: str = CLAVE) -> Response:
    return cliente.post(
        "/api/auth/register", json={"nombre_usuario": nombre, "contrasena": contrasena}
    )


def iniciar_sesion(cliente: TestClient, nombre: str = "axel", contrasena: str = CLAVE) -> Response:
    return cliente.post(
        "/api/auth/login", json={"nombre_usuario": nombre, "contrasena": contrasena}
    )


def con_token(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def token_de(cliente: TestClient, nombre: str = "axel", contrasena: str = CLAVE) -> str:
    return iniciar_sesion(cliente, nombre, contrasena).json()["access_token"]


def datos_de_ficha(aniimo: AniimoDelTeam, **cambios: object) -> DatosDeFicha:
    campos = {f.name: getattr(aniimo, f.name) for f in fields(DatosDeFicha)}
    return DatosDeFicha(**{**campos, **cambios})


class ClienteAutenticado:
    def __init__(self, cliente: TestClient, token: str) -> None:
        self._cliente = cliente
        self.cabeceras = con_token(token)

    def request(self, metodo: str, url: str, **kwargs: object) -> Response:
        cabeceras = {**self.cabeceras, **kwargs.pop("headers", {})}
        return self._cliente.request(metodo, url, headers=cabeceras, **kwargs)

    def get(self, url: str, **kwargs: object) -> Response:
        return self.request("GET", url, **kwargs)

    def post(self, url: str, **kwargs: object) -> Response:
        return self.request("POST", url, **kwargs)

    def put(self, url: str, **kwargs: object) -> Response:
        return self.request("PUT", url, **kwargs)

    def patch(self, url: str, **kwargs: object) -> Response:
        return self.request("PATCH", url, **kwargs)

    def delete(self, url: str, **kwargs: object) -> Response:
        return self.request("DELETE", url, **kwargs)


def autenticar(cliente: TestClient, nombre: str) -> ClienteAutenticado:
    registrar(cliente, nombre)
    return ClienteAutenticado(cliente, token_de(cliente, nombre))


def ficha_de_referencia() -> dict[str, Any]:
    def stat(valor: int, potencial: int, bono: int = 0, notas: str | None = None) -> dict[str, Any]:
        return {
            "valor_actual": valor,
            "potencial": potencial,
            "bono_estrellas_incluido": bono,
            "notas": notas,
        }

    return {
        "nombre": "Irisalis",
        "elemento": "hielo",
        "rol": "curacion",
        "potencial_innato": "perfecto",
        "personalidad": "ENFJ",
        "nivel": 60,
        "cp": 3475,
        "stats": {
            "ps": stat(11321, 11, 120),
            "atq": stat(723, 20, 0, "Tope de potencial"),
            "def_fisica": stat(258, 5),
            "def_magica": stat(270, 4),
            "regen": stat(388, 20, 15),
            "quiebre": stat(309, 6),
        },
        "entrenamiento": {
            "estrella_actual": 2,
            "nivel_requerido_siguiente_etapa": 65,
            "ganancia_despertar": 3,
            "ganancia_seis_potenciales": 1,
            "despertares_total": 43,
            "despertares_usados": 28,
            "materiales": [
                {"posicion": 1, "nombre": "Polvo estelar", "tengo": 413, "necesito": 60},
                {"posicion": 2, "nombre": "Fragmento", "tengo": 1, "necesito": 2},
                {"posicion": 3, "nombre": "Esencia", "tengo": 3, "necesito": 10},
            ],
        },
        "objetos": [
            {
                "posicion": "equipado",
                "nombre": "Corona antigua",
                "rareza": "legendaria",
                "nivel": 15,
                "contrato": True,
                "efecto_nucleo_notas": "Efecto de nucleo de prueba",
            },
            {
                "posicion": "alternativo",
                "nombre": "Anillo simple",
                "rareza": "rara",
                "nivel": 4,
                "contrato": False,
                "efecto_nucleo_notas": None,
            },
        ],
        "notas_habilidades": "Habilidad 1: ataque electrico | Habilidad 2: curacion",
        "notas": "Aniimo de referencia",
    }
