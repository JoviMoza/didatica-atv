(function (H5P) {
  'use strict';

  /* ------------------------------------------------------------------ *
   * Conceptual grader for the open-ended question (page 8).
   *
   * Deliberately NOT a similarity score: the idea that a cosine distance is
   * a pedagogical scale is rejected in docs/questoes-dissertativas-viabilidade.md.
   * A keyword alone proves nothing, so the score is built from:
   *
   *   1. normalisation (accents, case, punctuation) that KEEPS negation,
   *      because "não ocorre supercondutividade" is not "ocorre supercondutividade";
   *   2. concept coverage  — each concept contributes its own weight;
   *   3. relations         — the chain has to hold together, not just the parts;
   *   4. contradictions    — a wrong scientific relation caps the score;
   *   5. a required concept that is missing prevents the maximum.
   *
   * The composition is renormalised to 0..1 and the contradiction acts as a
   * multiplier, so the scale really does reach 1.0 and never goes below 0.
   * Everything is deterministic: same answer, same result, no network.
   *
   * The rubric reaches the browser with the accepted terms (they are needed
   * to grade offline) but WITHOUT the reference answers or the feedback, which
   * stay sealed in bank.js — see docs/seguranca.md.
   * ------------------------------------------------------------------ */

  const I18n = H5P.MagnetismoTransporte.I18n;

  // Shared folding step: lowercase + NFD + combining marks removed. Both the
  // answer and the rubric terms go through it, otherwise a rubric written with
  // accents would never match a folded answer.
  function fold(text) {
    return String(text === undefined || text === null ? '' : text)
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  // The answer additionally loses punctuation, which becomes a space. Nothing
  // is stemmed: the rubric lists the forms it accepts.
  function normalize(text) {
    return fold(text)
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  // Rubric terms keep their punctuation (a term may contain a comma or an
  // apostrophe), so only the shared folding plus whitespace tidy-up applies.
  function normalizeTerm(term) {
    return fold(term).replace(/\s+/g, ' ').trim();
  }

  function includesTerm(haystack, rawTerm) {
    const term = normalizeTerm(rawTerm);
    if (!term) {
      return false;
    }
    // Phrases match as substrings; single words match on a word boundary, so
    // "polar" does not count as evidence for "polo".
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = term.indexOf(' ') === -1 ? `\\b${escaped}\\b` : escaped;
    return new RegExp(pattern, 'i').test(haystack);
  }

  function hitCount(haystack, terms) {
    let hits = 0;
    for (let i = 0; i < terms.length; i += 1) {
      if (includesTerm(haystack, terms[i])) {
        hits += 1;
      }
    }
    return hits;
  }

  /* Verdict for an answer that cannot be judged: empty, no review flag. Kept
   * in one place so every early return has the same shape. */
  function emptyVerdict() {
    return {
      score: 0,
      maxScore: 1,
      confidence: 0,
      needsReview: false,
      evaluationMode: 'offline',
      concepts: [],
      relations: [],
      contradictions: [],
      strengths: [],
      improvements: [],
      references: null
    };
  }

  /* Evaluates an answer against the sealed rubric.
   *
   * `rubric.concepts` carries { id, label, weight, required, terms, seal }.
   * The seal is only ever opened for the feedback TEXT, never for the score:
   * the score comes from terms, relations and contradictions alone.
   *
   * Returns { score, confidence, needsReview, concepts, relations,
   * contradictions, strengths, improvements, references }, all on a 0..1
   * scale except the flags. The page multiplies by the activity maximum. */
  function evaluate(rubric, answer, key) {
    if (!rubric || !Array.isArray(rubric.concepts) || !rubric.concepts.length) {
      return emptyVerdict();
    }
    const text = normalize(answer);
    // Shorter than this cannot carry an explanation; the page also refuses to
    // submit it, so this only guards a direct call.
    if (text.length < 15) {
      return emptyVerdict();
    }

    /* 1. concept coverage */
    let conceptScore = 0;
    let weightSum = 0;
    let requiredMissing = false;
    const concepts = rubric.concepts.map((concept) => {
      const hits = hitCount(text, concept.terms);
      // One accepted term is enough to count the concept as "partial"; the
      // status is shown to the student so a keyword salad is visible as such.
      const status = hits === 0 ? 'missing' : hits === 1 ? 'partial' : 'correct';
      weightSum += Number(concept.weight) || 0;
      if (status !== 'missing') {
        conceptScore += (Number(concept.weight) || 0) * (hits >= 2 ? 1 : 0.6);
      }
      if (concept.required && status === 'missing') {
        requiredMissing = true;
      }
      return {
        id: concept.id,
        // The label is plain text on purpose: naming a concept is not giving
        // away the answer, and the student has to be able to read it.
        label: I18n.field(concept, 'label'),
        status,
        hits,
        required: Boolean(concept.required),
        seal: concept.seal
      };
    });
    conceptScore = weightSum > 0 ? conceptScore / weightSum : 0;

    /* 2. relations: a chain only counts if both ends were mentioned */
    const relations = rubric.relations.map((relation) => {
      // One of the rubric patterns has to show up. Requiring both concept ids
      // in the text as well would reject a perfectly correct explanation that
      // never uses the id's name: the ids are internal, not vocabulary.
      const ok = relation.patterns.some((pattern) => includesTerm(text, pattern));
      return { from: relation.from, to: relation.to, ok, weight: Number(relation.weight) || 0 };
    });
    const relWeight = relations.reduce((sum, relation) => sum + relation.weight, 0);
    const relationScore = relWeight > 0
      ? relations.reduce((sum, relation) => sum + relation.weight * (relation.ok ? 1 : 0), 0) / relWeight
      : 0;

    /* 3. contradictions cap the result */
    const contradictions = rubric.contradictions
      .filter((rule) => rule.patterns.some((pattern) => includesTerm(text, pattern)))
      .map((rule) => ({ id: rule.id, weight: Number(rule.weight) || 0 }));

    const calibration = rubric.calibration || {};
    const base = (0.6 * conceptScore + 0.4 * relationScore);
    // A missing required concept removes a fixed share: it is the teacher's
    // decision, not a similarity value.
    const shortfall = requiredMissing ? Number(calibration.requiredShortfallPenalty) || 0.34 : 0;
    const penalty = contradictions.length
      ? Math.min(1, contradictions.reduce((sum, rule) => sum + rule.weight, 0)) *
        (Number(calibration.contradictionMultiplier) || 0.5)
      : 0;
    const min = Number(calibration.minScore) || 0;
    const max = Number(calibration.maxScore) || 1;
    const score = Math.max(min, Math.min(max, (base - shortfall) * (1 - penalty)));

    /* 4. confidence: how much of the rubric the answer actually engaged.
     * It is a measure of the EVIDENCE, not of the score: a correct answer
     * that hits every concept scores 0.97 with confidence 0.47, which is the
     * honest reading for a rule-based grader with no benchmark behind it yet.
     * A short or off-topic answer gets near zero, so it is flagged for the
     * teacher instead of being presented as a confident grade. */
    const coverage = weightSum > 0
      ? concepts.reduce((sum, concept) => sum + (concept.status === 'missing' ? 0 : Number(concept.weight) || 0), 0) / weightSum
      : 0;
    const evidence = 0.5 * coverage + 0.3 * relationScore + 0.2 * Math.min(1, text.length / 400);
    // Scaled so that an answer engaging every concept and every relation
    // lands at 1.0: confidence then answers "did we read enough of it?".
    const confidence = Math.round(Math.max(0, Math.min(1, evidence / 0.9)) * 100) / 100;
    const needsReview = confidence < 0.6 || contradictions.length > 0;

    /* 5. structured feedback. The feedback text for each concept lives in a
     * seal keyed by the concept id, so it is only readable once the concept
     * has actually been judged. */
    const strengths = [];
    const improvements = [];
    concepts.forEach((concept) => {
      if (concept.status === 'missing') {
        improvements.push(concept);
      } else {
        strengths.push(concept);
      }
    });

    return {
      score: Math.round(score * 100) / 100,
      maxScore: 1,
      confidence,
      needsReview,
      evaluationMode: 'offline',
      concepts,
      relations,
      contradictions,
      strengths,
      improvements,
      references: key && key.open(rubric.references, ['essay', rubric.id, 'referencias'])
    };
  }

  H5P.MagnetismoTransporte = H5P.MagnetismoTransporte || {};
  H5P.MagnetismoTransporte.Essay = { normalize, evaluate };
})(window.H5P = window.H5P || {});