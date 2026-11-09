<#
.SYNOPSIS
Genera el instalador de Windows de Aniimo Team Tracker.

.DESCRIPTION
Empaqueta el backend con PyInstaller (backend\dist\aniimo-backend\), compila la app con
`npm run build` y genera el instalador NSIS con electron-builder en frontend\release\.
No instala nada, no corre los tests, no lee ni imprime archivos .env.

.EXAMPLE
powershell -ExecutionPolicy Bypass -File scripts\empaquetar.ps1
#>
$ErrorActionPreference = 'Stop'

$Raiz = Split-Path -Parent $PSScriptRoot
$Backend = Join-Path $Raiz 'backend'
$Frontend = Join-Path $Raiz 'frontend'
$Python = Join-Path $Backend '.venv\Scripts\python.exe'

function Fallar([string]$Mensaje) {
    Write-Host ''
    Write-Host "ERROR: $Mensaje" -ForegroundColor Red
    exit 1
}

function Informar([string]$Mensaje) {
    Write-Host $Mensaje -ForegroundColor Cyan
}

if (-not (Test-Path -LiteralPath $Python)) {
    Fallar 'Falta backend\.venv. Creala con: python -m venv backend\.venv y despues instala las dependencias de build con: backend\.venv\Scripts\python.exe -m pip install -r backend\requirements-build.txt'
}
if (-not (Test-Path -LiteralPath (Join-Path $Frontend 'node_modules'))) {
    Fallar 'Falta frontend\node_modules. Instalalo con: npm ci (dentro de frontend).'
}

& $Python -m PyInstaller --version *> $null
if ($LASTEXITCODE -ne 0) {
    Fallar 'Falta PyInstaller en backend\.venv. Instalalo con: backend\.venv\Scripts\python.exe -m pip install -r backend\requirements-build.txt'
}

Informar 'Empaquetando el backend con PyInstaller...'
Push-Location $Backend
try {
    & $Python -m PyInstaller aniimo-backend.spec --noconfirm --clean
    if ($LASTEXITCODE -ne 0) {
        Fallar 'PyInstaller fallo. Revisa los mensajes de arriba.'
    }
} finally {
    Pop-Location
}

Push-Location $Frontend
try {
    Informar 'Compilando la app de escritorio...'
    npm run build
    if ($LASTEXITCODE -ne 0) {
        Fallar 'npm run build fallo. Revisa los mensajes de arriba.'
    }

    Informar 'Generando el instalador con electron-builder...'
    npx electron-builder --win nsis --config electron-builder.json
    if ($LASTEXITCODE -ne 0) {
        Fallar 'electron-builder fallo. Revisa los mensajes de arriba.'
    }
} finally {
    Pop-Location
}

Informar "Listo. El instalador esta en: $(Join-Path $Frontend 'release')"
