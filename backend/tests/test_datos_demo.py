import logging
from datetime import timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.orm import Session, sessionmaker

from app.application.amigos import ServicioDeAmigos
from app.application.auth import ServicioDeAuth
from app.application.grupos import ServicioDeGrupos
from app.application.teams import ServicioDeTeams
from app.application.unit_of_work import UnitOfWork
from app.datos_demo import (
    CUENTAS_DE_DEMO,
    ConfiguracionDeDemo,
    ErrorDeDemo,
    borrar_datos_demo,
    crear_datos_demo,
    main,
    motivo_para_rechazar_base,
    preparar_datos_demo,
)
from app.infrastructure.modelos import ImagenAniimoModelo, UsuarioModelo
from tests.fabricas import RelojFalso, hasher_barato, persistir_usuario, token_de

CONTRASENA_DE_DEMO = "contrasena-de-demo-1"
URL_DE_DESARROLLO = "postgresql+psycopg://aniimo:secreta-dev@127.0.0.1:5434/aniimo"
URL_DE_TEST = "postgresql+psycopg://aniimo:secreta-test@127.0.0.1:5433/aniimo"


@pytest.mark.parametrize(
    "url",
    [
        "postgresql+psycopg://aniimo:x@127.0.0.1:5434/aniimo",
        "postgresql+psycopg://aniimo:x@localhost:5434/aniimo",
    ],
)
@pytest.mark.parametrize("url_de_test", [None, URL_DE_TEST])
def test_acepta_la_base_de_desarrollo_en_loopback_y_puerto_5434(
    url: str, url_de_test: str | None
) -> None:
    assert motivo_para_rechazar_base(url, url_de_test) is None


@pytest.mark.parametrize(
    ("url", "fragmento"),
    [
        ("postgresql+psycopg://aniimo:x@127.0.0.1:5433/aniimo", "5434"),
        ("postgresql+psycopg://aniimo:x@127.0.0.1/aniimo", "5434"),
        ("postgresql+psycopg://aniimo:x@db.ejemplo.com:5434/aniimo", "loopback"),
        ("postgresql+psycopg://aniimo:x@192.168.1.20:5434/aniimo", "loopback"),
        ("esto no es una url", "inválida"),
    ],
)
def test_rechaza_cualquier_otra_base_con_su_motivo(url: str, fragmento: str) -> None:
    motivo = motivo_para_rechazar_base(url, None)
    assert motivo is not None
    assert fragmento in motivo


def test_rechaza_la_url_igual_a_la_de_test_aunque_este_en_el_puerto_de_desarrollo() -> None:
    url = "postgresql+psycopg://aniimo:x@127.0.0.1:5434/aniimo"
    motivo = motivo_para_rechazar_base(url, url)
    assert motivo is not None
    assert "TEST_DATABASE_URL" in motivo


def test_el_motivo_nunca_incluye_la_contrasena_de_la_base() -> None:
    motivos = [
        motivo_para_rechazar_base("postgresql+psycopg://aniimo:secreta-dev@127.0.0.1:5433/a", None),
        motivo_para_rechazar_base(
            "postgresql+psycopg://aniimo:secreta-dev@remoto.com:5434/a", None
        ),
        motivo_para_rechazar_base(URL_DE_DESARROLLO, URL_DE_DESARROLLO),
    ]
    for motivo in motivos:
        assert motivo is not None
        assert "secreta-dev" not in motivo


def _configuracion(contrasena: str | None, url: str = URL_DE_DESARROLLO) -> ConfiguracionDeDemo:
    valores: dict[str, str] = {"DATABASE_URL": url}
    if contrasena is not None:
        valores["DATOS_DEMO_CONTRASENA"] = contrasena
    return ConfiguracionDeDemo(_env_file=None, **valores)  # type: ignore[arg-type]


def test_la_contrasena_valida_se_devuelve() -> None:
    assert _configuracion(CONTRASENA_DE_DEMO).contrasena() == CONTRASENA_DE_DEMO


@pytest.mark.parametrize("contrasena", [None, "", "corta-1234"])
def test_sin_contrasena_o_con_menos_de_12_caracteres_falla_sin_mostrarla(
    contrasena: str | None,
) -> None:
    with pytest.raises(ErrorDeDemo) as error:
        _configuracion(contrasena).contrasena()
    assert "DATOS_DEMO_CONTRASENA" in str(error.value)
    if contrasena:
        assert contrasena not in str(error.value)


def test_la_representacion_de_la_configuracion_no_muestra_la_contrasena() -> None:
    assert CONTRASENA_DE_DEMO not in repr(_configuracion(CONTRASENA_DE_DEMO))


class Servicios:
    def __init__(self, session_factory: sessionmaker[Session]) -> None:
        reloj = RelojFalso()
        self.session_factory = session_factory
        self.auth = ServicioDeAuth(
            session_factory, hasher_barato(), timedelta(minutes=30), timedelta(hours=12), reloj
        )
        self.teams = ServicioDeTeams(session_factory)
        self.grupos = ServicioDeGrupos(session_factory)
        self.amigos = ServicioDeAmigos(session_factory, reloj)


@pytest.fixture
def servicios(session_factory: sessionmaker[Session]) -> Servicios:
    return Servicios(session_factory)


def _crear(servicios: Servicios) -> None:
    crear_datos_demo(
        servicios.auth, servicios.teams, servicios.grupos, servicios.amigos, CONTRASENA_DE_DEMO
    )


def _usuario_id(session_factory: sessionmaker[Session], nombre: str):  # noqa: ANN202
    with UnitOfWork(session_factory) as uow:
        usuario = uow.usuarios.obtener_por_nombre_usuario(nombre)
    assert usuario is not None
    return usuario.id


def _nombres_de_teams(servicios: Servicios, nombre: str) -> dict[str, int]:
    resumenes = servicios.teams.listar(_usuario_id(servicios.session_factory, nombre))
    return {r.team.nombre: sum(1 for s in r.slots if s.aniimo is not None) for r in resumenes}


ANA_ESPERADA = {
    "Principal": 3,
    "Jefes": 2,
    "Torre": 4,
    "Raid": 3,
    "PvP": 4,
    "Pruebas": 1,
    "Subiendo": 2,
    "Hielo": 1,
    "Casa": 4,
    "Jardín": 2,
    "Farmeo": 0,
    "Eventos": 1,
}
BETO_ESPERADO = {"Ranked": 2, "Torneo": 1, "Entrenamiento": 3, "Paseo": 1}
CARO_ESPERADO = {"Demo Caro": 1}


def test_crea_las_tres_cuentas_con_sus_teams_y_aniimos(servicios: Servicios) -> None:
    resumen = crear_datos_demo(
        servicios.auth, servicios.teams, servicios.grupos, servicios.amigos, CONTRASENA_DE_DEMO
    )
    assert resumen.cuentas == CUENTAS_DE_DEMO
    assert _nombres_de_teams(servicios, "demo_ana") == ANA_ESPERADA
    assert _nombres_de_teams(servicios, "demo_beto") == BETO_ESPERADO
    assert _nombres_de_teams(servicios, "demo_caro") == CARO_ESPERADO
    assert (resumen.teams, resumen.aniimos) == (17, 35)


def test_ana_tiene_solo_jefes_oculto_y_un_aniimo_con_notas_privadas(servicios: Servicios) -> None:
    _crear(servicios)
    ana = _usuario_id(servicios.session_factory, "demo_ana")
    por_nombre = {r.team.nombre: r for r in servicios.teams.listar(ana)}
    ocultos = [n for n, r in por_nombre.items() if r.team.oculto_para_amigos]
    assert ocultos == ["Jefes"]
    aniimos = [s.aniimo for r in por_nombre.values() for s in r.slots if s.aniimo is not None]
    con_privadas = [a for a in aniimos if a.notas_privadas]
    assert len(con_privadas) == 1
    assert con_privadas[0].notas


def test_ana_tiene_tres_grupos_con_sus_tamanos_y_portadas(servicios: Servicios) -> None:
    _crear(servicios)
    lista = servicios.teams.listar_con_grupos(_usuario_id(servicios.session_factory, "demo_ana"))
    nombre_de = {r.team.id: r.team.nombre for r in lista.teams}
    vistos = [
        (
            g.grupo.nombre,
            g.grupo.orden,
            [nombre_de[t] for t in g.team_ids],
            nombre_de[g.portada_efectiva_team_id] if g.portada_efectiva_team_id else None,
        )
        for g in lista.grupos
    ]
    assert vistos == [
        ("Buildeado", 1, ["Principal", "Jefes", "Torre", "Raid", "PvP"], "Principal"),
        ("En proceso", 2, ["Pruebas", "Subiendo", "Hielo"], "Pruebas"),
        ("Homeland", 3, ["Casa", "Jardín"], "Casa"),
    ]
    elegidas = {g.grupo.nombre: g.grupo.portada_team_id for g in lista.grupos}
    assert all(elegidas.values())
    sueltos = [r.team.nombre for r in lista.teams if r.team.grupo_id is None]
    assert sueltos == ["Farmeo", "Eventos"]


def test_ana_tiene_un_team_vacio_y_una_portada_de_aniimo_que_no_es_el_slot_1(
    servicios: Servicios,
) -> None:
    _crear(servicios)
    lista = servicios.teams.listar_con_grupos(_usuario_id(servicios.session_factory, "demo_ana"))
    por_nombre = {r.team.nombre: r for r in lista.teams}
    assert all(s.aniimo is None for s in por_nombre["Farmeo"].slots)
    assert por_nombre["Farmeo"].portada_efectiva_slot is None
    assert por_nombre["Principal"].portada_efectiva_slot == 1
    assert por_nombre["Torre"].team.portada_slot == 3
    assert por_nombre["Torre"].portada_efectiva_slot == 3


def test_beto_tiene_el_grupo_competitivo_y_un_team_suelto(servicios: Servicios) -> None:
    _crear(servicios)
    lista = servicios.teams.listar_con_grupos(_usuario_id(servicios.session_factory, "demo_beto"))
    [grupo] = lista.grupos
    nombre_de = {r.team.id: r.team.nombre for r in lista.teams}
    assert grupo.grupo.nombre == "Competitivo"
    assert [nombre_de[t] for t in grupo.team_ids] == ["Ranked", "Torneo", "Entrenamiento"]
    assert [r.team.nombre for r in lista.teams if r.team.grupo_id is None] == ["Paseo"]


def test_beto_ve_buildeado_con_cuatro_teams_y_sin_jefes(servicios: Servicios) -> None:
    _crear(servicios)
    ana = _usuario_id(servicios.session_factory, "demo_ana")
    beto = _usuario_id(servicios.session_factory, "demo_beto")
    _, lista = servicios.amigos.teams_de_amigo(beto, ana)
    nombre_de = {r.team.id: r.team.nombre for r in lista.teams}
    visto = {g.grupo.nombre: [nombre_de[t] for t in g.team_ids] for g in lista.grupos}
    assert visto["Buildeado"] == ["Principal", "Torre", "Raid", "PvP"]
    assert "Jefes" not in nombre_de.values()
    assert len(lista.teams) == 11


def test_ana_y_beto_son_amigos_y_caro_tiene_una_solicitud_pendiente_a_ana(
    servicios: Servicios,
) -> None:
    _crear(servicios)
    ana = _usuario_id(servicios.session_factory, "demo_ana")
    lista = servicios.amigos.listar(ana)
    assert [a.usuario.nombre_usuario for a in lista.amigos] == ["demo_beto"]
    assert [s.usuario.nombre_usuario for s in lista.recibidas] == ["demo_caro"]
    assert not lista.enviadas


def test_beto_no_ve_el_team_oculto_ni_las_notas_privadas(
    servicios: Servicios, cliente_api: TestClient
) -> None:
    _crear(servicios)
    ana = _usuario_id(servicios.session_factory, "demo_ana")
    cabeceras = {
        "Authorization": f"Bearer {token_de(cliente_api, 'demo_beto', CONTRASENA_DE_DEMO)}"
    }
    respuesta = cliente_api.get(f"/api/amigos/{ana}/teams", headers=cabeceras)
    assert respuesta.status_code == 200
    teams = respuesta.json()["teams"]
    assert "Jefes" not in [t["nombre"] for t in teams]
    assert len(teams) == 11
    visible = next(t for t in teams if t["nombre"] == "Principal")
    principal = next(r for r in servicios.teams.listar(ana) if r.team.nombre == "Principal")
    privado = next(
        s.aniimo for s in principal.slots if s.aniimo is not None and s.aniimo.notas_privadas
    )
    assert privado.notas
    ficha = cliente_api.get(
        f"/api/amigos/{ana}/teams/{visible['id']}/aniimo/{privado.slot}", headers=cabeceras
    ).json()["aniimo"]
    assert ficha["notas"] is None
    assert ficha["notas_habilidades"] is None
    otros = [
        s.slot for s in principal.slots if s.aniimo is not None and not s.aniimo.notas_privadas
    ]
    for slot in otros:
        otro = cliente_api.get(
            f"/api/amigos/{ana}/teams/{visible['id']}/aniimo/{slot}", headers=cabeceras
        ).json()["aniimo"]
        assert otro["nombre"]


def test_los_aniimos_de_demo_no_tienen_imagenes(
    servicios: Servicios, session_factory: sessionmaker[Session]
) -> None:
    _crear(servicios)
    with session_factory() as sesion:
        assert sesion.scalar(select(func.count()).select_from(ImagenAniimoModelo)) == 0


def test_la_contrasena_se_guarda_hasheada(
    servicios: Servicios, session_factory: sessionmaker[Session]
) -> None:
    _crear(servicios)
    with session_factory() as sesion:
        hashes = sesion.scalars(select(UsuarioModelo.password_hash)).all()
    assert hashes
    assert all(CONTRASENA_DE_DEMO not in h for h in hashes)


def test_la_segunda_corrida_no_cambia_nada_e_informa(servicios: Servicios) -> None:
    primera = preparar_datos_demo(
        servicios.auth,
        servicios.teams,
        servicios.grupos,
        servicios.amigos,
        servicios.session_factory,
        CONTRASENA_DE_DEMO,
        reiniciar=False,
    )
    ids_antes = {n: _usuario_id(servicios.session_factory, n) for n in CUENTAS_DE_DEMO}
    segunda = preparar_datos_demo(
        servicios.auth,
        servicios.teams,
        servicios.grupos,
        servicios.amigos,
        servicios.session_factory,
        CONTRASENA_DE_DEMO,
        reiniciar=False,
    )
    assert primera.ya_existian is False
    assert segunda.ya_existian is True
    assert "--reiniciar" in segunda.texto()
    assert {n: _usuario_id(servicios.session_factory, n) for n in CUENTAS_DE_DEMO} == ids_antes
    assert _nombres_de_teams(servicios, "demo_ana") == ANA_ESPERADA


def test_si_existe_una_sola_cuenta_del_set_tampoco_toca_nada(servicios: Servicios) -> None:
    servicios.auth.registrar("demo_beto", CONTRASENA_DE_DEMO)
    resumen = preparar_datos_demo(
        servicios.auth,
        servicios.teams,
        servicios.grupos,
        servicios.amigos,
        servicios.session_factory,
        CONTRASENA_DE_DEMO,
        reiniciar=False,
    )
    assert resumen.ya_existian is True
    with UnitOfWork(servicios.session_factory) as uow:
        assert uow.usuarios.obtener_por_nombre_usuario("demo_ana") is None


def test_reiniciar_recrea_las_tres_cuentas_y_no_toca_cuentas_ajenas(servicios: Servicios) -> None:
    ajena = persistir_usuario(servicios.session_factory, "otra_cuenta")
    _crear(servicios)
    ids_antes = {n: _usuario_id(servicios.session_factory, n) for n in CUENTAS_DE_DEMO}
    resumen = preparar_datos_demo(
        servicios.auth,
        servicios.teams,
        servicios.grupos,
        servicios.amigos,
        servicios.session_factory,
        CONTRASENA_DE_DEMO,
        reiniciar=True,
    )
    assert resumen.ya_existian is False
    assert resumen.borradas == CUENTAS_DE_DEMO
    ids_despues = {n: _usuario_id(servicios.session_factory, n) for n in CUENTAS_DE_DEMO}
    assert all(ids_despues[n] != ids_antes[n] for n in CUENTAS_DE_DEMO)
    assert _nombres_de_teams(servicios, "demo_ana") == ANA_ESPERADA
    assert _nombres_de_teams(servicios, "demo_beto") == BETO_ESPERADO
    assert _nombres_de_teams(servicios, "demo_caro") == CARO_ESPERADO
    assert _usuario_id(servicios.session_factory, "otra_cuenta") == ajena.id


def test_borrar_solo_elimina_las_cuentas_exactas_del_set(servicios: Servicios) -> None:
    servicios.auth.registrar("demo_ana", CONTRASENA_DE_DEMO)
    servicios.auth.registrar("demo_ana2", CONTRASENA_DE_DEMO)
    servicios.auth.registrar("demo_otro", CONTRASENA_DE_DEMO)
    assert borrar_datos_demo(servicios.session_factory) == ("demo_ana",)
    with UnitOfWork(servicios.session_factory) as uow:
        assert uow.usuarios.obtener_por_nombre_usuario("demo_ana") is None
        assert uow.usuarios.obtener_por_nombre_usuario("demo_ana2") is not None
        assert uow.usuarios.obtener_por_nombre_usuario("demo_otro") is not None


def _cuenta_de_demo_existe(session_factory: sessionmaker[Session]) -> bool:
    with UnitOfWork(session_factory) as uow:
        return any(uow.usuarios.obtener_por_nombre_usuario(n) for n in CUENTAS_DE_DEMO)


@pytest.mark.parametrize("url", [URL_DE_TEST, URL_DE_DESARROLLO])
def test_main_con_la_url_de_test_sale_con_1_y_no_escribe(
    servicios: Servicios,
    capsys: pytest.CaptureFixture[str],
    caplog: pytest.LogCaptureFixture,
    url: str,
) -> None:
    with caplog.at_level(logging.DEBUG):
        codigo = main(
            [],
            configuracion=_configuracion(CONTRASENA_DE_DEMO, url),
            test_database_url=url,
            session_factory=servicios.session_factory,
            hasher=hasher_barato(),
        )
    salida = capsys.readouterr()
    assert codigo == 1
    assert salida.err.startswith("No se tocó nada.")
    assert not _cuenta_de_demo_existe(servicios.session_factory)
    for texto in (salida.out, salida.err, caplog.text):
        assert CONTRASENA_DE_DEMO not in texto
        assert "secreta-test" not in texto
        assert "secreta-dev" not in texto


def test_main_sin_contrasena_valida_sale_con_1_y_no_escribe(
    servicios: Servicios, capsys: pytest.CaptureFixture[str]
) -> None:
    codigo = main(
        [],
        configuracion=_configuracion("corta-1234"),
        test_database_url=URL_DE_TEST,
        session_factory=servicios.session_factory,
        hasher=hasher_barato(),
    )
    salida = capsys.readouterr()
    assert codigo == 1
    assert "DATOS_DEMO_CONTRASENA" in salida.err
    assert "corta-1234" not in salida.out + salida.err
    assert not _cuenta_de_demo_existe(servicios.session_factory)


def test_main_crea_los_datos_y_nunca_imprime_ni_loguea_la_contrasena(
    servicios: Servicios, capsys: pytest.CaptureFixture[str], caplog: pytest.LogCaptureFixture
) -> None:
    with caplog.at_level(logging.DEBUG):
        codigo = main(
            [],
            configuracion=_configuracion(CONTRASENA_DE_DEMO),
            test_database_url=URL_DE_TEST,
            session_factory=servicios.session_factory,
            hasher=hasher_barato(),
        )
    salida = capsys.readouterr()
    assert codigo == 0
    assert _cuenta_de_demo_existe(servicios.session_factory)
    for nombre in CUENTAS_DE_DEMO:
        assert nombre in salida.out
    for texto in (salida.out, salida.err, caplog.text):
        assert CONTRASENA_DE_DEMO not in texto
        assert "secreta-dev" not in texto


def test_main_reiniciar_informa_lo_borrado_y_recrea(
    servicios: Servicios, capsys: pytest.CaptureFixture[str]
) -> None:
    _crear(servicios)
    codigo = main(
        ["--reiniciar"],
        configuracion=_configuracion(CONTRASENA_DE_DEMO),
        test_database_url=URL_DE_TEST,
        session_factory=servicios.session_factory,
        hasher=hasher_barato(),
    )
    salida = capsys.readouterr().out
    assert codigo == 0
    assert "Borradas" in salida
    assert _nombres_de_teams(servicios, "demo_ana") == ANA_ESPERADA
