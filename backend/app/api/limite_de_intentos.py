import math
from collections import deque
from collections.abc import Callable
from dataclasses import dataclass
from datetime import datetime, timedelta
from threading import Lock

from app.core.reloj import ahora_utc

LOGIN_FALLIDOS_MAXIMO = 5
LOGIN_FALLIDOS_VENTANA = timedelta(minutes=15)
LOGIN_POR_CLIENTE_MAXIMO = 20
LOGIN_POR_CLIENTE_VENTANA = timedelta(minutes=1)
REGISTROS_POR_CLIENTE_MAXIMO = 5
REGISTROS_POR_CLIENTE_VENTANA = timedelta(hours=1)


class LimitadorDeIntentos:
    """Ventana deslizante en memoria; asume un solo proceso."""

    def __init__(
        self, maximo: int, ventana: timedelta, reloj: Callable[[], datetime] = ahora_utc
    ) -> None:
        self._maximo = maximo
        self._ventana = ventana
        self._reloj = reloj
        self._intentos: dict[str, deque[datetime]] = {}
        self._lock = Lock()

    def excedido(self, clave: str) -> bool:
        with self._lock:
            return self._vigentes(clave) >= self._maximo

    def registrar(self, clave: str) -> None:
        with self._lock:
            self._registrar(clave)

    def intentar(self, clave: str) -> bool:
        with self._lock:
            if self._vigentes(clave) >= self._maximo:
                return False
            self._registrar(clave)
            return True

    def reintentar_en(self, clave: str) -> int:
        with self._lock:
            if self._vigentes(clave) < self._maximo:
                return 0
            espera = self._intentos[clave][0] + self._ventana - self._reloj()
            return max(1, math.ceil(espera.total_seconds()))

    def reiniciar(self, clave: str) -> None:
        with self._lock:
            self._intentos.pop(clave, None)

    def _registrar(self, clave: str) -> None:
        self._intentos.setdefault(clave, deque()).append(self._reloj())

    def _vigentes(self, clave: str) -> int:
        intentos = self._intentos.get(clave)
        if not intentos:
            return 0
        limite = self._reloj() - self._ventana
        while intentos and intentos[0] <= limite:
            intentos.popleft()
        if not intentos:
            del self._intentos[clave]
        return len(intentos)


@dataclass(frozen=True, slots=True)
class LimitadoresDeAuth:
    login_fallido: LimitadorDeIntentos
    login_por_cliente: LimitadorDeIntentos
    registro_por_cliente: LimitadorDeIntentos


def crear_limitadores(reloj: Callable[[], datetime] = ahora_utc) -> LimitadoresDeAuth:
    return LimitadoresDeAuth(
        login_fallido=LimitadorDeIntentos(LOGIN_FALLIDOS_MAXIMO, LOGIN_FALLIDOS_VENTANA, reloj),
        login_por_cliente=LimitadorDeIntentos(
            LOGIN_POR_CLIENTE_MAXIMO, LOGIN_POR_CLIENTE_VENTANA, reloj
        ),
        registro_por_cliente=LimitadorDeIntentos(
            REGISTROS_POR_CLIENTE_MAXIMO, REGISTROS_POR_CLIENTE_VENTANA, reloj
        ),
    )
