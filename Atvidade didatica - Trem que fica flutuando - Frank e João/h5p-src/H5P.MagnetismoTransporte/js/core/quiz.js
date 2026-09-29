(function (H5P) {
  'use strict';

  /* Random question draw shared by page 4 (single choice) and page 7
   * (true or false). Each student keeps a seed in the saved state, so the
   * set and the option order survive reloads. */

  const Util = H5P.MagnetismoTransporte.Util;

  // Picks `count` questions, preferring different concepts, so each student
  // gets a varied set drawn from the bank.
  function drawQuestions(bank, count, seed) {
    const shuffled = Util.seededShuffle(bank, seed);
    const picked = [];
    const concepts = new Set();
    shuffled.forEach((question) => {
      if (picked.length < count && !concepts.has(question.concept)) {
        picked.push(question);
        concepts.add(question.concept);
      }
    });
    shuffled.forEach((question) => {
      if (picked.length < count && !picked.includes(question)) {
        picked.push(question);
      }
    });
    return picked.map((question) => question.id);
  }

  function validSelection(ids, bank, count) {
    return Array.isArray(ids) &&
      ids.length === count &&
      new Set(ids).size === count &&
      ids.every((id) => bank.some((question) => question.id === id));
  }

  // Draws a new set when the saved one is missing or refers to questions
  // that no longer exist in the bank.
  function ensureSelection(task, bank, count) {
    if (validSelection(task.questionIds, bank, count)) {
      return;
    }
    task.seed = task.seed || Util.createSeed();
    task.questionIds = drawQuestions(bank, count, task.seed);
    task.index = 0;
    task.answers = {};
  }

  function selectedQuestions(task, bank) {
    return task.questionIds.map((id) => bank.find((question) => question.id === id));
  }

  // Display order of the options, shuffled per student and per question.
  function orderedOptions(question, seed) {
    return Util.seededShuffle(question.options, ((seed + Util.hashString(question.id)) % 2147483646) + 1);
  }

  H5P.MagnetismoTransporte.Quiz = {
    drawQuestions,
    validSelection,
    ensureSelection,
    selectedQuestions,
    orderedOptions
  };
})(window.H5P = window.H5P || {});
