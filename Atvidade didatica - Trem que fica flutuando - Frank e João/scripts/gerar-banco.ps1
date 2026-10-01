param(
    [string]$Source = "authoring/banco-de-questoes.json",
    [string]$English = "authoring/banco-de-questoes.en.json",
    [string]$Spanish = "authoring/banco-de-questoes.es.json",
    [string]$Rubric = "authoring/rubrica-dissertativa.json",
    [string]$Output = "h5p-src/H5P.MagnetismoTransporte/js/data/bank.js"
)

# Gera js/data/bank.js a partir do gabarito em texto puro (authoring/).
# O arquivo gerado não contém as respostas: cada explicação é cifrada com
# uma chave derivada da resposta CERTA (ver js/core/answer-key.js).
# O hash (cyrb53) e o gerador (mulberry32) abaixo precisam ser idênticos
# aos de js/core/util.js.
# Inglês (en-US) e espanhol (es-ES): os textos de $English e $Spanish viram
# campos "...En"/"...Es" (questionEn, questionEs, textEn, textEs…) e as
# explicações lacradas levam as três línguas na ordem pt, en, es, separadas
# por $PayloadSeparator (igual a PAYLOAD_SEPARATOR em js/core/i18n.js).

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$projectRoot = Split-Path -Parent $PSScriptRoot
if (-not [System.IO.Path]::IsPathRooted($Source)) { $Source = Join-Path $projectRoot $Source }
if (-not [System.IO.Path]::IsPathRooted($English)) { $English = Join-Path $projectRoot $English }
if (-not [System.IO.Path]::IsPathRooted($Spanish)) { $Spanish = Join-Path $projectRoot $Spanish }
if (-not [System.IO.Path]::IsPathRooted($Rubric)) { $Rubric = Join-Path $projectRoot $Rubric }
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

# Portuguese text + English + Spanish, sealed together. The order must match
# PAYLOAD_SEPARATOR parsing in js/core/i18n.js: pt, en, es. A missing
# translation simply leaves the Portuguese in that slot, and I18n picks the
# first non-empty part for the running language.
function Trilingual([string]$Pt, $En, $Es) {
    $text = $Pt
    if ($En) { $text = $text + $PayloadSeparator + [string]$En }
    if ($Es) { $text = $text + $PayloadSeparator + [string]$Es }
    return $text
}

# ", fieldEn: "…", fieldEs: "…"" for each translation present.
function Translations([string]$Name, $En, $Es) {
    $out = ""
    if ($En) { $out += ", ${Name}En: $(Js $En)" }
    if ($Es) { $out += ", ${Name}Es: $(Js $Es)" }
    return $out
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
# $EnOptions / $EsOptions: translated options in the same order as the
# Portuguese ones. A translation that is present must be complete.
function Sealed-Options($Question, [string]$Salt, [string]$Scope, [string]$Payload, $EnOptions, $EsOptions) {
    $count = @($Question.options).Count
    if ($count -lt 2) { throw "$Scope '$($Question.id)': precisa de pelo menos 2 alternativas." }
    $correct = [int]$Question.correct
    if ($correct -lt 0 -or $correct -ge $count) { throw "$Scope '$($Question.id)': 'correct' fora do intervalo 0..$($count - 1)." }
    foreach ($language in @(@('inglês', $EnOptions), @('espanhol', $EsOptions))) {
        $list = @($language[1] | Where-Object { $null -ne $_ })
        if ($list.Count -gt 0 -and $list.Count -ne $count) {
            throw "$Scope '$($Question.id)': a tradução em $($language[0]) tem $($list.Count) alternativas; o original tem $count."
        }
    }
    $enList = @($EnOptions | Where-Object { $null -ne $_ })
    $esList = @($EsOptions | Where-Object { $null -ne $_ })
    $options = @()
    for ($i = 0; $i -lt $count; $i++) {
        $textEn = if ($enList.Count -gt 0) { [string]$enList[$i] } else { $null }
        $textEs = if ($esList.Count -gt 0) { [string]$esList[$i] } else { $null }
        $options += [pscustomobject]@{ id = (Option-Id $Salt $Scope $Question.id $i); text = [string]@($Question.options)[$i]; textEn = $textEn; textEs = $textEs }
    }
    $correctId = $options[$correct].id
    Assert-Unique @($options | ForEach-Object { $_.id }) "$Scope '$($Question.id)'"
    $sorted = @($options | Sort-Object id)
    $optionJs = ($sorted | ForEach-Object { "{ id: $(Js $_.id), text: $(Js $_.text)$(Translations 'text' $_.textEn $_.textEs) }" }) -join ", "
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
$es = $null
if (Test-Path -LiteralPath $Spanish -PathType Leaf) {
    $es = Get-Content -LiteralPath $Spanish -Raw -Encoding UTF8 | ConvertFrom-Json
}
else {
    Write-Warning "Tradução em espanhol não encontrada ($Spanish): o modo Español mostrará as questões em português."
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
$esDrag = Get-Prop $es "dragWords"
$enSentence = @(Get-Prop $enDrag "sentence" | Where-Object { $null -ne $_ })
$esSentence = @(Get-Prop $esDrag "sentence" | Where-Object { $null -ne $_ })
$enTerms = Get-Prop $enDrag "terms"
$esTerms = Get-Prop $esDrag "terms"
if ($enSentence.Count -gt 0 -and $enSentence.Count -ne @($drag.sentence).Count) {
    throw "dragWords (inglês): 'sentence' precisa ter $(@($drag.sentence).Count) itens."
}
if ($esSentence.Count -gt 0 -and $esSentence.Count -ne @($drag.sentence).Count) {
    throw "dragWords (espanhol): 'sentence' precisa ter $(@($drag.sentence).Count) itens."
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
if ($esSentence.Count -gt 0) {
    $lines.Add("      sentenceEs: [")
    $lines.Add(($esSentence | ForEach-Object { "        $(Js $_)" }) -join ",`n")
    $lines.Add("      ],")
}
$lines.Add("      terms: [")
$lines.Add((@($allTerms | Sort-Object id) | ForEach-Object { "        { id: $(Js $_.id), text: $(Js $_.text)$(Translations 'text' (Get-Prop $enTerms $_.id) (Get-Prop $esTerms $_.id)), concept: $(Js $_.concept) }" }) -join ",`n")
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
    $esQuestion = Get-Prop (Get-Prop $es "lab") $id
    $sealed = Sealed-Options $question $salt "lab" (Trilingual ([string]$question.success) (Get-Prop $enQuestion "success") (Get-Prop $esQuestion "success")) (Get-Prop $enQuestion "options") (Get-Prop $esQuestion "options")
    $labLines += "      ${id}: {`n        prompt: $(Js $question.prompt)$(Translations 'prompt' (Get-Prop $enQuestion 'prompt') (Get-Prop $esQuestion 'prompt')),`n        retry: $(Js $question.retry)$(Translations 'retry' (Get-Prop $enQuestion 'retry') (Get-Prop $esQuestion 'retry')),`n        options: $($sealed.options),`n        seal: $(Js $sealed.seal)`n      }"
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
    $esQuestion = Get-Prop (Get-Prop $es "singleChoice") $question.id
    $sealed = Sealed-Options $question $salt "single" (Trilingual ([string]$question.explanation) (Get-Prop $enQuestion "explanation") (Get-Prop $esQuestion "explanation")) (Get-Prop $enQuestion "options") (Get-Prop $esQuestion "options")
    $singleLines += "      {`n        id: $(Js $question.id), concept: $(Js $question.concept),`n        question: $(Js $question.question)$(Translations 'question' (Get-Prop $enQuestion 'question') (Get-Prop $esQuestion 'question')),`n        options: $($sealed.options),`n        seal: $(Js $sealed.seal)`n      }"
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
    $esQuestion = Get-Prop (Get-Prop $es "trueFalse") $question.id
    $seal = [MtSeal]::Seal($salt, "tf|$($question.id)|$answer", (Trilingual ([string]$question.feedback) (Get-Prop $enQuestion "feedback") (Get-Prop $esQuestion "feedback")))
    $tfLines += "      {`n        id: $(Js $question.id), concept: $(Js $question.concept),`n        statement: $(Js $question.statement)$(Translations 'statement' (Get-Prop $enQuestion 'statement') (Get-Prop $esQuestion 'statement')),`n        seal: $(Js $seal)`n      }"
}
$lines.Add($tfLines -join ",`n")
$lines.Add("    ],")

# ------------------------------------------------------------ dissertativa
# A rubrica sai de authoring/rubrica-dissertativa.json e entra LACRADA, pelo
# mesmo caminho do resto do gabarito: cada item ganha um selo cuja chave deriva
# do id do conceito. O navegador recebe as expressões aceitas (sem as respostas
# de referência, que ficam seladas) e só consegue abri-las com o gabarito.
if (Test-Path -LiteralPath $Rubric -PathType Leaf) {
    $essay = (Get-Content -LiteralPath $Rubric -Raw -Encoding UTF8 | ConvertFrom-Json).essay
    $essayId = [string]$essay.id
    if ($essayId -notmatch '^[a-z0-9-]{1,60}$') { throw "essay: 'id' inválido: '$essayId'" }
    $essayMax = [int]$essay.maxPoints
    if ($essayMax -lt 1) { throw "essay: 'maxPoints' precisa ser >= 1." }

    # Referências seladas: pt<sep>en<sep>es numa única string, iguais às
    # explicações do resto do banco.
    $references = Trilingual ([string]$essay.referenceAnswers[0]) `
        @($essay.referenceAnswersEn)[0] @($essay.referenceAnswersEs)[0]

    $conceptLines = @()
    foreach ($concept in @($essay.concepts)) {
        Assert-Id $concept.id "essay.concepts"
        $texts = @($concept.keywords) + @($concept.phrases)
        if ($texts.Count -eq 0) { throw "essay '$($concept.id)': sem 'keywords' nem 'phrases'." }
        # minúsculas E sem acento: o avaliador normaliza os dois lados do
        # mesmo jeito (NFD + faixa \u0300-\u036f), então o termo precisa chegar
        # já dobrado, senão "nitrogênio líquido" nunca casa com a resposta.
        function Fold-Term([string]$Value) {
            $text = $Value.ToLowerInvariant().Normalize([Text.NormalizationForm]::FormD)
            return [regex]::Replace($text, "[$([char]0x0300)-$([char]0x036F)]", "").Trim()
        }
        $lower = ($texts | ForEach-Object { Fold-Term ([string]$_) } | Where-Object { $_ } | Sort-Object -Unique)
        # "ok|" é o marcador que answer-key.js usa para validar a chave: o
        # open() só decodifica quando a marca sai correta, então ela PRECISA
        # estar no texto lacrado (e é removida na leitura).
        $sealText = "ok|" + ([string]$concept.feedback)
        $termsJs = (($lower | ForEach-Object { Js $_ }) -join ", ")
        $required = "false"
        if ($concept.required) { $required = "true" }
        # Numbers are emitted as raw JS numbers, not Js strings: a quoted "0.25"
    # would still work with Number() but breaks arithmetic if a future field
    # is used directly (as the grader does with concept.weight).
    $conceptLines += "        { id: $(Js $concept.id), label: $(Js $concept.label)$(Translations 'label' $concept.labelEn $concept.labelEs), weight: $([double]$concept.weight), required: $required, terms: [$termsJs], seal: $(Js ([MtSeal]::Seal($salt, "essay|$essayId|$($concept.id)", $sealText))) }"
    }

    $relationLines = @()
    foreach ($relation in @($essay.relations)) {
        $patterns = @($relation.patterns | ForEach-Object { Fold-Term ([string]$_) } | Where-Object { $_ } | Sort-Object -Unique)
        if ($patterns.Count -eq 0) { throw "essay relation $($relation.from)->$($relation.to): sem 'patterns'." }
        $patternsJs = (($patterns | ForEach-Object { Js $_ }) -join ", ")
        $relationLines += "        { from: $(Js $relation.from), to: $(Js $relation.to), weight: $([double]$relation.weight), patterns: [$patternsJs] }"
    }

    $contradictionLines = @()
    foreach ($contradiction in @($essay.contradictions)) {
        $patterns = @($contradiction.patterns | ForEach-Object { Fold-Term ([string]$_) } | Where-Object { $_ } | Sort-Object -Unique)
        if ($patterns.Count -eq 0) { throw "essay contradiction '$($contradiction.id)': sem 'patterns'." }
        $patternsJs = (($patterns | ForEach-Object { Js $_ }) -join ", ")
        $contradictionLines += "        { id: $(Js $contradiction.id), weight: $([double]$contradiction.weight), patterns: [$patternsJs] }"
    }

    $cal = $essay.calibration
    $lines.Add("    essay: {")
    $lines.Add("      id: $(Js $essayId),")
    $lines.Add("      maxPoints: $essayMax,")
    $lines.Add("      prompt: $(Js $essay.prompt)$(Translations 'prompt' $essay.promptEn $essay.promptEs),")
    $lines.Add("      concepts: [")
    $lines.Add(($conceptLines -join ",`n"))
    $lines.Add("      ],")
    $lines.Add("      relations: [")
    $lines.Add(($relationLines -join ",`n"))
    $lines.Add("      ],")
    $lines.Add("      contradictions: [")
    $lines.Add(($contradictionLines -join ",`n"))
    $lines.Add("      ],")
    $lines.Add("      calibration: { requiredShortfallPenalty: $([double]$cal.requiredShortfallPenalty), contradictionMultiplier: $([double]$cal.contradictionMultiplier), minScore: $([double]$cal.minScore), maxScore: $([double]$cal.maxScore) },")
    $lines.Add("      references: $(Js ([MtSeal]::Seal($salt, "essay|$essayId|referencias", $references)))")
    $lines.Add("    }")
    $essaySummary = "1 dissertativa ($essayMax pontos)"
}
else {
    Write-Warning "Rubrica da dissertativa não encontrada ($Rubric): a página 8 cairá para o gabarito em branco."
    $lines.Add("    essay: null")
    $essaySummary = "0 dissertativas (rubrica ausente)"
}

$lines.Add("  };")
$lines.Add("})(window.H5P = window.H5P || {});")

$text = ($lines -join "`n") + "`n"
New-Item -ItemType Directory -Force -Path (Split-Path -Parent $Output) | Out-Null
[System.IO.File]::WriteAllText($Output, $text, (New-Object System.Text.UTF8Encoding $false))

Write-Host "Banco lacrado gerado: $Output"
Write-Host ("  {0} lacunas, {1} perguntas do laboratório, {2} de escolha única, {3} de V ou F, {4}" -f $terms.Count, $labIds.Count, $single.Count, $trueFalse.Count, $essaySummary)
