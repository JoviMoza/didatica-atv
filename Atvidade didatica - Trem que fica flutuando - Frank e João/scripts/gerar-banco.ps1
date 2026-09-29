param(
    [string]$Source = "authoring/banco-de-questoes.json",
    [string]$English = "authoring/banco-de-questoes.en.json",
    [string]$Output = "h5p-src/H5P.MagnetismoTransporte/js/data/bank.js"
)

# Gera js/data/bank.js a partir do gabarito em texto puro (authoring/).
# O arquivo gerado não contém as respostas: cada explicação é cifrada com
# uma chave derivada da resposta CERTA (ver js/core/answer-key.js).
# O hash (cyrb53) e o gerador (mulberry32) abaixo precisam ser idênticos
# aos de js/core/util.js.
# Inglês (en-US): os textos de $English viram campos "...En" (questionEn,
# textEn…) e as explicações lacradas levam as duas línguas, separadas por
# $PayloadSeparator (igual a PAYLOAD_SEPARATOR em js/core/i18n.js).

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$projectRoot = Split-Path -Parent $PSScriptRoot
if (-not [System.IO.Path]::IsPathRooted($Source)) { $Source = Join-Path $projectRoot $Source }
if (-not [System.IO.Path]::IsPathRooted($English)) { $English = Join-Path $projectRoot $English }
if (-not [System.IO.Path]::IsPathRooted($Output)) { $Output = Join-Path $projectRoot $Output }
if (-not (Test-Path -LiteralPath $Source -PathType Leaf)) {
    throw "Gabarito não encontrado: $Source"
}

if (-not ("MtSeal" -as [type])) {
    Add-Type -Language CSharp -TypeDefinition @"
using System;
using System.Text;

public static class MtSeal {
    public static uint[] Cyrb(string text, uint seed) {
        unchecked {
            uint h1 = 0xdeadbeef ^ seed;
            uint h2 = 0x41c6ce57 ^ seed;
            foreach (char c in text) {
                h1 = (h1 ^ (uint)c) * 2654435761u;
                h2 = (h2 ^ (uint)c) * 1597334677u;
            }
            h1 = (h1 ^ (h1 >> 16)) * 2246822507u;
            h1 ^= (h2 ^ (h2 >> 13)) * 3266489909u;
            h2 = (h2 ^ (h2 >> 16)) * 2246822507u;
            h2 ^= (h1 ^ (h1 >> 13)) * 3266489909u;
            return new uint[] { h1, h2 };
        }
    }

    public static string HashHex(string text) {
        uint[] h = Cyrb(text, 0);
        return h[1].ToString("x8") + h[0].ToString("x8");
    }

    public static string Seal(string salt, string key, string payload) {
        unchecked {
            uint a = Cyrb(salt + "|" + key, 0)[0];
            // Pad to a multiple of 16 chars so the seal length does not hint
            // at the answer (e.g. which vocabulary term fills a blank).
            string text = "ok|" + payload;
            text = text.PadRight((text.Length + 15) / 16 * 16, (char)0);
            StringBuilder sb = new StringBuilder(text.Length * 4);
            foreach (char c in text) {
                a += 0x6D2B79F5u;
                uint t = (a ^ (a >> 15)) * (1u | a);
                t = (t + ((t ^ (t >> 7)) * (61u | t))) ^ t;
                uint r = t ^ (t >> 14);
                sb.Append(((ushort)((uint)c ^ (r & 0xFFFFu))).ToString("x4"));
            }
            return sb.ToString();
        }
    }

    public static string Js(string value) {
        if (value == null) { return "null"; }
        StringBuilder sb = new StringBuilder("\"");
        foreach (char c in value) {
            if (c == '"') { sb.Append("\\\""); }
            else if (c == '\\') { sb.Append("\\\\"); }
            else if (c < 0x20 || c == (char)0x2028 || c == (char)0x2029) { sb.Append("\\u" + ((int)c).ToString("x4")); }
            else { sb.Append(c); }
        }
        return sb.Append('"').ToString();
    }
}
"@
}

function Js([object]$Value) {
    if ($null -eq $Value) { return "null" }
    return [MtSeal]::Js([string]$Value)
}

$PayloadSeparator = [string][char]0x1E

# Property of a parsed JSON object, or $null when it does not exist.
function Get-Prop($Object, [string]$Name) {
    if ($null -eq $Object) { return $null }
    $property = $Object.PSObject.Properties[$Name]
    if ($property) { return $property.Value }
    return $null
}

# Portuguese text + English translation, sealed together.
function Bilingual([string]$Pt, $En) {
    if ($En) { return $Pt + $PayloadSeparator + [string]$En }
    return $Pt
}

# ", fieldEn: "…"" when there is a translation, else nothing.
function En-Field([string]$Name, $Value) {
    if ($Value) { return ", ${Name}En: $(Js $Value)" }
    return ""
}

function Assert-Id([string]$Id, [string]$Where) {
    if ($Id -notmatch '^[a-z0-9-]{1,60}$') { throw "id inválido em ${Where}: '$Id'" }
}

function Assert-Unique([string[]]$Ids, [string]$Where) {
    $duplicates = @($Ids | Group-Object | Where-Object { $_.Count -gt 1 } | ForEach-Object { $_.Name })
    if ($duplicates.Count -gt 0) { throw "ids repetidos em ${Where}: $($duplicates -join ', ')" }
}

function Option-Id([string]$Salt, [string]$Scope, [string]$QuestionId, [int]$Index) {
    return "o" + [MtSeal]::HashHex("$Salt|$Scope|$QuestionId|opt|$Index").Substring(0, 8)
}

# Options are written in the order of their opaque ids, so the position of
# the correct option in the file carries no information.
# $EnOptions: English options in the same order as the Portuguese ones.
function Sealed-Options($Question, [string]$Salt, [string]$Scope, [string]$Payload, $EnOptions) {
    $count = @($Question.options).Count
    if ($count -lt 2) { throw "$Scope '$($Question.id)': precisa de pelo menos 2 alternativas." }
    $correct = [int]$Question.correct
    if ($correct -lt 0 -or $correct -ge $count) { throw "$Scope '$($Question.id)': 'correct' fora do intervalo 0..$($count - 1)." }
    $enList = @($EnOptions | Where-Object { $null -ne $_ })
    if ($enList.Count -gt 0 -and $enList.Count -ne $count) {
        throw "$Scope '$($Question.id)': a tradução em inglês tem $($enList.Count) alternativas; o original tem $count."
    }
    $options = @()
    for ($i = 0; $i -lt $count; $i++) {
        $textEn = if ($enList.Count -gt 0) { [string]$enList[$i] } else { $null }
        $options += [pscustomobject]@{ id = (Option-Id $Salt $Scope $Question.id $i); text = [string]@($Question.options)[$i]; textEn = $textEn }
    }
    $correctId = $options[$correct].id
    Assert-Unique @($options | ForEach-Object { $_.id }) "$Scope '$($Question.id)'"
    $sorted = @($options | Sort-Object id)
    $optionJs = ($sorted | ForEach-Object { "{ id: $(Js $_.id), text: $(Js $_.text)$(En-Field 'text' $_.textEn) }" }) -join ", "
    return @{
        options = "[$optionJs]"
        seal = [MtSeal]::Seal($Salt, "$Scope|$($Question.id)|$correctId", $Payload)
    }
}

$bank = Get-Content -LiteralPath $Source -Raw -Encoding UTF8 | ConvertFrom-Json
$en = $null
if (Test-Path -LiteralPath $English -PathType Leaf) {
    $en = Get-Content -LiteralPath $English -Raw -Encoding UTF8 | ConvertFrom-Json
}
else {
    Write-Warning "Tradução em inglês não encontrada ($English): o modo English mostrará as questões em português."
}
$salt = [string]$bank.salt
if ($salt.Length -lt 8) { throw "'salt' ausente ou curto demais em $Source." }

$lines = New-Object System.Collections.Generic.List[string]
$lines.Add("// ARQUIVO GERADO por scripts/gerar-banco.ps1 a partir de authoring/banco-de-questoes.json.")
$lines.Add("// Não edite à mão. As respostas não aparecem aqui: cada explicação está cifrada")
$lines.Add("// com a resposta certa como chave (ver js/core/answer-key.js e docs/seguranca.md).")
$lines.Add("(function (H5P) {")
$lines.Add("  'use strict';")
$lines.Add("")
$lines.Add("  H5P.MagnetismoTransporte = H5P.MagnetismoTransporte || {};")
$lines.Add("  H5P.MagnetismoTransporte.Bank = {")
$lines.Add("    salt: $(Js $salt),")

# ---------------------------------------------------------------- page 2
$drag = $bank.dragWords
$terms = @($drag.terms)
$distractors = @($drag.distractors)
if (@($drag.sentence).Count -ne $terms.Count + 1) {
    throw "dragWords: 'sentence' precisa ter exatamente um item a mais que 'terms'."
}
$allTerms = @($terms + $distractors)
$allTerms | ForEach-Object { Assert-Id $_.id "dragWords" }
Assert-Unique @($allTerms | ForEach-Object { $_.id }) "dragWords"
$enDrag = Get-Prop $en "dragWords"
$enSentence = @(Get-Prop $enDrag "sentence" | Where-Object { $null -ne $_ })
$enTerms = Get-Prop $enDrag "terms"
if ($enSentence.Count -gt 0 -and $enSentence.Count -ne @($drag.sentence).Count) {
    throw "dragWords (inglês): 'sentence' precisa ter $(@($drag.sentence).Count) itens."
}
$lines.Add("    dragWords: {")
$lines.Add("      sentence: [")
$lines.Add((@($drag.sentence) | ForEach-Object { "        $(Js $_)" }) -join ",`n")
$lines.Add("      ],")
if ($enSentence.Count -gt 0) {
    $lines.Add("      sentenceEn: [")
    $lines.Add(($enSentence | ForEach-Object { "        $(Js $_)" }) -join ",`n")
    $lines.Add("      ],")
}
$lines.Add("      terms: [")
$lines.Add((@($allTerms | Sort-Object id) | ForEach-Object { "        { id: $(Js $_.id), text: $(Js $_.text)$(En-Field 'text' (Get-Prop $enTerms $_.id)), concept: $(Js $_.concept) }" }) -join ",`n")
$lines.Add("      ],")
$lines.Add("      slots: [")
$slotLines = @()
for ($i = 0; $i -lt $terms.Count; $i++) {
    $term = $terms[$i]
    $slotLines += "        $(Js ([MtSeal]::Seal($salt, "drag|slot-$i|$($term.id)", [string]$term.concept)))"
}
$lines.Add($slotLines -join ",`n")
$lines.Add("      ]")
$lines.Add("    },")

# ---------------------------------------------------------------- page 3
$lines.Add("    lab: {")
$labIds = @($bank.lab.PSObject.Properties | ForEach-Object { $_.Name })
$labLines = @()
foreach ($id in $labIds) {
    $question = $bank.lab.$id
    $question | Add-Member -NotePropertyName id -NotePropertyValue $id -Force
    $enQuestion = Get-Prop (Get-Prop $en "lab") $id
    $sealed = Sealed-Options $question $salt "lab" (Bilingual ([string]$question.success) (Get-Prop $enQuestion "success")) (Get-Prop $enQuestion "options")
    $labLines += "      ${id}: {`n        prompt: $(Js $question.prompt)$(En-Field 'prompt' (Get-Prop $enQuestion 'prompt')),`n        retry: $(Js $question.retry)$(En-Field 'retry' (Get-Prop $enQuestion 'retry')),`n        options: $($sealed.options),`n        seal: $(Js $sealed.seal)`n      }"
}
$lines.Add($labLines -join ",`n")
$lines.Add("    },")

# ---------------------------------------------------------------- page 4
$single = @($bank.singleChoice)
$single | ForEach-Object { Assert-Id $_.id "singleChoice" }
Assert-Unique @($single | ForEach-Object { $_.id }) "singleChoice"
$lines.Add("    singleChoice: [")
$singleLines = @()
foreach ($question in $single) {
    $enQuestion = Get-Prop (Get-Prop $en "singleChoice") $question.id
    $sealed = Sealed-Options $question $salt "single" (Bilingual ([string]$question.explanation) (Get-Prop $enQuestion "explanation")) (Get-Prop $enQuestion "options")
    $singleLines += "      {`n        id: $(Js $question.id), concept: $(Js $question.concept),`n        question: $(Js $question.question)$(En-Field 'question' (Get-Prop $enQuestion 'question')),`n        options: $($sealed.options),`n        seal: $(Js $sealed.seal)`n      }"
}
$lines.Add($singleLines -join ",`n")
$lines.Add("    ],")

# ---------------------------------------------------------------- page 7
$trueFalse = @($bank.trueFalse)
$trueFalse | ForEach-Object { Assert-Id $_.id "trueFalse" }
Assert-Unique @($trueFalse | ForEach-Object { $_.id }) "trueFalse"
$lines.Add("    trueFalse: [")
$tfLines = @()
foreach ($question in $trueFalse) {
    if ($question.answer -isnot [bool]) { throw "trueFalse '$($question.id)': 'answer' precisa ser true ou false." }
    $answer = if ($question.answer) { "true" } else { "false" }
    $enQuestion = Get-Prop (Get-Prop $en "trueFalse") $question.id
    $seal = [MtSeal]::Seal($salt, "tf|$($question.id)|$answer", (Bilingual ([string]$question.feedback) (Get-Prop $enQuestion "feedback")))
    $tfLines += "      {`n        id: $(Js $question.id), concept: $(Js $question.concept),`n        statement: $(Js $question.statement)$(En-Field 'statement' (Get-Prop $enQuestion 'statement')),`n        seal: $(Js $seal)`n      }"
}
$lines.Add($tfLines -join ",`n")
$lines.Add("    ]")

$lines.Add("  };")
$lines.Add("})(window.H5P = window.H5P || {});")

$text = ($lines -join "`n") + "`n"
New-Item -ItemType Directory -Force -Path (Split-Path -Parent $Output) | Out-Null
[System.IO.File]::WriteAllText($Output, $text, (New-Object System.Text.UTF8Encoding $false))

Write-Host "Banco lacrado gerado: $Output"
Write-Host ("  {0} lacunas, {1} perguntas do laboratório, {2} de escolha única, {3} de V ou F" -f $terms.Count, $labIds.Count, $single.Count, $trueFalse.Count)
