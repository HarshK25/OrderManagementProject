# ─────────────────────────────────────────────────────────────────
# run-local.ps1  –  Load .env and start the Spring Boot backend
# Usage: cd backend; .\run-local.ps1
# ─────────────────────────────────────────────────────────────────

$envFile = "$PSScriptRoot\..\env"

if (-Not (Test-Path $envFile)) {
    # Try .env (with dot)
    $envFile = "$PSScriptRoot\..\.env"
}

if (Test-Path $envFile) {
    Write-Host "Loading environment from $envFile ..." -ForegroundColor Cyan
    Get-Content $envFile | Where-Object { $_ -notmatch '^\s*#' -and $_ -match '=' } | ForEach-Object {
        $parts = $_ -split '=', 2
        $key   = $parts[0].Trim()
        $value = $parts[1].Trim()
        [System.Environment]::SetEnvironmentVariable($key, $value, 'Process')
        Write-Host "  SET $key" -ForegroundColor DarkGray
    }
    Write-Host "Environment loaded. Starting Spring Boot...`n" -ForegroundColor Green
} else {
    Write-Host "WARNING: .env file not found. Using defaults / system env vars." -ForegroundColor Yellow
}

.\mvnw.cmd spring-boot:run

