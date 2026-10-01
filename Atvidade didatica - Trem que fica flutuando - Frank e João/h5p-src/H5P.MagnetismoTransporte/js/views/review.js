(function (H5P) {
  'use strict';

  /* "Revisão estendida" tab: one card per topic (REVIEW_SECTIONS), with the
   * concepts the student missed most at the top. Opens when the last page
   * (PAGE_COUNT, the results panel) is unlocked, or always with
   * behaviour.reviewAlwaysOpen. */

  const ns = H5P.MagnetismoTransporte;
  const { escapeHtml } = ns.Util;
  const L = ns.I18n.L;
  const { CONCEPTS, REVIEW_SECTIONS, LINKS, PNLD_PORTAL, PNLD_PROGRAM } = ns.Content;

  function linkHtml(key) {
    const link = LINKS[key];
    return link ? `<li><a href="${escapeHtml(link.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(link.label)} ↗<span class="mt-sr-only">${L(' (nova aba)', ' (new tab)', ' (pestaña nueva)')}</span></a></li>` : '';
  }

  function sectionHtml(section, index) {
    return `
      <article class="mt-card mt-rsec" id="mt-review-${escapeHtml(section.id)}" aria-labelledby="mt-rsec-${escapeHtml(section.id)}">
        <div class="mt-rsec__head">
          <span class="mt-rsec__num" aria-hidden="true">${index + 1}</span>
          <h2 id="mt-rsec-${escapeHtml(section.id)}" tabindex="-1">${escapeHtml(section.title)}</h2>
        </div>
        <p class="mt-rsec__summary">${escapeHtml(section.summary)}</p>
        <div class="mt-prose">${section.body.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join('')}</div>
        <div class="mt-rsec__boxes">
          <div class="mt-rsec__box"><strong>${L('No dia a dia', 'In everyday life', 'En la vida cotidiana')}</strong><p>${escapeHtml(section.example)}</p></div>
          <div class="mt-rsec__box"><strong>${L('No seu livro', 'In your textbook', 'En tu libro')}</strong><p>${escapeHtml(section.book)}</p></div>
        </div>
        <div class="mt-rsec__foot">
          ${section.links.length ? `<ul class="mt-rsec__links">${section.links.map(linkHtml).join('')}</ul>` : '<span></span>'}
          <button type="button" class="mt-link" data-action="review-page" data-page-target="${section.page}">${L(`Ver na missão (página ${section.page})`, `See it in the mission (page ${section.page})`, `Verlo en la misión (página ${section.page})`)}</button>
        </div>
      </article>
    `;
  }

  // `priorities`: concept ids ranked by number of mistakes.
  function render(target, priorities) {
    target.innerHTML = `
      <header class="mt-page__header">
        <div class="mt-page__kicker"><span>${L('Revisão estendida', 'Extended review', 'Revisión ampliada')}</span><span class="mt-badge">${L('Para estudar e conferir', 'To study and check', 'Para estudiar y repasar')}</span></div>
        <h1 tabindex="-1">${L('Revise com calma', 'Review at your own pace', 'Repasa con calma')}</h1>
        <p class="mt-lead">${L('Explicações curtas sobre cada tema da missão, alinhadas aos capítulos de Magnetismo e Eletromagnetismo do seu livro de Física, com simulações para explorar.', 'Short explanations of each topic of the mission, aligned with the Magnetism and Electromagnetism chapters of your Physics textbook, with simulations to explore.', 'Explicaciones breves sobre cada tema de la misión, alineadas con los capítulos de Magnetismo y Electromagnetismo de tu libro de Física, con simulaciones para explorar.')}</p>
      </header>
      <div class="mt-grid mt-grid--2">
        <section class="mt-card mt-card--tint" aria-labelledby="mt-review-start">
          <h2 id="mt-review-start">${L('Comece por aqui', 'Start here', 'Empieza por aquí')}</h2>
          ${priorities.length ? `
            <p class="mt-muted mt-small">${L('Temas em que você mais errou durante a missão:', 'Topics you missed most during the mission:', 'Temas en los que más te equivocaste durante la misión:')}</p>
            <ol class="mt-priority-list">
              ${priorities.map((id) => `<li><button type="button" class="mt-link" data-action="review-jump" data-section="${escapeHtml(CONCEPTS[id].review)}">${escapeHtml(CONCEPTS[id].label)}</button></li>`).join('')}
            </ol>`
            : `<p class="mt-muted">${L('Você não registrou erros nas atividades. Use os temas abaixo para aprofundar o que aprendeu.', 'You made no mistakes in the activities. Use the topics below to go deeper into what you learned.', 'No has cometido errores en las actividades. Usa los temas siguientes para profundizar en lo que aprendiste.')}</p>`}
        </section>
        <section class="mt-card" aria-labelledby="mt-review-book">
          <h2 id="mt-review-book"><span aria-hidden="true">📘</span> ${L('Seu livro de Física', 'Your Physics textbook', 'Tu libro de Física')}</h2>
          <p>${L('Os livros do PNLD também estão em versão digital no', 'PNLD textbooks (Brazil) are also available in digital form on the', 'Los libros del PNLD también están en versión digital en el')} <a href="${escapeHtml(PNLD_PORTAL)}" target="_blank" rel="noopener noreferrer">${L('Portal do Livro Digital do FNDE', 'FNDE Digital Book Portal', 'Portal del Libro Digital del FNDE')} ↗</a>${L(', com login gov.br. Em cada tema abaixo, a linha "No seu livro" indica o que procurar no sumário.', ', with a gov.br login (in Portuguese). In each topic below, the "In your textbook" line tells you what to look for in the table of contents.', ', con acceso a gov.br (en portugués). En cada tema de abajo, la línea "En tu libro" te indica qué buscar en el índice.')}</p>
          <p class="mt-small mt-muted">${L('Saiba mais sobre o', 'Learn more about the', 'Más información sobre el')} <a href="${escapeHtml(PNLD_PROGRAM)}" target="_blank" rel="noopener noreferrer">${L('Programa Nacional do Livro e do Material Didático', 'National Textbook and Teaching Material Program', 'Programa Nacional del Libro y del Material Didáctico')} ↗</a>.</p>
        </section>
      </div>
      <nav class="mt-card mt-toc" aria-label="${L('Temas da revisão', 'Review topics', 'Temas de la revisión')}">
        <h2>${L('Temas', 'Topics', 'Temas')}</h2>
        <ol>
          ${REVIEW_SECTIONS.map((section, index) => `<li><button type="button" class="mt-toc__item ${priorities.some((id) => CONCEPTS[id].review === section.id) ? 'is-priority' : ''}" data-action="review-jump" data-section="${escapeHtml(section.id)}"><span>${index + 1}</span>${escapeHtml(section.title)}</button></li>`).join('')}
        </ol>
      </nav>
      ${REVIEW_SECTIONS.map(sectionHtml).join('')}
      <div class="mt-card__foot mt-card__foot--end">
        <button type="button" class="mt-btn mt-btn--secondary" data-action="view" data-view="mission">← ${L('Voltar para a missão', 'Back to the mission', 'Volver a la misión')}</button>
      </div>
    `;
  }

  function scrollTo(target, sectionId) {
    const article = target.querySelector(`#mt-review-${CSS.escape(String(sectionId || ''))}`);
    if (!article) {
      return;
    }
    article.scrollIntoView({ block: 'start', behavior: 'smooth' });
    const heading = article.querySelector('h2');
    if (heading) {
      heading.focus({ preventScroll: true });
    }
  }

  ns.Review = { render, scrollTo };
})(window.H5P = window.H5P || {});
