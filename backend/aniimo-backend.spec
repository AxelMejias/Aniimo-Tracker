from PyInstaller.utils.hooks import collect_submodules

analisis = Analysis(
    ["app/__main__.py"],
    pathex=["."],
    datas=[
        ("alembic.ini", "."),
        ("alembic", "alembic"),
        ("datos", "datos"),
    ],
    hiddenimports=(
        collect_submodules("uvicorn")
        + collect_submodules("alembic")
        + collect_submodules("psycopg")
        + collect_submodules("app")
    ),
    excludes=["tests", "pytest"],
)
pyz = PYZ(analisis.pure)
exe = EXE(
    pyz,
    analisis.scripts,
    [],
    exclude_binaries=True,
    name="aniimo-backend",
    console=True,
)
COLLECT(exe, analisis.binaries, analisis.datas, name="aniimo-backend")
