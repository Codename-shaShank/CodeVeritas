param(
    [switch]$SkipDocker
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path

function Start-ServiceWindow {
    param(
        [string]$Name,
        [string]$ServicePath
    )

    $command = 'if (-not (Test-Path node_modules)) { npm install }; npm run dev'
    Write-Host "Starting $Name in $ServicePath"

    Start-Process -FilePath powershell -WorkingDirectory $ServicePath -ArgumentList @(
        '-NoLogo',
        '-NoProfile',
        '-ExecutionPolicy',
        'Bypass',
        '-Command',
        $command
    )
}

if (-not $SkipDocker) {
    Write-Host 'Starting local infrastructure with Docker Compose...'
    Push-Location $root
    try {
        docker compose up -d
    }
    finally {
        Pop-Location
    }
}

Start-ServiceWindow -Name 'server' -ServicePath (Join-Path $root 'server')
Start-ServiceWindow -Name 'judge-worker' -ServicePath (Join-Path $root 'judge-worker')
Start-ServiceWindow -Name 'client' -ServicePath (Join-Path $root 'client')

Write-Host ''
Write-Host 'The app is starting in separate PowerShell windows.'
Write-Host 'Frontend: http://localhost:5173'
Write-Host 'Backend:  http://localhost:3000'
Write-Host 'MongoDB:  mongodb://127.0.0.1:27017'
Write-Host 'Kafka:    localhost:9092'
Write-Host 'Redis:    localhost:6379'
