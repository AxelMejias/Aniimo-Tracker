from enum import StrEnum


class Elemento(StrEnum):
    FUEGO = "fuego"
    AGUA = "agua"
    PLANTA = "planta"
    ELECTRICO = "electrico"
    HIELO = "hielo"
    ROCA = "roca"
    VIENTO = "viento"
    SAGRADO = "sagrado"
    OSCURO = "oscuro"


class Rol(StrEnum):
    DPS = "dps"
    SOPORTE = "soporte"
    SANADOR = "sanador"
    TANQUE = "tanque"


class PotencialInnato(StrEnum):
    COMUN = "comun"
    BUENO = "bueno"
    ELITE = "elite"
    PERFECTO = "perfecto"


class Rareza(StrEnum):
    RARA = "rara"
    EPICA = "epica"
    LEGENDARIA = "legendaria"


class PosicionObjeto(StrEnum):
    EQUIPADO = "equipado"
    ALTERNATIVO = "alternativo"


class Stat(StrEnum):
    PS = "ps"
    ATQ = "atq"
    DEF_FISICA = "def_fisica"
    DEF_MAGICA = "def_magica"
    REGEN = "regen"
    QUIEBRE = "quiebre"
