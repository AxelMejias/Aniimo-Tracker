class ErrorDeDominio(Exception):
    """Base de todos los errores que el dominio y la capa de datos exponen hacia arriba."""


class ErrorDeValidacion(ErrorDeDominio):
    """Una invariante de la entidad no se cumple; se detecta sin consultar la base."""


class ValorInvalido(ErrorDeValidacion):
    def __init__(self, campo: str) -> None:
        super().__init__(f"Valor inválido en el campo '{campo}'")
        self.campo = campo


class SlotInvalido(ErrorDeValidacion):
    def __init__(self) -> None:
        super().__init__("El slot debe estar entre 1 y 4")


class LimiteDeTeamsAlcanzado(ErrorDeValidacion):
    def __init__(self) -> None:
        super().__init__("El orden del team debe estar entre 1 y 4")


class PotencialFueraDeRango(ErrorDeValidacion):
    def __init__(self) -> None:
        super().__init__("El potencial debe estar entre 0 y 20")


class PersonalidadInvalida(ErrorDeValidacion):
    def __init__(self) -> None:
        super().__init__("La personalidad debe ser una de las 16 combinaciones válidas")


class DespertaresInconsistentes(ErrorDeValidacion):
    def __init__(self) -> None:
        super().__init__("Los despertares usados no pueden superar el total de despertares")


class ErrorDeIntegridad(ErrorDeDominio):
    """Una restricción de la base rechazó la operación."""

    def __init__(self, mensaje: str = "La operación viola una restricción de integridad") -> None:
        super().__init__(mensaje)


class NombreUsuarioDuplicado(ErrorDeIntegridad):
    def __init__(self) -> None:
        super().__init__("El nombre de usuario ya está en uso")


class PosicionDeTeamOcupada(ErrorDeIntegridad):
    def __init__(self) -> None:
        super().__init__("La posición del team ya está ocupada")


class SlotOcupado(ErrorDeIntegridad):
    def __init__(self) -> None:
        super().__init__("El slot ya está ocupado")


class EntidadNoEncontrada(ErrorDeDominio):
    def __init__(self) -> None:
        super().__init__("La entidad no existe")
