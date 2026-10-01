(function (H5P) {
  'use strict';

  /* Reusable markup shared by several pages. Each function returns an HTML
   * string and reads nothing from the controller: pass what it needs.
   * CSS for each component lives in css/components/. */

  const Util = H5P.MagnetismoTransporte.Util;
  const escapeHtml = Util.escapeHtml;
  const L = H5P.MagnetismoTransporte.I18n.L;
  // Read now: js/app.js later replaces the namespace object with the class.
  const SKIP_AFTER_TRIES = H5P.MagnetismoTransporte.Activities.SKIP_AFTER_TRIES;

  function brandIcon() {
    return '<svg viewBox="0 0 32 32" width="26" height="26"><path d="M9 5v9a7 7 0 0 0 14 0V5h-4.5v9a2.5 2.5 0 0 1-5 0V5z" fill="currentColor"/><path d="M9 5h4.5v4H9zm9.5 0H23v4h-4.5z" fill="#ff8a80"/><path d="M5 26h22" stroke="#7dd3fc" stroke-width="2.5" stroke-linecap="round"/></svg>';
  }

  // Flag drawn inline as SVG: no remote images (the package may run
  // offline) and no icon font. Simple shapes, sized for a 22px box.
  function flag(language) {
    const shapes = {
      br: '<rect width="22" height="15" fill="#009c3b"/><path d="M11 1.5 20.5 7.5 11 13.5 1.5 7.5z" fill="#ffdf00"/><circle cx="11" cy="7.5" r="3.1" fill="#002776"/><path d="M8.3 6.4a2.7 2.7 0 0 1 5.4 0" fill="none" stroke="#fff" stroke-width="0.9"/>',
      us: '<g fill="#b22234"><rect width="22" height="1.35"/><rect y="2.7" width="22" height="1.35"/><rect y="5.4" width="22" height="1.35"/><rect y="8.1" width="22" height="1.35"/><rect y="10.8" width="22" height="1.35"/><rect y="13.5" width="22" height="1.5"/></g><rect width="9.5" height="7.7" fill="#3c3b6e"/>',
      es: '<rect width="22" height="15" fill="#c60b1e"/><rect y="3.75" width="22" height="7.5" fill="#ffc400"/><rect x="4" y="6" width="2" height="3" fill="#c60b1e" stroke="#c60b1e" stroke-width="0.4"/>'
    };
    const body = shapes[language && language.flag];
    return body
      ? `<svg class="mt-lang__flag" viewBox="0 0 22 15" width="22" height="15" aria-hidden="true" focusable="false">${body}</svg>`
      : '';
  }

  // Single language button: a globe + the word "Língua" + the flag of the
  // language in use. Clicking opens the list of languages; each option is
  // labelled in its own language, so a student finds theirs by the flag.
  function languageSwitch(languages, current) {
    const active = languages.filter((language) => language.code === current)[0] || languages[0];
    return `
      <div class="mt-lang" data-role="lang">
        <button type="button" class="mt-lang__toggle" data-action="toggle-lang-menu"
          aria-expanded="false" aria-haspopup="true" aria-controls="mt-lang-menu"
          title="${escapeHtml(L('Escolher o idioma', 'Choose the language', 'Elegir el idioma'))}">
          <svg class="mt-lang__globe" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false"><path d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zm0 0c2.5 2.4 3.8 5.4 3.8 9s-1.3 6.6-3.8 9m0-18C9.5 5.4 8.2 8.4 8.2 12s1.3 6.6 3.8 9M3.5 9h17M3.5 15h17" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>
          <span class="mt-lang__label">${L('Língua', 'Language', 'Idioma')}</span>
          ${flag(active)}
        </button>
        <ul class="mt-lang__menu" id="mt-lang-menu" role="menu" hidden>
          ${languages.map((language) => `
            <li role="none">
              <button type="button" class="mt-lang__option" role="menuitemradio" data-action="set-language" data-lang="${escapeHtml(language.code)}"
                lang="${escapeHtml(language.code)}" title="${escapeHtml(language.name)}"
                aria-checked="${language.code === current ? 'true' : 'false'}">
                ${flag(language)}
                <span class="mt-lang__option-name">${escapeHtml(language.name)}</span>
                ${language.code === current ? `<span class="mt-lang__check" aria-hidden="true">✓</span>` : ''}
              </button>
            </li>
          `).join('')}
        </ul>
      </div>
    `;
  }

  // Reminder that the task is below the fold. Purely decorative for a
  // screen reader (aria-hidden): the heading and the nav already announce
  // the page structure, and the arrow would only add noise.
  function scrollHint() {
    return `
      <span class="mt-scrollhint" aria-hidden="true" data-role="scroll-hint">
        <span class="mt-scrollhint__text">${L('Role para baixo para fazer a tarefa', 'Scroll down to do the task', 'Desplázate hacia abajo para hacer la tarea')}</span>
        <svg class="mt-scrollhint__arrow" viewBox="0 0 24 24" width="20" height="20" focusable="false"><path d="M12 4v14m0 0 6-6m-6 6-6-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </span>
    `;
  }

  // Page header: "Página N de M" kicker, optional badge, focusable h1.
  function pageHeading({ page, total, title, subtitle, badge }) {
    return `
      <header class="mt-page__header">
        <div class="mt-page__kicker">
          <span>${L(`Página ${page} de ${total}`, `Page ${page} of ${total}`, `Página ${page} de ${total}`)}</span>
          ${badge ? `<span class="mt-badge">${escapeHtml(badge)}</span>` : ''}
        </div>
        <h1 id="h5p-mt-heading-${page}" tabindex="-1">${escapeHtml(title)}</h1>
        ${subtitle ? `<p class="mt-lead">${escapeHtml(subtitle)}</p>` : ''}
      </header>
    `;
  }

  function getYouTubeId(url) {
    try {
      const parsed = new URL(String(url), window.location.href);
      let id = parsed.searchParams.get('v');
      if (!id && parsed.hostname.includes('youtu.be')) {
        id = parsed.pathname.slice(1);
      }
      if (!id) {
        const match = parsed.pathname.match(/\/(?:embed|shorts)\/([^/?]+)/);
        id = match ? match[1] : '';
      }
      return /^[A-Za-z0-9_-]{6,20}$/.test(id || '') ? id : '';
    } catch (error) {
      return '';
    }
  }

  function getYouTubeEmbedUrl(url, startSeconds, language) {
    const id = getYouTubeId(url);
    if (!id) {
      return '';
    }
    // cc_load_policy/cc_lang_pref: captions on by default, in the interface
    // language. The videos are narrated in Portuguese, so any other language
    // depends on YouTube's automatic caption translation — Spanish is
    // auto-translated from the English track, not from the narration.
    const captions = { 'pt-BR': ['pt-BR', 'pt'], 'en-US': ['en', 'en'], 'es-ES': ['es', 'es'] };
    const [hl, cc] = captions[language] || captions['pt-BR'];
    const parameters = new URLSearchParams({
      rel: '0',
      hl,
      cc_load_policy: '1',
      cc_lang_pref: cc,
      start: String(Util.clamp(startSeconds || 0, 0, 36000))
    });
    return `https://www.youtube-nocookie.com/embed/${id}?${parameters.toString()}`;
  }

  // YouTube facade: nothing is requested from YouTube until the student
  // clicks (action "load-video", handled by the controller).
  // `extra`: markup placed under the caption (audio description panel).
  function videoFacade({ key, url, title, start, description, opened, extra, language }) {
    const embedUrl = getYouTubeEmbedUrl(url, start, language);
    const valid = Boolean(embedUrl);
    const safeTitle = escapeHtml(title || L('Vídeo da atividade', 'Activity video', 'Vídeo de la actividad'));
    const player = opened && valid
      ? `
        <div class="mt-video__frame">
          <iframe src="${escapeHtml(embedUrl)}" title="${safeTitle}" loading="lazy"
            referrerpolicy="strict-origin-when-cross-origin"
            allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowfullscreen></iframe>
        </div>`
      : `
        <button type="button" class="mt-video__poster" data-action="load-video" data-video-target="${escapeHtml(key)}" ${valid ? '' : 'disabled'}>
          <span class="mt-video__play" aria-hidden="true"><svg viewBox="0 0 24 24" width="30" height="30"><path d="M8 5v14l11-7z" fill="currentColor"/></svg></span>
          <span class="mt-video__poster-title">${safeTitle}</span>
          <span class="mt-video__poster-sub">${L('Clique para carregar o vídeo', 'Click to load the video', 'Pulse para cargar el vídeo')}</span>
        </button>`;
    // Opened as file:// the browser sends no Referer, and YouTube refuses to
    // play some embeds. Students never hit this (H5P runs over http/https).
    const fileNotice = window.location.protocol === 'file:'
      ? `<p class="mt-video__notice">${L('Prévia aberta como arquivo: o YouTube pode bloquear este vídeo aqui. Use <code>scripts/preview.ps1</code> para abrir a prévia por http://localhost.', 'Preview opened as a file: YouTube may block this video here. Use <code>scripts/preview.ps1</code> to open the preview over http://localhost.', 'Vista previa abierta como archivo: YouTube puede bloquear este vídeo aquí. Use <code>scripts/preview.ps1</code> para abrir la vista previa por http://localhost.')}</p>`
      : '';
    // Some publishers disable embedding, and YouTube's iframe is
    // cross-origin: it cannot be read, and it posts nothing back, so the
    // failure cannot be detected from here. Some clips (MagLev-Cobra) show
    // only YouTube's own "video unavailable" screen. The way out is always
    // the same — open it on youtube.com — so that link is repeated in the
    // player area, not only in the caption below.
    const fallback = opened && valid
      ? `<p class="mt-video__fallback">${L(
        'O vídeo não carregou? Abra no YouTube.',
        'Video not loading? Open it on YouTube.',
        '¿No se carga el vídeo? Ábrelo en YouTube.'
      )} <a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${L('Abrir no YouTube', 'Open on YouTube', 'Abrir en YouTube')} ↗</a></p>`
      : '';
    return `
      <figure class="mt-video" data-video-key="${escapeHtml(key)}">
        ${player}
        ${fileNotice}
        ${fallback}
        <figcaption>
          <span>${escapeHtml(description || L('Conteúdo em vídeo com texto alternativo disponível na sequência.', 'Video content with a text alternative available below.', 'Contenido en vídeo con una alternativa textual disponible más abajo.'))}</span>
          <a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${L('Abrir no YouTube', 'Open on YouTube', 'Abrir en YouTube')} ↗<span class="mt-sr-only">${L(' (nova aba)', ' (new tab)', ' (pestaña nueva)')}</span></a>
        </figcaption>
        ${extra || ''}
      </figure>
    `;
  }

  // "Pular" button that unlocks after a number of wrong tries. While
  // locked it is disabled and a visible counter says how many tries are
  // left (disabled buttons are not focusable, so the text carries it).
  function skipButton({ action, data, hintId, ready, tries, label, aria, scope }) {
    const needed = SKIP_AFTER_TRIES;
    const where = scope ? ` ${scope}` : '';
    const hint = ready
      ? ''
      : `<span class="mt-skip-hint" id="${escapeHtml(hintId)}">${L(`Pular libera após ${needed} tentativas${where} (${Math.min(tries, needed)}/${needed})`, `Skip unlocks after ${needed} tries${where} (${Math.min(tries, needed)}/${needed})`, `Saltar se desbloquea tras ${needed} intentos${where} (${Math.min(tries, needed)}/${needed})`)}</span>`;
    return `<button type="button" class="mt-btn mt-btn--secondary" data-action="${escapeHtml(action)}" ${data}
      ${ready ? `aria-label="${escapeHtml(aria)}"` : `disabled aria-describedby="${escapeHtml(hintId)}"`}>${escapeHtml(label)}</button>${hint}`;
  }

  function quizProgress(index, total, checked) {
    return `
      <div class="mt-qprogress">
        <span>${L(`Questão ${index + 1} de ${total}`, `Question ${index + 1} of ${total}`, `Pregunta ${index + 1} de ${total}`)}</span>
        <div class="mt-qprogress__dots" aria-hidden="true">${Array.from({ length: total }, (_, i) => `<span class="${i < index || (i === index && checked) ? 'is-done' : i === index ? 'is-current' : ''}"></span>`).join('')}</div>
      </div>
    `;
  }

  // Feedback paragraph under a question ("Correto!" / "Não foi dessa vez.").
  function answerFeedback(id, checked, correct, text) {
    return `
      <p id="${id}" class="mt-feedback ${checked ? (correct ? 'is-success' : 'is-error') : ''}" role="status" tabindex="-1">
        ${checked ? `<strong>${correct ? L('Correto!', 'Correct!', '¡Correcto!') : L('Não foi dessa vez.', 'Not this time.', 'Esta vez no.')}</strong> ${escapeHtml(text)}` : ''}
      </p>
    `;
  }

  // Summary shown after a quiz is completed (pages 4 and 7). `items` holds
  // { text, correct, feedback } for each question, in the order answered.
  function quizSummary({ heading, activityId, score, items, nextLabel }) {
    const percent = Util.getPercent(score, items.length);
    return `
      ${heading}
      <section class="mt-card mt-summary" tabindex="-1" aria-labelledby="quiz-summary-title">
        <div class="mt-summary__score">
          <div class="mt-ring" style="--p:${percent}"><span><strong>${score}</strong>/${items.length}</span></div>
          <div>
            <h2 id="quiz-summary-title">${L(`${percent}% de acerto`, `${percent}% correct`, `${percent}% de aciertos`)}</h2>
            <p class="mt-muted">${percent === 100 ? L('Perfeito! Você acertou tudo.', 'Perfect! You got everything right.', '¡Perfecto! Lo ha acertado todo.') : percent >= 60 ? L('Bom trabalho! Revise os itens marcados abaixo.', 'Good job! Review the items marked below.', '¡Buen trabajo! Repase los elementos marcados abajo.') : L('Leia as explicações abaixo com calma antes de seguir.', 'Read the explanations below carefully before moving on.', 'Lea con calma las explicaciones de abajo antes de continuar.')}</p>
          </div>
        </div>
        <ol class="mt-review">
          ${items.map((item) => `<li class="${item.correct ? 'is-correct' : 'is-wrong'}"><span class="mt-review__mark" aria-hidden="true">${item.correct ? '✓' : '✕'}</span><div><strong>${item.correct ? L('Acertou', 'Correct', 'Acerto') : L('Revisar', 'Review', 'Repasar')}:</strong> ${escapeHtml(item.text)}<span>${escapeHtml(item.feedback)}</span></div></li>`).join('')}
        </ol>
        <div class="mt-card__foot mt-card__foot--end">
          <button type="button" class="mt-btn mt-btn--secondary" data-action="reset-task" data-task="${escapeHtml(activityId)}">${L('Praticar novamente', 'Practice again', 'Practicar de nuevo')}</button>
          <button type="button" class="mt-btn mt-btn--primary" data-action="next-page">${escapeHtml(nextLabel)} →</button>
        </div>
      </section>
    `;
  }

  H5P.MagnetismoTransporte.UI = {
    brandIcon,
    flag,
    languageSwitch,
    scrollHint,
    pageHeading,
    skipButton,
    videoFacade,
    quizProgress,
    answerFeedback,
    quizSummary
  };
})(window.H5P = window.H5P || {});
