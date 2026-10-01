(function (H5P) {
  'use strict';

  /* The four graded activities. `label`/`description` appear on the results
   * page (in the interface language); `xapiTitle`/`interactionType` go into
   * the xAPI statement and stay fixed, so LMS reports do not change with the
   * language chosen by the student. */
  const L = H5P.MagnetismoTransporte.I18n.L;

  const ACTIVITIES = {
    dragWords: {
      get label() { return L('Vocabulário (Drag the Words)', 'Vocabulary (Drag the Words)', 'Vocabulario (Drag the Words)'); },
      get description() { return L('Cinco termos de física', 'Five physics terms', 'Cinco términos de física'); },
      xapiTitle: 'Drag the Words — Vocabulário do magnetismo',
      interactionType: 'fill-in',
      page: 2,
      max: 5
    },
    singleChoice: {
      get label() { return L('Quiz de escolha única', 'Single-choice quiz', 'Cuestionario de opción única'); },
      get description() { return L('Quatro questões', 'Four questions', 'Cuatro preguntas'); },
      xapiTitle: 'Single Choice Set — Magnetismo e Maglev',
      interactionType: 'choice',
      page: 4,
      max: 4
    },
    memory: {
      get label() { return L('Jogo da memória', 'Memory game', 'Juego de memoria'); },
      get description() { return L('Seis pares; pontos = acertos ÷ tentativas', 'Six pairs; points = hits ÷ tries', 'Seis parejas; puntos = aciertos ÷ intentos'); },
      xapiTitle: 'Memory Game — MagLev-Cobra',
      interactionType: 'matching',
      page: 5,
      max: 1
    },
    trueFalse: {
      get label() { return L('Verdadeiro ou falso', 'True or false', 'Verdadero o falso'); },
      get description() { return L('Cinco afirmações', 'Five statements', 'Cinco afirmaciones'); },
      xapiTitle: 'Question Set — Verdadeiro ou Falso',
      interactionType: 'true-false',
      page: 7,
      max: 5
    },
    // Open-ended question. `long-fill-in` is the ADL type for a long written
    // answer; the graded value comes from the conceptual grader, never from a
    // similarity score. The key must stay `essay`: portal-perfis/app.py mirrors
    // these ids, and storage.js whitelists `graded` against the same list.
    essay: {
      get label() { return L('Dissertativa', 'Open-ended', 'Dissertativa'); },
      get description() { return L('Resposta curta escrita', 'Short written answer', 'Respuesta corta escrita'); },
      xapiTitle: 'Essay — MagLev-Cobra e o nitrogênio líquido',
      interactionType: 'long-fill-in',
      page: 8,
      max: 5
    }
  };

  // Questions drawn per student from each bank; must match `max` above.
  const SINGLE_COUNT = ACTIVITIES.singleChoice.max;
  const TRUE_FALSE_COUNT = ACTIVITIES.trueFalse.max;

  // "Pular" unlocks only after this many wrong tries on the same item
  // (vocabulary blank, lab question). Quiz and true/false have no skip:
  // each question takes one graded answer. The memory game (page with a
  // YouTube video) keeps its skip always available.
  const SKIP_AFTER_TRIES = 3;

  const TOTAL_MAX = Object.keys(ACTIVITIES).reduce((sum, id) => sum + ACTIVITIES[id].max, 0);

  H5P.MagnetismoTransporte = H5P.MagnetismoTransporte || {};
  H5P.MagnetismoTransporte.Activities = {
    ACTIVITIES,
    SINGLE_COUNT,
    TRUE_FALSE_COUNT,
    SKIP_AFTER_TRIES,
    TOTAL_MAX,
    ids: Object.keys(ACTIVITIES)
  };
})(window.H5P = window.H5P || {});
