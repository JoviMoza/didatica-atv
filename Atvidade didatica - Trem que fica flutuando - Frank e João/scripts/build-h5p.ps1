param(
    [string]$Output = "dist/magnetismo-transporte.h5p"
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$projectRoot = Split-Path -Parent $PSScriptRoot
$source = Join-Path $projectRoot "h5p-src"

if (-not [System.IO.Path]::IsPathRooted($Output)) {
    $Output = Join-Path $projectRoot $Output
}
$outputDirectory = Split-Path -Parent $Output
New-Item -ItemType Directory -Force -Path $outputDirectory | Out-Null

# The sealed answer key is always regenerated from authoring/, so the
# package never ships a bank that is out of date with the plain-text source.
& (Join-Path $PSScriptRoot "gerar-banco.ps1")

# The "Aparência" themes (css/themes/*.css) are regenerated from designs/,
# so a change to a designs/<n>-<id>/tema.css always reaches the package.
& (Join-Path $PSScriptRoot "gerar-temas.ps1")

# Required files: metadata plus every JS/CSS declared in library.json.
# NOTE: the source tree keeps the library folder unversioned
# (H5P.MagnetismoTransporte), but inside the .h5p the H5P spec requires
# the versioned name (H5P.MagnetismoTransporte-2.2). Lumi rejects the
# package with library-file-missing when the folder is unversioned.
$libSrcDir = "H5P.MagnetismoTransporte"
$libraryJson = Get-Content -LiteralPath (Join-Path $source "$libSrcDir/library.json") -Raw -Encoding UTF8 | ConvertFrom-Json
$libZipDir = "$($libraryJson.machineName)-$($libraryJson.majorVersion).$($libraryJson.minorVersion)"
$requiredSource = @(
    "h5p.json",
    "content/content.json",
    "$libSrcDir/library.json",
    "$libSrcDir/semantics.json"
)
$requiredSource += @($libraryJson.preloadedJs | ForEach-Object { "$libSrcDir/$($_.path)" })
$requiredSource += @($libraryJson.preloadedCss | ForEach-Object { "$libSrcDir/$($_.path)" })
$requiredZip = @($requiredSource | ForEach-Object {
    if ($_ -like "$libSrcDir/*") { $libZipDir + $_.Substring($libSrcDir.Length) } else { $_ }
})

foreach ($relative in $requiredSource) {
    $path = Join-Path $source $relative
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
        throw "Arquivo obrigatório ausente: h5p-src/$relative"
    }
}

# Parse all JSON files before packaging so invalid metadata fails the build.
Get-ChildItem -LiteralPath $source -Recurse -Filter *.json | ForEach-Object {
    try {
        $null = Get-Content -LiteralPath $_.FullName -Raw -Encoding UTF8 | ConvertFrom-Json
    }
    catch {
        throw "JSON inválido em $($_.FullName): $($_.Exception.Message)"
    }
}

$temporary = Join-Path $outputDirectory (".magnetismo-transporte-{0}.tmp" -f [guid]::NewGuid().ToString("N"))
if (Test-Path -LiteralPath $temporary) {
    Remove-Item -LiteralPath $temporary -Force
}
# Leftovers from a build that was interrupted (Ctrl+C, or a throw below):
# dist/ is tracked, so a stray 1 MiB .tmp shows up as untracked noise and can be
# mistaken for a deliverable. Sweep them before starting.
Get-ChildItem -LiteralPath $outputDirectory -Filter ".magnetismo-transporte-*.tmp" -File -ErrorAction SilentlyContinue |
    Remove-Item -Force
if (Test-Path -LiteralPath $Output) {
    Remove-Item -LiteralPath $Output -Force
}

try {
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$sourcePath = (Resolve-Path -LiteralPath $source).Path.TrimEnd("\")
$allowedExtensions = @(
    ".json", ".png", ".jpg", ".jpeg", ".gif", ".bmp", ".tif", ".tiff", ".svg",
    ".eot", ".ttf", ".woff", ".woff2", ".otf", ".webm", ".mp4", ".ogg", ".mp3",
    ".m4a", ".wav", ".txt", ".pdf", ".rtf", ".doc", ".docx", ".xls", ".xlsx",
    ".ppt", ".pptx", ".odt", ".ods", ".odp", ".xml", ".csv", ".diff", ".patch",
    ".swf", ".md", ".textile", ".vtt", ".webvtt", ".js", ".css"
)
# Timestamp gravado em cada entrada do zip. CreateEntryFromFile usaria o mtime
# do arquivo, e o mtime muda a cada build (e a cada git checkout), entao o
# SHA-256 publicado nunca bateria com o .h5p commitado. Um instante fixo, no
# inicio da era do formato ZIP, torna o pacote reprodutivel: mesmas fontes =>
# mesmo hash.
$zipTimestamp = [System.DateTimeOffset]::new(1980, 1, 1, 0, 0, 0, [System.TimeSpan]::Zero)
$archive = [System.IO.Compression.ZipFile]::Open(
    $temporary,
    [System.IO.Compression.ZipArchiveMode]::Create
)
try {
    Get-ChildItem -LiteralPath $sourcePath -Recurse -File | Sort-Object FullName | ForEach-Object {
        # ZipFile.CreateFromDirectory on .NET Framework can write backslashes
        # on Windows. H5P/ZIP interchange requires portable forward slashes.
        $entryName = $_.FullName.Substring($sourcePath.Length).TrimStart("\", "/").Replace("\", "/")
        # H5P packages require the versioned library folder inside the zip
        # (e.g. H5P.MagnetismoTransporte-2.2/...). The source tree stays
        # unversioned so dev/preview.html keeps working.
        if ($entryName -like "$libSrcDir/*") {
            $entryName = $libZipDir + $entryName.Substring($libSrcDir.Length)
        }
        # Lumi/H5P validador rejeita arquivos sem extensao permitida (ex.: LICENSE).
        # Mantemos h5p-src/LICENSE no repositorio, mas fora do .h5p.
        if ([System.IO.Path]::GetFileName($entryName) -eq "LICENSE") {
            return
        }
        $extension = [System.IO.Path]::GetExtension($entryName).ToLowerInvariant()
        if ($allowedExtensions -notcontains $extension) {
            throw "Extensao nao permitida no H5P (Lumi rejeita): $entryName"
        }
        $entry = $archive.CreateEntry($entryName, [System.IO.Compression.CompressionLevel]::Optimal)
        $entry.LastWriteTime = $zipTimestamp
        # Not $input: that is a PowerShell automatic variable and assigning to
        # it does not create a FileStream.
        $fileStream = [System.IO.File]::OpenRead($_.FullName)
        $entryStream = $entry.Open()
        try {
            $fileStream.CopyTo($entryStream)
        }
        finally {
            $entryStream.Dispose()
            $fileStream.Dispose()
        }
    }
}
finally {
    $archive.Dispose()
}
Move-Item -LiteralPath $temporary -Destination $Output

$package = [System.IO.Compression.ZipFile]::OpenRead($Output)
try {
    $entries = @($package.Entries | ForEach-Object { $_.FullName })
    foreach ($relative in $requiredZip) {
        $normalized = $relative.Replace("\", "/")
        if ($entries -notcontains $normalized) {
            throw "O pacote não contém a entrada obrigatória: $normalized"
        }
    }

    $stray = @($entries | Where-Object { $_ -eq $libSrcDir -or $_ -like "$libSrcDir/*" })
    if ($stray.Count -gt 0) {
        throw "Biblioteca sem sufixo de versão no pacote (Lumi rejeita): $($stray[0]). Esperado: $libZipDir/..."
    }

    $forbidden = $entries | Where-Object {
        $_ -match "\\" -or $_ -match "(^|/)(node_modules|\.git|dev|scripts|authoring|docs|\.claude)(/|$)" -or $_ -match "\.map$"
    }
    if ($forbidden) {
        throw "Entradas não permitidas no H5P: $($forbidden -join ', ')"
    }
}
finally {
    $package.Dispose()
}

$hash = (Get-FileHash -LiteralPath $Output -Algorithm SHA256).Hash.ToLowerInvariant()
$hashPath = "$Output.sha256"
# Set-Content would end the line with CRLF, and this file is committed next to
# the package it describes: write the LF form the repo stores.
$hashLine = "$hash  $([System.IO.Path]::GetFileName($Output))`n"
[System.IO.File]::WriteAllText($hashPath, $hashLine, [System.Text.Encoding]::ASCII)

$sizeMiB = [math]::Round((Get-Item -LiteralPath $Output).Length / 1MB, 2)
Write-Host "Pacote H5P criado: $Output"
Write-Host "Tamanho: $sizeMiB MiB"
Write-Host "SHA-256: $hash"
}
finally {
    # No-op after a successful Move-Item; removes the partial archive when any
    # check above threw.
    if (Test-Path -LiteralPath $temporary) {
        Remove-Item -LiteralPath $temporary -Force
    }
}
