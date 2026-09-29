param(
    [int]$Port = 8080,
    [switch]$Mock,
    [switch]$NoBrowser
)

# Serves the project over http://localhost so YouTube embeds receive a
# Referer header. Opened as file://, some videos (e.g. the MagLev-Cobra
# channel) refuse to play inside the page and only offer "Watch on YouTube".

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$projectRoot = (Resolve-Path (Split-Path -Parent $PSScriptRoot)).Path
$types = @{
    ".html" = "text/html; charset=utf-8"; ".js" = "text/javascript; charset=utf-8"
    ".css" = "text/css; charset=utf-8"; ".json" = "application/json; charset=utf-8"
    ".svg" = "image/svg+xml"; ".png" = "image/png"; ".jpg" = "image/jpeg"; ".jpeg" = "image/jpeg"
    ".gif" = "image/gif"; ".webp" = "image/webp"; ".mp4" = "video/mp4"; ".txt" = "text/plain; charset=utf-8"
}

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Port/")
try {
    $listener.Start()
}
catch {
    throw "Não foi possível abrir a porta $Port. Tente: .\scripts\preview.ps1 -Port 8090"
}

$url = "http://localhost:$Port/dev/preview.html"
if ($Mock) { $url += "?mock=1" }
Write-Host "Prévia em $url"
Write-Host "Pressione Ctrl+C para encerrar."
if (-not $NoBrowser) { Start-Process $url }

try {
    while ($listener.IsListening) {
        $context = $listener.GetContext()
        $response = $context.Response
        try {
            $relative = [Uri]::UnescapeDataString($context.Request.Url.AbsolutePath).TrimStart("/")
            if ($relative -eq "") { $relative = "dev/preview.html" }
            $path = [System.IO.Path]::GetFullPath((Join-Path $projectRoot $relative))
            # Never serve anything outside the project folder.
            if (-not $path.StartsWith($projectRoot, [StringComparison]::OrdinalIgnoreCase) -or -not (Test-Path -LiteralPath $path -PathType Leaf)) {
                $response.StatusCode = 404
            }
            else {
                $extension = [System.IO.Path]::GetExtension($path).ToLowerInvariant()
                $response.ContentType = if ($types.ContainsKey($extension)) { $types[$extension] } else { "application/octet-stream" }
                $response.Headers["Cache-Control"] = "no-store"
                $bytes = [System.IO.File]::ReadAllBytes($path)
                $response.ContentLength64 = $bytes.Length
                $response.OutputStream.Write($bytes, 0, $bytes.Length)
            }
        }
        catch {
            $response.StatusCode = 500
        }
        finally {
            $response.Close()
        }
    }
}
finally {
    $listener.Stop()
    $listener.Close()
}
