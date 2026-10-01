(function (H5P) {
  'use strict';

  /* Page 8 — open-ended question (5 points, graded by concept).
   *
   * The student writes a short answer; js/core/essay.js grades it
   * deterministically, offline, with no similarity shortcut: concept coverage
   * + relation chain, capped by contradictions and by any missing required
   * concept. The rubric's reference answers and per-concept feedback stay
   * sealed in bank.js; only the accepted terms travel to the browser, which
   * is unavoidable for offline grading (docs/questoes-dissertativas-viabilidade.md).
   *
   * Security: the student's own text is never written into innerHTML. It goes
   * back to the textarea through the value property, and the feedback is built
   * from rubric ids, never from the answer. */

  const ns = H5P.MagnetismoTransporte;
  const { escapeHtml } = ns.Util;
  const { I18n } = ns;
  const L = I18n.L;
  const { UI } = ns;
  const key = ns.AnswerKey.create(ns.Bank.salt);
  const MIN_CHARS = 30;
  const MAX_CHARS = 2000;
  const ESSAY_MAX = ns.Activities.ACTIVITIES.essay.max;

  const RUBRIC = ns.Bank.essay;

  function section(app) {
    return app.section(page.id);
  }

  function characterCount(app) {
    return String(app.state.tasks.essay.text || '').length;
  }

  function canSubmit(app) {
    return Boolean(RUBRIC) && characterCount(app) >= MIN_CHARS;
  }

  /* ------------------------------ markup ------------------------------ */

  function statusTag(status) {
    if (status === 'correct') {
      return `<span class="mt-essay__tag is-ok">${L('✓ presente', '✓ present', '✓ presente')}</span>`;
    }
    if (status === 'partial') {
      return `<span class="mt-essay__tag is-part">${L('~ parcial', '~ partial', '~ parcial')}</span>`;
    }
    return `<span class="mt-essay__tag is-missing">${L('✕ não encontrado', '✕ not found', '✕ no encontrado')}</span>`;
  }

  function feedbackHtml(app) {
    const result = app.state.tasks.essay.evaluated;
    if (!result) {
      return '';
    }
    const rubric = RUBRIC;
    // The stored verdict is a whitelist-rebuilt copy (storage.js
    // sanitizeEvaluation) that keeps ids but not seals, so the feedback text
    // has to come from the live rubric rather than from the saved record.
    const findConcept = (id) => (rubric.concepts || []).filter((c) => c.id === id)[0];
    const textFor = (id) => {
      const concept = findConcept(id);
      if (!concept) {
        return '';
      }
      const opened = key.open(concept.seal, ['essay', rubric.id, id]);
      // open() returns the payload with the "ok|" marker already removed; the
      // strip is a safety net for a seal written by an older generator.
      return opened === null ? '' : I18n.stripMark(I18n.payload(opened));
    };
    // The status comes from the saved verdict (whitelisted on the way in), the
    // label and the feedback text from the live rubric: the stored copy keeps
    // ids only, because the seals must never enter localStorage.
    const statusOf = (id) => {
      const found = (result.concepts || []).filter((c) => c.id === id)[0];
      return found ? found.status : 'missing';
    };
    // Every rubric concept is listed, in rubric order, so the student sees what
    // was recognised AND what was not. Deriving it from the rubric rather than
    // from strengths/improvements keeps the list stable across reloads.
    const conceptList = (rubric.concepts || []).map((c) => ({ id: c.id, status: statusOf(c.id) }));
    const item = (id, tone) => {
      const concept = findConcept(id);
      const opened = textFor(id);
      if (!concept) {
        return '';
      }
      const label = escapeHtml(I18n.field(concept, 'label'));
      const tag = statusTag(statusOf(id));
      return `
        <li class="mt-essay__item ${tone}">
          <span class="mt-essay__item-label">${label} ${tag}</span>
          <span class="mt-essay__item-text">${escapeHtml(opened)}</span>
        </li>
      `;
    };
    // maxScore comes from the grader result and is not part of what storage.js
    // keeps, so it is taken from the rubric/activity instead of trusting it.
    const score = Math.round(Number(result.score) * ESSAY_MAX);
    const confidenceText = result.needsReview
      ? L(
        'Leitura automática com ressalvas: o avaliador reconhece termos e expressões, não o raciocínio. Vale conferir com o professor.',
        'Automatic reading with caveats: the grader recognises terms and expressions, not reasoning. Worth checking with the teacher.',
        'Lectura automática con salvedades: el evaluador reconoce términos y expresiones, no el razonamiento. Conviene comprobarla con el profesor.'
      )
      : L(
        'A leitura automática encontrou todos os conceitos da rubrica.',
        'The automatic reading found every concept in the rubric.',
        'La lectura automática encontró todos los conceptos de la rúbrica.'
      );

    return `
      <section class="mt-card mt-essay__result" tabindex="-1" aria-labelledby="essay-result-title">
        <div class="mt-card__head">
          <h2 id="essay-result-title">${L('O que foi reconhecido na sua resposta', 'What was recognised in your answer', 'Qué se reconoció en tu respuesta')}</h2>
          <span class="mt-chip ${result.needsReview ? '' : 'mt-chip--success'}">${score} / ${ESSAY_MAX}</span>
        </div>
        <p class="mt-muted">${L(
          'A avaliação procurou conceitos e relações científicas na sua resposta. Ela não compara palavras: uma resposta curta pode valer pouco mesmo quoting o enunciado.',
          'The evaluation looked for concepts and scientific relations in your answer. It does not compare words: a short answer can score low even when it repeats the question.',
          'La evaluación buscó conceptos y relaciones científicas en tu respuesta. No compara palabras: una respuesta corta puede puntuar poco aunque repita el enunciado.'
        )}</p>
        <div aria-live="polite">
          <ul class="mt-essay__list">
            ${conceptList.map((entry) => item(entry.id, entry.status === 'missing' ? 'is-missing' : 'is-ok')).join('')}
          </ul>
          ${result.contradictions.length ? `
            <p class="mt-essay__warning"><strong>${L('Ponto que contrasta com a física:', 'Point that contradicts the physics:', 'Punto que contradice la física:')}</strong>
            ${L('a resposta diz que o nitrogênio líquido aquece ou que o efeito Meissner traz o campo para dentro. São os dois ao contrário.',
              'the answer says liquid nitrogen heats things up, or that the Meissner effect pulls the field in. Both are the opposite.',
              'la respuesta dice que el nitrógeno líquido calienta o que el efecto Meissner atrae el campo. Son justo lo contrario.')}</p>
          ` : ''}
          ${result.needsReview ? `<p class="mt-small mt-muted">${escapeHtml(confidenceText)}</p>` : ''}
        </div>
        ${referenceHtml(key, rubric)}
        <div class="mt-card__foot mt-card__foot--end">
          <button type="button" class="mt-btn mt-btn--secondary" data-action="reset-task" data-task="essay">${L('Reescrever', 'Rewrite', 'Reescribir')}</button>
          <button type="button" class="mt-btn mt-btn--primary" data-action="next-page">${L('Ver resultados', 'See results', 'Ver resultados')} →</button>
        </div>
      </section>
    `;
  }

  // The reference answer comes from the live rubric, not from the grader result.
// sanitizeEvaluation() strips it out of what is saved (a sealed payload must
// never reach localStorage), so reading it from `result` worked once and then
// silently vanished after a reload. Opening the seal here is safe: the seal
// exists in the package either way, and this only runs after the student has
// submitted.
  function referenceHtml(key, rubric) {
    if (!rubric || !rubric.references) {
      return '';
    }
    const reference = key.open(rubric.references, ['essay', rubric.id, 'referencias']);
    if (!reference) {
      return '';
    }
    return `
      <details class="mt-details mt-details--flat">
        <summary>${L('Uma resposta de referência', 'A reference answer', 'Una respuesta de referencia')}</summary>
        <p>${escapeHtml(I18n.payload(reference))}</p>
      </details>
    `;
  }

  function render(app, target) {
    const essay = app.state.tasks.essay;
    const ready = canSubmit(app);
    const done = Boolean(essay.evaluated);

    if (!RUBRIC) {
      target.innerHTML = `
        ${app.heading(page.id, L('Questão dissertativa', 'Open-ended question', 'Pregunta disertativa'))}
        <p class="mt-callout mt-callout--soft">${L(
          'Esta questão não está disponível nesta versão do pacote.',
          'This question is not available in this version of the package.',
          'Esta pregunta no está disponible en esta versión del paquete.'
        )}</p>
      `;
      return;
    }

    target.innerHTML = `
      ${app.heading(page.id, L('Responda com as suas palavras. O que o avaliador procura é o raciocínio, não a palavra certa.', 'Answer in your own words. What the grader looks for is the reasoning, not the exact word.', 'Responde con tus propias palabras. Lo que busca el evaluador es el razonamiento, no la palabra exacta.'), L('Dissertativa', 'Open-ended', 'Dissertativa'))}
      <section class="mt-card mt-essay" aria-labelledby="essay-title">
        <div class="mt-card__head">
          <h2 id="essay-title">${L('Explique com as suas palavras', 'Explain in your own words', 'Explica con tus propias palabras')}</h2>
          ${done ? '<span class="mt-chip mt-chip--success">' + L('Resposta enviada', 'Answer submitted', 'Respuesta enviada') + '</span>' : ''}
        </div>
        <p class="mt-question" id="essay-prompt">${escapeHtml(I18n.field(RUBRIC, 'prompt'))}</p>
        <label class="mt-sr-only" for="essay-text">${L('Sua resposta', 'Your answer', 'Tu respuesta')}</label>
        <textarea class="mt-essay__input" id="essay-text" data-role="essay-input" rows="7"
          maxlength="${MAX_CHARS}" ${done ? 'disabled' : ''}
          aria-describedby="essay-hint">${escapeHtml(essay.text || '')}</textarea>
        <p class="mt-small mt-muted" id="essay-hint">
          ${done ? '' : L('Mínimo de 30 caracteres. Quanto mais completa a explicação, mais o avaliador reconhece.', 'At least 30 characters. The more complete the explanation, the more the grader recognises.', 'Mínimo de 30 caracteres. Cuanto más completa sea la explicación, más reconocerá el evaluador.')}
          <span data-role="essay-count">${characterCount(app)} / ${MAX_CHARS}</span>
        </p>
        ${!done ? `
          <div class="mt-card__foot">
            <p id="essay-feedback" class="mt-feedback" role="status" tabindex="-1"></p>
            <button type="button" class="mt-btn mt-btn--primary" data-action="check-essay" ${ready ? '' : 'disabled'}>${L('Avaliar resposta', 'Evaluate answer', 'Evaluar respuesta')}</button>
          </div>
        ` : ''}
      </section>
      ${done ? feedbackHtml(app) : `<aside class="mt-callout mt-callout--soft">
        ${L('<strong>O que conta como boa resposta:</strong> ligar o resfriamento à temperatura baixa, a temperatura baixa à supercondutividade, e a supercondutividade ao efeito Meissner. Faltando qualquer elo obrigatório, a nota máxima fica bloqueada.',
          '<strong>What makes a good answer:</strong> link the cooling to the low temperature, the low temperature to superconductivity, and superconductivity to the Meissner effect. Missing any required link blocks the maximum score.',
          '<strong>Qué hace buena respuesta:</strong> enlazar el enfriamiento con la temperatura baja, la temperatura baja con la superconductividad, y la superconductividad con el efecto Meissner. Si falta un eslabón obligatorio, la nota máxima queda bloqueada.')}
      </aside>`}
      <section class="mt-card">
        <div class="mt-card__head">
          <h2>${L('Como esta nota é calculada', 'How this score is calculated', 'Cómo se calcula esta nota')}</h2>
        </div>
        <p class="mt-muted">${L(
          'A nota vai de 0 a 5 e sai de três sinais: quais conceitos da resposta aparecem, se as relações entre eles se sustentam e se há alguma afirmação que contradiz a física. Ela não é uma similaridade de texto, e não é uma correção automática declarada infalível: o professor continua sendo a referência.',
          'The score runs from 0 to 5 and comes from three signals: which concepts appear, whether the relations between them hold, and whether anything contradicts the physics. It is not a text similarity, and it is not a self-declared infallible grader: the teacher remains the reference.',
          'La nota va de 0 a 5 y sale de tres señales: qué conceptos aparecen, si las relaciones entre ellos se sostienen y si hay alguna afirmación que contradice la física. No es una similitud de texto, ni un corrector automático declarado infalible: el profesor sigue siendo la referencia.'
        )}</p>
      </section>
    `;
  }

  /* ------------------------------ actions ------------------------------ */

  function check(app) {
    const essay = app.state.tasks.essay;
    if (!RUBRIC || essay.submitted) {
      return;
    }
    if (characterCount(app) < MIN_CHARS) {
      const feedback = section(app).querySelector('#essay-feedback');
      if (feedback) {
        feedback.textContent = L(
          `Escreva um pouco mais: ao menos ${MIN_CHARS} caracteres.`,
          `Write a little more: at least ${MIN_CHARS} characters.`,
          `Escribe un poco más: al menos ${MIN_CHARS} caracteres.`
        );
        feedback.focus();
      }
      return;
    }
    const result = ns.Essay.evaluate(RUBRIC, essay.text, key);
    essay.submitted = true;
    essay.evaluated = result;
    essay.attempts += 1;
    const points = Math.round(Number(result.score) * ESSAY_MAX);
    app.completeActivity('essay', points, {
      mode: 'conceitual',
      score: result.score,
      confidence: result.confidence,
      needsReview: result.needsReview,
      conceitos: result.concepts.filter((c) => c.status !== 'missing').length,
      contradicoes: result.contradictions.length
    });
    app.saveState();
    app.render({ focusSelector: '.mt-essay__result' });
    app.resize();
    app.announce(L(
      `Resposta avaliada: ${points} de 5.`,
      `Answer evaluated: ${points} out of 5.`,
      `Respuesta evaluada: ${points} de 5.`
    ));
  }

  const page = {
    id: 8,
    get short() { return L('Dissertativa', 'Dissertativa', 'Dissertativa'); },
    get title() { return L('Dissertativa: por que o nitrogênio líquido?', 'Open-ended: why liquid nitrogen?', 'Dissertativa: ¿por qué el nitrógeno líquido?'); },
    get unlockHint() { return L('Escreva e avalie sua resposta para ver o resultado.', 'Write and evaluate your answer to see the results.', 'Escribe y evalúa tu respuesta para ver los resultados.'); },
    task: 'essay',
    render,
    reset(app) {
      app.state.tasks.essay = ns.Storage.createDefaultState().tasks.essay;
    },
    actions: {
      'check-essay': (app) => check(app)
    },
    events: {
      // "input" (added to PAGE_EVENTS for this page) keeps the counter and the
      // button live as the student types; "change" covers paste-and-blur.
      input(app, event) {
        const field = event.target.closest && event.target.closest('[data-role="essay-input"]');
        if (!field) {
          return;
        }
        // Kept in memory on every keystroke but persisted only on submit, so a
        // half-written answer cannot fill the storage quota.
        app.state.tasks.essay.text = field.value.slice(0, MAX_CHARS);
        const counter = section(app).querySelector('[data-role="essay-count"]');
        if (counter) {
          counter.textContent = `${characterCount(app)} / ${MAX_CHARS}`;
        }
        const button = section(app).querySelector('[data-action="check-essay"]');
        if (button) {
          button.disabled = !canSubmit(app);
        }
      }
    }
  };

  (ns.pages = ns.pages || []).push(page);
})(window.H5P = window.H5P || {});