(function (H5P) {
  'use strict';

  /* Page 4 — single-choice quiz (4 points). Each student gets
   * SINGLE_COUNT questions drawn from the bank; the first completion is the
   * grade. Correctness always comes from the sealed answer key: the saved
   * "correct" flag is only used for display, never for the score. */

  const ns = H5P.MagnetismoTransporte;
  const { escapeHtml } = ns.Util;
  const { Quiz, UI, I18n } = ns;
  const L = I18n.L;
  const BANK = ns.Bank.singleChoice;
  const COUNT = ns.Activities.SINGLE_COUNT;
  const key = ns.AnswerKey.create(ns.Bank.salt);

  function task(app) {
    return app.state.tasks.singleChoice;
  }

  function questions(app) {
    return Quiz.selectedQuestions(task(app), BANK);
  }

  function isRight(question, choice) {
    return Boolean(choice) && key.open(question.seal, ['single', question.id, choice]) !== null;
  }

  function reveal(question) {
    return key.reveal(question.seal, ['single', question.id], question.options.map((option) => option.id)) || { answer: null, payload: '' };
  }

  // Explanation shown after answering, in the interface language. It is
  // opened from the seal each time (the explanation is the same for right
  // and wrong answers), so switching language also translates old answers.
  function feedbackText(question, answer) {
    if (!answer) {
      return '';
    }
    const explanation = I18n.payload(reveal(question).payload);
    return answer.choice ? explanation : `${L('Questão pulada.', 'Question skipped.', 'Pregunta omitida.')} ${explanation}`.trim();
  }

  function render(app, section) {
    const current = task(app);
    const list = questions(app);
    if (current.complete) {
      const result = app.state.graded.singleChoice;
      const items = list.map((question) => {
        const answer = current.answers[question.id];
        return { text: I18n.field(question, 'question'), correct: Boolean(answer && answer.correct === '1'), feedback: feedbackText(question, answer) };
      });
      section.innerHTML = UI.quizSummary({
        heading: app.heading(page.id, L('A nota abaixo corresponde à primeira tentativa. Você pode praticar de novo sem alterá-la.', 'The score below is from your first attempt. You can practice again without changing it.', 'La nota siguiente corresponde a tu primer intento. Puedes practicar de nuevo sin modificarla.'), '', L('Quiz concluído', 'Quiz complete', 'Quiz completado')),
        activityId: 'singleChoice',
        score: result ? result.pontuacaoObtida : items.filter((item) => item.correct).length,
        items,
        nextLabel: L('Continuar', 'Continue', 'Continuar')
      });
      return;
    }

    const question = list[current.index];
    const options = Quiz.orderedOptions(question, current.seed);
    const answer = current.answers[question.id] || '';
    const checked = Boolean(answer);
    const isCorrect = checked && answer.correct === '1';
    const correctId = checked ? reveal(question).answer : null;

    section.innerHTML = `
      ${app.heading(page.id, L('Cada questão vale 1 ponto. A primeira tentativa é a que conta para a nota.', 'Each question is worth 1 point. Your first attempt is the one that counts.', 'Cada pregunta vale 1 punto. El primer intento es el que cuenta para la nota.'), L('Vale 4 pontos', 'Worth 4 points', 'Vale 4 puntos'))}
      <section class="mt-card mt-quiz">
        ${UI.quizProgress(current.index, list.length, checked)}
        <h2 class="mt-quiz__q">${escapeHtml(I18n.field(question, 'question'))}</h2>
        <fieldset class="mt-choices" ${checked ? 'disabled' : ''}>
          <legend class="mt-sr-only">${L(`Alternativas da questão ${current.index + 1}`, `Options for question ${current.index + 1}`, `Opciones de la pregunta ${current.index + 1}`)}</legend>
          ${options.map((option, index) => `
            <label class="mt-choice mt-choice--lettered ${checked && option.id === correctId ? 'is-correct' : ''} ${checked && answer.choice === option.id && option.id !== correctId ? 'is-wrong' : ''}">
              <input type="radio" name="single-${question.id}" value="${escapeHtml(option.id)}" ${answer.choice === option.id ? 'checked' : ''} ${checked ? 'disabled' : ''}>
              <span class="mt-choice__letter" aria-hidden="true">${'ABCDEF'[index]}</span>
              <span>${escapeHtml(I18n.field(option, 'text'))}</span>
            </label>
          `).join('')}
        </fieldset>
        <div class="mt-card__foot">
          ${UI.answerFeedback('single-feedback', checked, isCorrect, feedbackText(question, answer))}
          ${!checked
            ? `<button type="button" class="mt-btn mt-btn--primary" data-action="check-single">${L('Verificar resposta', 'Check answer', 'Comprobar respuesta')}</button>`
            : `<button type="button" class="mt-btn mt-btn--primary" data-action="next-single">${current.index === list.length - 1 ? L('Concluir quiz', 'Finish quiz', 'Finalizar quiz') : L('Próxima questão →', 'Next question →', 'Siguiente pregunta →')}</button>`}
        </div>
      </section>
    `;
  }

  function check(app) {
    const current = task(app);
    const question = questions(app)[current.index];
    const selected = app.section(page.id).querySelector('input[name^="single-"]:checked');
    if (!selected || !question.options.some((option) => option.id === selected.value)) {
      app.announce(L('Selecione uma alternativa antes de verificar.', 'Select an option before checking.', 'Selecciona una alternativa antes de comprobar.'));
      return;
    }
    const opened = key.open(question.seal, ['single', question.id, selected.value]);
    const correct = opened !== null;
    current.answers[question.id] = {
      choice: selected.value,
      correct: correct ? '1' : '0',
      feedback: I18n.payload(correct ? opened : reveal(question).payload)
    };
    if (!correct) {
      app.recordConceptError(question.concept, 1);
    }
    app.saveState();
    app.render({ focusSelector: '#single-feedback' });
    app.announce(correct ? L('Resposta correta.', 'Correct answer.', 'Respuesta correcta.') : L('Resposta incorreta. Leia a explicação.', 'Wrong answer. Read the explanation.', 'Respuesta incorrecta. Lee la explicación.'));
  }

  function next(app) {
    const current = task(app);
    const list = questions(app);
    if (current.index < list.length - 1) {
      current.index += 1;
      app.saveState();
      app.render({ focusSelector: 'input[type="radio"]' });
      app.announce(L(`Questão ${current.index + 1} de ${list.length}.`, `Question ${current.index + 1} of ${list.length}.`, `Pregunta ${current.index + 1} de ${list.length}.`));
      return;
    }
    const items = list.map((question) => {
      const answer = current.answers[question.id];
      return { id: question.id, concept: question.concept, correct: isRight(question, answer && answer.choice) };
    });
    const score = items.filter((item) => item.correct).length;
    current.complete = true;
    current.attempts += 1;
    app.completeActivity('singleChoice', score, { score, max: COUNT, items });
    app.saveState();
    app.render({ focusSelector: '.mt-summary' });
    app.announce(L(`Quiz concluído com ${score} de ${COUNT} pontos. A próxima página foi liberada.`, `Quiz complete with ${score} of ${COUNT} points. The next page is unlocked.`, `Quiz completado con ${score} de ${COUNT} puntos. La página siguiente está desbloqueada.`));
  }

  const page = {
    id: 4,
    short: 'Quiz',
    get title() { return L('Quatro questões de escolha única', 'Four single-choice questions', 'Cuatro preguntas de opción única'); },
    get unlockHint() { return L('Responda às quatro questões para avançar.', 'Answer the four questions to move on.', 'Responde a las cuatro preguntas para avanzar.'); },
    task: 'singleChoice',
    init(app) {
      Quiz.ensureSelection(task(app), BANK, COUNT);
    },
    // Practising again draws a new set of questions from the bank.
    reset(app) {
      app.state.tasks.singleChoice = ns.Storage.createDefaultState().tasks.singleChoice;
      app.state.tasks.singleChoice.seed = ns.Util.createSeed();
      Quiz.ensureSelection(task(app), BANK, COUNT);
    },
    render,
    actions: {
      'check-single': check,
      'next-single': next
    }
  };

  (ns.pages = ns.pages || []).push(page);
})(window.H5P = window.H5P || {});
