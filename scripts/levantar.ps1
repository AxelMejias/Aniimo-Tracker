<#
.SYNOPSIS
Levanta la base de desarrollo, el backend y la app de escritorio con un solo comando.

.DESCRIPTION
Comprueba archivos, Docker y puertos; levanta la base `db`, migra, arranca el backend
(solo en 127.0.0.1) y luego la app. Al cerrar la app detiene el backend que arranco.
No instala nada, no lee ni imprime archivos .env y no cierra procesos ajenos.

.PARAMETER SoloVerificar
Corre solo los chequeos y termina (codigo 0 si todo esta bien, 1 si falta algo).

.EXAMPLE
powershell -ExecutionPolicy Bypass -File scripts\levantar.ps1 -SoloVerificar
#>
param(
    [switch]$SoloVerificar
)

$ErrorActionPreference = 'Stop'

$Raiz = Split-Path -Parent $PSScriptRoot
$Backend = Join-Path $Raiz 'backend'
$Frontend = Join-Path $Raiz 'frontend'
$Python = Join-Path $Backend '.venv\Scripts\python.exe'
$UrlDeSalud = 'http://127.0.0.1:8000/api/health'
$SegundosDeEspera = 30

function Fallar([string]$Mensaje) {
    Write-Host ''
    Write-Host "ERROR: $Mensaje" -ForegroundColor Red
    exit 1
}

function Informar([string]$Mensaje) {
    Write-Host $Mensaje -ForegroundColor Cyan
}

function Exigir-Archivo([string]$Ruta, [string]$Que, [string]$Comando) {
    if (-not (Test-Path -LiteralPath $Ruta)) {
        Fallar "Falta $Que. Creala con: $Comando (mas detalle en el README)."
    }
}

function Exigir-PuertoLibre([int]$Puerto, [string]$Quien) {
    $escuchando = Get-NetTCPConnection -State Listen -LocalPort $Puerto -ErrorAction SilentlyContinue |
        Select-Object -First 1
    if ($null -eq $escuchando) {
        return
    }
    $idProceso = $escuchando.OwningProcess
    $proceso = Get-Process -Id $idProceso -ErrorAction SilentlyContinue
    $nombre = if ($null -ne $proceso) { "'$($proceso.ProcessName)' (PID $idProceso)" } else { "un proceso (PID $idProceso)" }
    Fallar ("El puerto $Puerto ($Quien) esta ocupado por $nombre. No lo cierro yo: " +
        "si es seguro, cerralo con  Stop-Process -Id $idProceso  y volve a correr el script.")
}

function Detener-Arbol([int]$IdRaiz) {
    $hijos = Get-CimInstance Win32_Process -Filter "ParentProcessId = $IdRaiz" -ErrorAction SilentlyContinue
    foreach ($hijo in $hijos) {
        Detener-Arbol -IdRaiz $hijo.ProcessId
    }
    Stop-Process -Id $IdRaiz -ErrorAction SilentlyContinue
}

Informar 'Comprobando archivos...'
Exigir-Archivo (Join-Path $Raiz '.env') '.env en la raiz (la password de Postgres)' 'Copy-Item .env.example .env, y define POSTGRES_PASSWORD'
Exigir-Archivo (Join-Path $Backend '.env') 'backend\.env' 'Copy-Item backend\.env.example backend\.env'
Exigir-Archivo $Python 'el entorno virtual de Python (backend\.venv)' 'py -3.11 -m venv backend\.venv; backend\.venv\Scripts\python.exe -m pip install -r backend\requirements-dev.txt'
Exigir-Archivo (Join-Path $Frontend 'node_modules') 'frontend\node_modules' 'cd frontend; npm install'

Informar 'Comprobando Docker...'
if ($null -eq (Get-Command docker -ErrorAction SilentlyContinue)) {
    Fallar 'No encuentro el comando docker. Instala Docker Desktop y volve a correr el script.'
}
docker info 2>$null | Out-Null
if ($LASTEXITCODE -ne 0) {
    Fallar 'Docker no responde. Abri Docker Desktop, espera a que termine de arrancar y volve a correr el script.'
}

Informar 'Comprobando puertos...'
Exigir-PuertoLibre -Puerto 8000 -Quien 'backend'
Exigir-PuertoLibre -Puerto 5173 -Quien 'app de escritorio'

if ($SoloVerificar) {
    Write-Host ''
    Write-Host 'Todo listo para levantar. No se inicio nada (-SoloVerificar).' -ForegroundColor Green
    exit 0
}

Push-Location $Raiz
try {
    Informar 'Levantando la base de datos (docker compose up -d db)...'
    docker compose up -d db
    if ($LASTEXITCODE -ne 0) {
        Fallar 'No se pudo levantar la base con docker compose up -d db.'
    }

    $lista = $false
    for ($segundo = 0; $segundo -lt $SegundosDeEspera; $segundo++) {
        docker compose exec -T db pg_isready 2>$null | Out-Null
        if ($LASTEXITCODE -eq 0) {
            $lista = $true
            break
        }
        Start-Sleep -Seconds 1
    }
    if (-not $lista) {
        Fallar "La base no estuvo lista despues de $SegundosDeEspera segundos. Revisa: docker compose logs db"
    }
}
finally {
    Pop-Location
}

Informar 'Aplicando migraciones (alembic upgrade head)...'
Push-Location $Backend
try {
    & $Python -m alembic upgrade head
    if ($LASTEXITCODE -ne 0) {
        Fallar 'Fallo alembic upgrade head. Revisa DATABASE_URL en backend\.env.'
    }
}
finally {
    Pop-Location
}

$procesoDelBackend = $null
try {
    Informar 'Arrancando el backend en 127.0.0.1:8000...'
    $procesoDelBackend = Start-Process -FilePath $Python -ArgumentList '-m', 'app' `
        -WorkingDirectory $Backend -NoNewWindow -PassThru

    $respondio = $false
    for ($segundo = 0; $segundo -lt $SegundosDeEspera; $segundo++) {
        if ($procesoDelBackend.HasExited) {
            Fallar 'El backend se cerro al arrancar (el motivo esta arriba en esta consola).'
        }
        try {
            $respuesta = Invoke-WebRequest -Uri $UrlDeSalud -UseBasicParsing -TimeoutSec 2
            if ($respuesta.StatusCode -eq 200) {
                $respondio = $true
                break
            }
        }
        catch {
            $respondio = $false
        }
        Start-Sleep -Seconds 1
    }
    if (-not $respondio) {
        Detener-Arbol -IdRaiz $procesoDelBackend.Id
        Fallar "El backend no respondio en $UrlDeSalud despues de $SegundosDeEspera segundos."
    }

    Informar 'Backend listo. Abriendo la app (cerrala o presiona Ctrl+C para terminar)...'
    Push-Location $Frontend
    try {
        npm run dev
    }
    finally {
        Pop-Location
    }
}
finally {
    if ($null -ne $procesoDelBackend -and -not $procesoDelBackend.HasExited) {
        Informar 'Deteniendo el backend...'
        Detener-Arbol -IdRaiz $procesoDelBackend.Id
    }
}
