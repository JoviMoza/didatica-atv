param(
    [string]$Source = "designs",
    [string]$Output = "h5p-src/H5P.MagnetismoTransporte/css/themes"
)

# Gera css/themes/<id>.css a partir de designs/<n>-<id>/tema.css.
# Os temas de designs/ valem para a página inteira; aqui cada um passa a
# valer só quando o aluno o escolhe no botão "Aparência", que põe
# data-mt-theme="<id>" na raiz (.h5p-mt) e no contêiner (.h5p-mt-host).
# A condição fica dentro de :where(), que não soma especificidade, então
# cada regra mantém o peso que tinha no tema original (ver designs/README.md).
# Os arquivos gerados não devem ser editados à mão.

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$projectRoot = Split-Path -Parent $PSScriptRoot
if (-not [System.IO.Path]::IsPathRooted($Source)) { $Source = Join-Path $projectRoot $Source }
if (-not [System.IO.Path]::IsPathRooted($Output)) { $Output = Join-Path $projectRoot $Output }

New-Item -ItemType Directory -Force -Path $Output | Out-Null
$utf8 = New-Object System.Text.UTF8Encoding($false)
$generated = @()

Get-ChildItem -LiteralPath $Source -Directory | Sort-Object Name | ForEach-Object {
    $file = Join-Path $_.FullName "tema.css"
    if (-not (Test-Path -LiteralPath $file -PathType Leaf)) { return }
    if ($_.Name -notmatch '^\d+-([a-z][a-z0-9-]*)$') {
        throw "Pasta de tema com nome inválido: $($_.Name) (esperado <número>-<id>, ex.: 1-noturno)"
    }
    $id = $Matches[1]
    $scope = "[data-mt-theme=""$id""]"
    $css = [System.IO.File]::ReadAllText($file, $utf8)

    $css = $css.Replace(':where(.h5p-mt)', ":where(.h5p-mt$scope)")
    $css = [regex]::Replace($css, '\.h5p-mt-host(?![-\w])', ".h5p-mt-host:where($scope)")
    $css = [regex]::Replace($css, '\.h5p-mt(?![-\w\[:])', ".h5p-mt:where($scope)")

    # Every rule must end up scoped; an unscoped one would restyle all themes.
    $unscoped = [regex]::Matches($css, '\.h5p-mt(?:-host)?(?![-\w])(?!\[data-mt-theme|:where\(\[data-mt-theme)')
    if ($unscoped.Count -gt 0) {
        throw "Tema ${id}: seletor .h5p-mt sem escopo depois da conversão."
    }

    $header = "/* GERADO por scripts/gerar-temas.ps1 a partir de designs/$($_.Name)/tema.css.`n   Não edite: altere o tema em designs/ e rode o build. */`n`n"
    [System.IO.File]::WriteAllText((Join-Path $Output "$id.css"), $header + $css, $utf8)
    $generated += $id
}

Write-Host "Temas gerados em ${Output}: $($generated -join ', ')"
