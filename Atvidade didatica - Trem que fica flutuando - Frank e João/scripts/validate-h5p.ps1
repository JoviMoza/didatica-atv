param(
    [Parameter(Mandatory = $false)]
    [string]$Package = "dist/magnetismo-transporte.h5p"
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$projectRoot = Split-Path -Parent $PSScriptRoot
if (-not [System.IO.Path]::IsPathRooted($Package)) {
    $Package = Join-Path $projectRoot $Package
}
if (-not (Test-Path -LiteralPath $Package -PathType Leaf)) {
    throw "Arquivo .h5p não encontrado: $Package"
}

Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [System.IO.Compression.ZipFile]::OpenRead($Package)
try {
    $entries = @{}
    foreach ($entry in $zip.Entries) {
        if ($entry.FullName -match "\\") {
            throw "O pacote deve usar caminhos ZIP com barra normal: $($entry.FullName)"
        }
        if ($entries.ContainsKey($entry.FullName)) {
            throw "Entrada duplicada: $($entry.FullName)"
        }
        $entries[$entry.FullName] = $entry
    }

    $required = @(
        "h5p.json",
        "content/content.json"
    )
    foreach ($name in $required) {
        if (-not $entries.ContainsKey($name)) {
            throw "Entrada obrigatória ausente: $name"
        }
    }

    # H5P requires the versioned library folder inside the package
    # (e.g. H5P.MagnetismoTransporte-2.2/library.json). An unversioned
    # folder passes a naive check but Lumi rejects it with
    # package-validation-failed:library-file-missing for every file.
    $unversioned = @($entries.Keys | Where-Object { $_ -eq "H5P.MagnetismoTransporte" -or $_ -like "H5P.MagnetismoTransporte/*" })
    if ($unversioned.Count -gt 0) {
        throw "Pasta da biblioteca sem sufixo de versão: $($unversioned[0]). Reconstrua com scripts/build-h5p.ps1."
    }
    $libCandidates = @($entries.Keys | Where-Object { $_ -match "^H5P\.MagnetismoTransporte-\d+\.\d+/library\.json$" })
    if ($libCandidates.Count -ne 1) {
        throw "library.json versionado não encontrado (esperado H5P.MagnetismoTransporte-X.Y/library.json)."
    }
    $libDir = $libCandidates[0] -replace "/library\.json$", ""
    $semanticsName = "$libDir/semantics.json"
    if (-not $entries.ContainsKey($semanticsName)) {
        throw "Entrada obrigatória ausente: $semanticsName"
    }

    function Read-ZipJson([string]$Name) {
        $entry = $entries[$Name]
        $stream = $entry.Open()
        $reader = New-Object System.IO.StreamReader($stream, [System.Text.Encoding]::UTF8)
        try {
            return $reader.ReadToEnd() | ConvertFrom-Json
        }
        finally {
            $reader.Dispose()
            $stream.Dispose()
        }
    }

    $h5p = Read-ZipJson "h5p.json"
    $library = Read-ZipJson "$libDir/library.json"
    $content = Read-ZipJson "content/content.json"
    $null = Read-ZipJson "$libDir/semantics.json"

    $expectedLibDir = "$($library.machineName)-$($library.majorVersion).$($library.minorVersion)"
    if ($libDir -ne $expectedLibDir) {
        throw "Pasta da biblioteca ($libDir) não confere com library.json ($expectedLibDir)."
    }

    # Rules of the h5p.json schema used by Lumi (h5p-schema.json in
    # H5P-Nodejs-library). A violation makes Lumi refuse the package with
    # "package-validation-failed:invalid-h5p-json-file-2".
    $licenseExtras = $h5p.PSObject.Properties["licenseExtras"]
    if ($licenseExtras -and $licenseExtras.Value -isnot [string]) {
        throw "h5p.json: licenseExtras precisa ser texto, não objeto."
    }
    foreach ($change in @($h5p.changes)) {
        if ([string]$change.date -notmatch '^[0-9]{2}-[0-9]{2}-[0-9]{2} [0-9]{1,2}:[0-9]{2}:[0-9]{2}$') {
            throw "h5p.json: data do histórico fora do formato dd-mm-aa hh:mm:ss: '$($change.date)'"
        }
        if (-not $change.author -or -not $change.log) {
            throw "h5p.json: cada item de 'changes' precisa de author e log."
        }
    }
    foreach ($author in @($h5p.authors)) {
        if ([string]$author.role -notmatch '^\w+$') {
            throw "h5p.json: papel de autor inválido: '$($author.role)'"
        }
    }

    if ($h5p.mainLibrary -ne $library.machineName) {
        throw "mainLibrary ($($h5p.mainLibrary)) não corresponde a machineName ($($library.machineName))."
    }
    if ($h5p.mainLibrary -ne "H5P.MagnetismoTransporte") {
        throw "machineName inesperado: $($h5p.mainLibrary)"
    }
    if ($content.media.meissnerVideoUrl -ne "https://www.youtube.com/watch?v=wPxQm8mdUi8") {
        throw "A URL configurada da Página 6 não é a URL solicitada."
    }
    if ($content.media.cobraVideoUrl -ne "https://www.youtube.com/watch?v=MnR7iTjmSPg&t=63s") {
        throw "A URL configurada do vídeo UFRJ não é a URL solicitada."
    }

    foreach ($dep in @($h5p.preloadedDependencies)) {
        $depDir = "$($dep.machineName)-$($dep.majorVersion).$($dep.minorVersion)"
        if ($dep.machineName -eq $library.machineName -and $depDir -ne $libDir) {
            throw "preloadedDependencies ($depDir) não confere com a pasta da biblioteca ($libDir)."
        }
    }

    foreach ($script in $library.preloadedJs) {
        $name = "$libDir/$($script.path)"
        if (-not $entries.ContainsKey($name)) {
            throw "JavaScript declarado não encontrado: $name"
        }
    }
    foreach ($style in $library.preloadedCss) {
        $name = "$libDir/$($style.path)"
        if (-not $entries.ContainsKey($name)) {
            throw "CSS declarado não encontrado: $name"
        }
    }

    # Anti-cheat: the plain-text answer key (authoring/) must never reach
    # the package. Every explanation is sealed in js/data/bank.js.
    function Read-ZipText([string]$Name) {
        $stream = $entries[$Name].Open()
        $reader = New-Object System.IO.StreamReader($stream, [System.Text.Encoding]::UTF8)
        try { return $reader.ReadToEnd() }
        finally { $reader.Dispose(); $stream.Dispose() }
    }
    $allJs = (@($entries.Keys | Where-Object { $_ -match "\.js$" }) | ForEach-Object { Read-ZipText $_ }) -join "`n"
    $bankName = "$libDir/js/data/bank.js"
    if (-not $entries.ContainsKey($bankName)) {
        throw "Banco lacrado ausente: $bankName (rode scripts/gerar-banco.ps1)."
    }
    if ((Read-ZipText $bankName) -match '\b(correct|answer|explanation|feedback|success)\s*:') {
        throw "bank.js contém campos de gabarito em texto puro."
    }
    $authoringPath = Join-Path $projectRoot "authoring/banco-de-questoes.json"
    if (Test-Path -LiteralPath $authoringPath -PathType Leaf) {
        $authoring = Get-Content -LiteralPath $authoringPath -Raw -Encoding UTF8 | ConvertFrom-Json
        $secrets = @()
        $secrets += @($authoring.singleChoice | ForEach-Object { $_.explanation })
        $secrets += @($authoring.trueFalse | ForEach-Object { $_.feedback })
        $secrets += @($authoring.lab.PSObject.Properties | ForEach-Object { $_.Value.success })
        # Traduções: explicações e feedbacks também são gabarito em texto
        # puro e não podem vazar para nenhum JS do pacote.
        foreach ($translationPath in @(
            "authoring/banco-de-questoes.en.json",
            "authoring/banco-de-questoes.es.json"
        )) {
            $translationFile = Join-Path $projectRoot $translationPath
            if (-not (Test-Path -LiteralPath $translationFile -PathType Leaf)) { continue }
            $translation = Get-Content -LiteralPath $translationFile -Raw -Encoding UTF8 | ConvertFrom-Json
            $secrets += @($translation.singleChoice.PSObject.Properties | ForEach-Object { $_.Value.explanation })
            $secrets += @($translation.trueFalse.PSObject.Properties | ForEach-Object { $_.Value.feedback })
            $secrets += @($translation.lab.PSObject.Properties | ForEach-Object { $_.Value.success })
        }
        $leaks = @($secrets | Where-Object { $_ -and $allJs.Contains([string]$_) })
        if ($leaks.Count -gt 0) {
            throw "Gabarito em texto puro dentro do pacote ($($leaks.Count) trecho(s)). Rode scripts/gerar-banco.ps1 e confira js/."
        }
    }

    $contentJavaScript = @($entries.Keys | Where-Object { $_ -match "^content/.*\.js$" })
    if ($contentJavaScript.Count -gt 0) {
        throw "JavaScript não deve ficar em content/: $($contentJavaScript -join ', ')"
    }
}
finally {
    $zip.Dispose()
}

$sizeMiB = [math]::Round((Get-Item -LiteralPath $Package).Length / 1MB, 2)
Write-Host "VALIDADO: $Package"
Write-Host "Tamanho: $sizeMiB MiB"
Write-Host "Biblioteca: $libDir ($($library.machineName) $($library.majorVersion).$($library.minorVersion).$($library.patchVersion))"
Write-Host "URLs da Página 6 e do vídeo UFRJ: OK"
Write-Host "Metadados, referências JS/CSS e conteúdo: OK"
Write-Host "Gabarito: lacrado, sem respostas em texto puro no pacote"
