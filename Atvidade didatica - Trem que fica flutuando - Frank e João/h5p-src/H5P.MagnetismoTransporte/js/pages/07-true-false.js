(function (H5P) {
  'use strict';

  /* Page 7 — true or false (5 points). Same rules as page 4: statements
   * drawn per student, first completion is the grade, correctness comes
   * from the sealed answer key. */

  const ns = H5P.MagnetismoTransporte;
  const { escapeHtml } = ns.Util;
  const { Quiz, UI, I18n } = ns;
  const L = I18n.L;
  const BANK = ns.Bank.trueFalse;
  const COUNT = ns.Activities.TRUE_FALSE_COUNT;
  const CHOICES = ['true', 'false'];
  const key = ns.AnswerKey.create(ns.Bank.salt);

  function task(app) {
    return app.state.tasks.trueFalse;
  }

  function questions(app) {
    return Quiz.selectedQuestions(task(app), BANK);
  }

  function isRight(question, choice) {
    return CHOICES.includes(choice) && key.open(question.seal, ['tf', question.id, choice]) !== null;
  }

  function reveal(question) {
    return key.reveal(question.seal, ['tf', question.id], CHOICES) || { answer: null, payload: '' };
  }

  // Correction shown after answering, opened from the seal in the interface
  // language (same text for right and wrong answers).
  function feedbackText(question, answer) {
    if (!answer) {
      return '';
    }
    const correction = I18n.payload(reveal(question).payload);
    return answer.choice ? correction : `${L('Questão pulada.', 'Question skipped.', 'Pregunta omitida.')} ${correction}`.trim();
  }

  function render(app, section) {
    const current = task(app);
    const list = questions(app);
    if (current.complete) {
      const result = app.state.graded.trueFalse;
      const items = list.map((question) => {
        const answer = current.answers[question.id];
        return { text: I18n.field(question, 'statement'), correct: Boolean(answer && answer.correct === 'true'), feedback: feedbackText(question, answer) };
      });
      section.innerHTML = UI.quizSummary({
        heading: app.heading(page.id, L('A nota abaixo corresponde à primeira tentativa. Você pode praticar de novo sem alterá-la.', 'The score below is from your first attempt. You can practice again without changing it.', 'La nota siguiente corresponde a tu primer intento. Puedes practicar de nuevo sin modificarla.'), '', L('Verdadeiro ou falso concluído', 'True or false complete', 'Verdadero o falso completado')),
        activityId: 'trueFalse',
        score: result ? result.pontuacaoObtida : items.filter((item) => item.correct).length,
        items,
        // Just "next page", like page 4's "Continuar". The old label pointed at
        // the results panel, which the essay page (8) now sits in between, so it
        // named the wrong destination.
        nextLabel: L('Próxima página', 'Next page', 'Página siguiente')
      });
      return;
    }

    const question = list[current.index];
    const answer = current.answers[question.id] || '';
    const checked = Boolean(answer);
    const correct = checked && answer.correct === 'true';
    const correctChoice = checked ? reveal(question).answer : null;
    const optionClass = (value) => {
      if (!checked) {
        return '';
      }
      if (value === correctChoice) {
        return 'is-correct';
      }
      return answer.choice === value ? 'is-wrong' : '';
    };

    section.innerHTML = `
      ${app.heading(page.id, L('Leia cada afirmação com atenção. Cada uma vale 1 ponto.', 'Read each statement carefully. Each one is worth 1 point.', 'Lee cada afirmación con atención. Cada una vale 1 punto.'), L('Vale 5 pontos', 'Worth 5 points', 'Vale 5 puntos'))}
      <section class="mt-card mt-quiz">
        ${UI.quizProgress(current.index, list.length, checked)}
        <blockquote class="mt-statement">${escapeHtml(I18n.field(question, 'statement'))}</blockquote>
        <fieldset class="mt-choices mt-choices--tf" ${checked ? 'disabled' : ''}>
          <legend class="mt-sr-only">${L('Escolha verdadeiro ou falso', 'Choose true or false', 'Elige verdadero o falso')}</legend>
          <label class="mt-choice mt-choice--tf ${optionClass('true')}">
            <input type="radio" name="tf-${question.id}" value="true" ${answer.choice === 'true' ? 'checked' : ''} ${checked ? 'disabled' : ''}>
            <span class="mt-choice__tf" aria-hidden="true">${L('V', 'T', 'V')}</span><span>${L('Verdadeiro', 'True', 'Verdadero')}</span>
          </label>
          <label class="mt-choice mt-choice--tf ${optionClass('false')}">
            <input type="radio" name="tf-${question.id}" value="false" ${answer.choice === 'false' ? 'checked' : ''} ${checked ? 'disabled' : ''}>
            <span class="mt-choice__tf" aria-hidden="true">F</span><span>${L('Falso', 'False', 'Falso')}</span>
          </label>
        </fieldset>
        <div class="mt-card__foot">
          ${UI.answerFeedback('tf-feedback', checked, correct, feedbackText(question, answer))}
          ${!checked
            ? `<button type="button" class="mt-btn mt-btn--primary" data-action="check-tf">${L('Verificar', 'Check', 'Comprobar')}</button>`
            : `<button type="button" class="mt-btn mt-btn--primary" data-action="next-tf">${current.index === list.length - 1 ? L('Concluir', 'Finish', 'Finalizar') : L('Próxima afirmação →', 'Next statement →', 'Siguiente afirmación →')}</button>`}
        </div>
      </section>
    `;
  }

  function check(app) {
    const current = task(app);
    const question = questions(app)[current.index];
    const selected = app.section(page.id).querySelector('input[name^="tf-"]:checked');
    if (!selected || !CHOICES.includes(selected.value)) {
      app.announce(L('Escolha Verdadeiro ou Falso antes de verificar.', 'Choose True or False before checking.', 'Elige Verdadero o Falso antes de comprobar.'));
      return;
    }
    const opened = key.open(question.seal, ['tf', question.id, selected.value]);
    const correct = opened !== null;
    current.answers[question.id] = {
      choice: selected.value,
      correct: correct ? 'true' : 'false',
      feedback: I18n.payload(correct ? opened : reveal(question).payload)
    };
    if (!correct) {
      app.recordConceptError(question.concept, 1);
    }
    app.saveState();
    app.render({ focusSelector: '#tf-feedback' });
    app.announce(correct ? L('Resposta correta.', 'Correct answer.', 'Respuesta correcta.') : L('Resposta incorreta. Leia a correção.', 'Wrong answer. Read the correction.', 'Respuesta incorrecta. Lee la corrección.'));
  }

  function next(app) {
    const current = task(app);
    const list = questions(app);
    if (current.index < list.length - 1) {
      current.index += 1;
      app.saveState();
      app.render({ focusSelector: 'input[type="radio"]' });
      app.announce(L(`Afirmação ${current.index + 1} de ${list.length}.`, `Statement ${current.index + 1} of ${list.length}.`, `Afirmación ${current.index + 1} de ${list.length}.`));
      return;
    }
    const items = list.map((question) => {
      const answer = current.answers[question.id];
      return { id: question.id, concept: question.concept, correct: isRight(question, answer && answer.choice) };
    });
    const score = items.filter((item) => item.correct).length;
    current.complete = true;
    current.attempts += 1;
    app.completeActivity('trueFalse', score, { score, max: COUNT, items });
    app.saveState();
    app.render({ focusSelector: '.mt-summary' });
    // Page 7 only says the next page is open, never "your results": the results
    // panel is page 9 and there is an essay in between (page 8).
    app.announce(L(`Verdadeiro ou falso concluído com ${score} de ${COUNT} pontos. A próxima página foi liberada.`, `True or false complete with ${score} of ${COUNT} points. The next page is unlocked.`, `Verdadero o falso completado con ${score} de ${COUNT} puntos. La página siguiente está desbloqueada.`));
  }

  const page = {
    id: 7,
    get short() { return L('V ou F', 'T or F', 'V o F'); },
    get title() { return L('Verdadeiro ou falso', 'True or false', 'Verdadero o falso'); },
    get unlockHint() { return L('Responda às cinco afirmações para avançar.', 'Answer the five statements to move on.', 'Responde a las cinco afirmaciones para avanzar.'); },
    task: 'trueFalse',
    init(app) {
      Quiz.ensureSelection(task(app), BANK, COUNT);
    },
    reset(app) {
      app.state.tasks.trueFalse = ns.Storage.createDefaultState().tasks.trueFalse;
      app.state.tasks.trueFalse.seed = ns.Util.createSeed();
      Quiz.ensureSelection(task(app), BANK, COUNT);
    },
    render,
    actions: {
      'check-tf': check,
      'next-tf': next
    }
  };

  (ns.pages = ns.pages || []).push(page);
})(window.H5P = window.H5P || {});
