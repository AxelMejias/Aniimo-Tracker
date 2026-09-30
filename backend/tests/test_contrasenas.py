from app.infrastructure.contrasenas import HasherArgon2

CLAVE = "una-clave-larga"


def _barato() -> HasherArgon2:
    return HasherArgon2(time_cost=1, memory_cost=8, parallelism=1)


def test_el_hash_es_argon2id_y_no_contiene_la_contrasena() -> None:
    hash_ = _barato().hashear(CLAVE)
    assert hash_.startswith("$argon2id$")
    assert CLAVE not in hash_


def test_dos_hashes_de_la_misma_contrasena_difieren_y_ambos_verifican() -> None:
    hasher = _barato()
    uno, dos = hasher.hashear(CLAVE), hasher.hashear(CLAVE)
    assert uno != dos
    assert hasher.verificar(CLAVE, uno)
    assert hasher.verificar(CLAVE, dos)


def test_contrasena_incorrecta_devuelve_false() -> None:
    hasher = _barato()
    assert not hasher.verificar("otra-clave-larga", hasher.hashear(CLAVE))


def test_hash_corrupto_devuelve_false_sin_excepcion() -> None:
    hasher = _barato()
    assert hasher.verificar(CLAVE, "esto-no-es-un-hash") is False
    assert hasher.verificar(CLAVE, "") is False
    assert hasher.verificar(CLAVE, "$argon2id$v=19$m=8,t=1,p=1$corrupto$corrupto") is False


def test_el_hasher_por_defecto_usa_los_parametros_de_produccion() -> None:
    hash_ = HasherArgon2().hashear(CLAVE)
    assert "$m=65536,t=3,p=4$" in hash_


def test_necesita_rehash_con_parametros_mas_bajos() -> None:
    viejo = _barato().hashear(CLAVE)
    assert HasherArgon2().necesita_rehash(viejo)


def test_no_necesita_rehash_con_los_parametros_vigentes() -> None:
    hasher = _barato()
    assert not hasher.necesita_rehash(hasher.hashear(CLAVE))


def test_necesita_rehash_con_hash_invalido_es_true() -> None:
    assert _barato().necesita_rehash("esto-no-es-un-hash")
