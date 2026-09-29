# Inicia o portal Professor/Aluno (acesso por QR, sem login).
# Uso: powershell -ExecutionPolicy Bypass -File .\iniciar-portal.ps1 [-Porta 8000]
param([int]$Porta = 8000)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$portal = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location -LiteralPath $portal

if (-not (Test-Path -LiteralPath (Join-Path $portal "app.py"))) {
    throw "app.py não encontrado em $portal"
}

$env:PORTAL_PORT = "$Porta"
python -c "import fastapi, uvicorn" 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "Instalando dependências..."
    pip install -r requirements.txt
}

# IP da LAN para montar a URL do QR/celular
$ip = (Get-NetIPAddress -AddressFamily IPv4 |
    Where-Object { $_.IPAddress -match '^(192\.168|10\.|172\.(1[6-9]|2\d|3[01]))' -and $_.PrefixOrigin -ne 'WellKnown' } |
    Select-Object -First 1 -ExpandProperty IPAddress)
if (-not $ip) { $ip = "localhost" }

Write-Host ""
Write-Host "  Portal no ar (sem login: o QR de cada perfil é a credencial)!"
Write-Host "  Celular (mesmo Wi-Fi): http://${ip}:$Porta/acesso"
Write-Host "  Os links secretos + QR do professor aparecem abaixo."
Write-Host "  QR do aluno também em qr-aluno.png (pode projetar/imprimir)."
Write-Host "  Ctrl+C para encerrar."
Write-Host ""
python -m uvicorn app:app --host 0.0.0.0 --port $Porta
