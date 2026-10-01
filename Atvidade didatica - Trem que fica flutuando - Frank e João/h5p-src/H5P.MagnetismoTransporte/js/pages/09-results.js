(function (H5P) {
  'use strict';

  /* Page 9 — results: total score, score per activity and the concepts the
   * student missed most, with shortcuts to the extended review. */

  const ns = H5P.MagnetismoTransporte;
  const { escapeHtml, getPercent, formatTimestamp } = ns.Util;
  const { I18n } = ns;
  const L = I18n.L;
  const { ACTIVITIES, TOTAL_MAX, ids: ACTIVITY_IDS } = ns.Activities;
  const { CONCEPTS, REVIEW_SECTIONS } = ns.Content;
  const REVIEW_BY_ID = REVIEW_SECTIONS.reduce((map, section) => {
    map[section.id] = section;
    return map;
  }, {});

  // Memory is scored as hits/tries, so totals can carry decimals.
  function formatScore(value) {
    return Number(value).toLocaleString(I18n.get(), { maximumFractionDigits: 2 });
  }

  // "6 acertos em 9 tentativas", when the activity recorded those counts.
  function hitsSummary(result) {
    const detail = result && Array.isArray(result.details) ? result.details[0] : null;
    if (!detail || !Number.isFinite(Number(detail.tentativas)) || Number(detail.tentativas) <= 0) {
      return '';
    }
    return L(` · ${Number(detail.acertos)} acertos em ${Number(detail.tentativas)} tentativas`, ` · ${Number(detail.acertos)} hits in ${Number(detail.tentativas)} tries`, ` · ${Number(detail.acertos)} aciertos en ${Number(detail.tentativas)} intentos`);
  }

  function render(app, section) {
    const graded = app.state.graded;
    const completed = ACTIVITY_IDS.filter((id) => graded[id]);
    const total = completed.reduce((sum, id) => sum + Number(graded[id].pontuacaoObtida), 0);
    const allComplete = completed.length === ACTIVITY_IDS.length;
    const percentage = getPercent(total, TOTAL_MAX);
    const priorities = app.rankedConceptErrors().slice(0, 3);
    const message = percentage >= 90 ? L('Excelente! Você domina a física do trem que flutua.', 'Excellent! You have mastered the physics of the floating train.', '¡Excelente! Dominas la física del tren que flota.')
      : percentage >= 70 ? L('Muito bem! Revise os conceitos destacados para fechar as lacunas.', 'Very good! Review the highlighted concepts to close the gaps.', '¡Muy bien! Repasa los conceptos destacados para cerrar los huecos.')
        : percentage >= 50 ? L('Bom começo. Vale revisar os conceitos destacados abaixo.', 'Good start. It is worth reviewing the highlighted concepts below.', 'Buen comienzo. Vale la pena repasar los conceptos destacados abajo.')
          : L('Vale a pena revisar as páginas indicadas e tentar de novo.', 'It is worth reviewing the suggested pages and trying again.', 'Vale la pena repasar las páginas indicadas e intentarlo de nuevo.');

    section.innerHTML = `
      ${app.heading(page.id, allComplete ? L('Missão cumprida! Veja seu desempenho e o que vale revisar.', 'Mission accomplished! See how you did and what is worth reviewing.', '¡Misión cumplida! Mira tu rendimiento y lo que conviene repasar.') : L('Resultado parcial das atividades registradas até agora.', 'Partial result of the activities recorded so far.', 'Resultado parcial de las actividades registradas hasta ahora.'))}
      <section class="mt-score-hero ${allComplete ? 'is-complete' : ''}" aria-labelledby="total-score-title">
        <div class="mt-ring mt-ring--lg" style="--p:${percentage}"><span><strong>${formatScore(total)}</strong>/${TOTAL_MAX}</span></div>
        <div>
          <span class="mt-eyebrow mt-eyebrow--light">${allComplete ? L('Resultado final', 'Final result', 'Resultado final') : L('Resultado parcial', 'Partial result', 'Resultado parcial')}</span>
          <h2 id="total-score-title" tabindex="-1">${L(`${percentage}% de aproveitamento`, `${percentage}% score`, `${percentage}% de aprovechamiento`)}</h2>
          <p>${allComplete ? message : L(`${completed.length} de ${ACTIVITY_IDS.length} atividades avaliativas concluídas.`, `${completed.length} of ${ACTIVITY_IDS.length} graded activities completed.`, `${completed.length} de ${ACTIVITY_IDS.length} actividades evaluativas completadas.`)}</p>
        </div>
      </section>
      <div class="mt-grid mt-grid--2">
        <section class="mt-card" aria-labelledby="activity-results-title">
          <h2 id="activity-results-title">${L('Desempenho por atividade', 'Score by activity', 'Rendimiento por actividad')}</h2>
          <div class="mt-bars">
            ${ACTIVITY_IDS.map((id) => {
              const meta = ACTIVITIES[id];
              const result = graded[id];
              const score = result ? Number(result.pontuacaoObtida) : 0;
              const percent = getPercent(score, meta.max);
              return `
                <article class="mt-barrow">
                  <div class="mt-barrow__head">
                    <div><strong>${escapeHtml(meta.label)}</strong><span>${escapeHtml(meta.description)} · ${L('pág.', 'p.', 'pág.')} ${meta.page}</span></div>
                    <b>${formatScore(score)}/${meta.max}</b>
                  </div>
                  <div class="mt-bar ${percent === 100 ? 'is-full' : percent < 50 ? 'is-low' : ''}" role="progressbar" aria-label="${escapeHtml(meta.label)}" aria-valuemin="0" aria-valuemax="${meta.max}" aria-valuenow="${score}">
                    <span style="width:${percent}%"></span>
                  </div>
                  <small>${result ? `${L('Registrado em', 'Recorded on', 'Registrado el')} ${escapeHtml(formatTimestamp(result.timestamp))}${hitsSummary(result)}` : L('Ainda não concluída', 'Not completed yet', 'Todavía no completada')}</small>
                </article>
              `;
            }).join('')}
          </div>
        </section>
        <section class="mt-card" aria-labelledby="review-title">
          <h2 id="review-title">${L('O que revisar', 'What to review', 'Qué repasar')}</h2>
          <p class="mt-muted mt-small">${priorities.length
            ? L('Conceitos em que você mais errou, em ordem de prioridade.', 'Concepts you missed most, in order of priority.', 'Conceptos en los que más te equivocaste, por orden de prioridad.')
            : L('Nenhum erro de conceito registrado. Parabéns!', 'No concept mistakes recorded. Congratulations!', 'Ningún error de concepto registrado. ¡Enhorabuena!')}</p>
          <ul class="mt-concepts">
            ${priorities.map((id, index) => {
              const concept = CONCEPTS[id];
              const review = REVIEW_BY_ID[concept.review];
              return `
                <li class="mt-concept is-priority">
                  <span class="mt-concept__rank" aria-hidden="true">${index + 1}</span>
                  <div><h3>${escapeHtml(concept.label)}</h3><p>${escapeHtml(review ? review.summary : '')}</p></div>
                  <button type="button" class="mt-link" data-action="open-review" data-section="${escapeHtml(concept.review)}">${L('Revisar', 'Review', 'Repasar')}<span class="mt-sr-only"> ${escapeHtml(concept.label)}</span></button>
                </li>
              `;
            }).join('')}
          </ul>
          <button type="button" class="mt-btn mt-btn--primary mt-btn--block" data-action="open-review">${L('Abrir a revisão estendida', 'Open the extended review', 'Abrir el repaso ampliado')}</button>
        </section>
      </div>
      <aside class="mt-callout mt-callout--soft">
        ${L(`<strong>Como a nota é calculada:</strong> ${TOTAL_MAX} pontos no total (${ACTIVITY_IDS.map((id) => ACTIVITIES[id].max).join(' + ')}). Vale a primeira conclusão de cada atividade; praticar de novo não altera a nota. O laboratório de ímãs é exploratório e não vale pontos.`,
          `<strong>How the score is calculated:</strong> ${TOTAL_MAX} points in total (${ACTIVITY_IDS.map((id) => ACTIVITIES[id].max).join(' + ')}). The first completion of each activity counts; practicing again does not change the score. The magnet lab is exploratory and is not worth points.`,
          `<strong>Cómo se calcula la nota:</strong> ${TOTAL_MAX} puntos en total (${ACTIVITY_IDS.map((id) => ACTIVITIES[id].max).join(' + ')}). Vale la primera finalización de cada actividad; practicar de nuevo no cambia la nota. El laboratorio de imanes es exploratorio y no vale puntos.`)}
      </aside>
      <div class="mt-card__foot mt-card__foot--end">
        ${app.testMode ? `<button type="button" class="mt-btn mt-btn--secondary" data-action="run-mock">${L('Simular quatro eventos (teste)', 'Simulate four events (test)', 'Simular cuatro eventos (prueba)')}</button>` : ''}
        <button type="button" class="mt-link mt-link--danger" data-action="reset-all">${L('Apagar progresso e recomeçar', 'Erase progress and start over', 'Borrar el progreso y empezar de nuevo')}</button>
      </div>
    `;
  }

  const page = {
    id: 9,
    get short() { return L('Resultados', 'Results', 'Resultados'); },
    get title() { return L('Resultados e resumo', 'Results and summary', 'Resultados y resumen'); },
    unlockHint: '',
    render
  };

  (ns.pages = ns.pages || []).push(page);
})(window.H5P = window.H5P || {});
