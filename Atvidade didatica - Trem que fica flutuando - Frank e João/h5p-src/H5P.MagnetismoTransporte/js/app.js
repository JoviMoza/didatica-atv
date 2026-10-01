(function (H5P) {
  'use strict';

  /* Entry point, loaded last. Assembles the page modules (js/pages/*) into
   * the activity shell and exposes the H5P content type.
   *
   * - Controller: state, navigation rules, shell rendering, event
   *   delegation and grading. Page modules receive it as `app`.
   * - MagnetismoTransporte: the public H5P class. It only exposes the H5P
   *   API; the controller lives in a closure, so grading methods are not
   *   reachable from H5P.instances in the browser console.
   *
   * At the end, the H5P.MagnetismoTransporte namespace object (filled by the
   * other scripts) is replaced by the class. The answer key and the sealed
   * bank are not re-exposed. */

  const ns = H5P.MagnetismoTransporte || {};
  // Bank / storage must load BEFORE app.js (library.json order).
  const REQUIRED = ['Util', 'I18n', 'Storage', 'Activities', 'XAPI', 'AnswerKey', 'Essay', 'Quiz', 'Content', 'ParamsEn', 'ParamsEs', 'Bank', 'Physics', 'UI', 'Review', 'Accessibility', 'Themes'];
  const missing = REQUIRED.filter((name) => !ns[name]);
  if (missing.length) {
    throw new Error(`Magnetismo e Transporte: módulos não carregados: ${missing.join(', ')}. Confira a ordem em library.json.`);
  }

  const { Util, I18n, Storage, Activities, XAPI, UI, Review, Accessibility, Themes } = ns;
  const { escapeHtml, clamp } = Util;
  const L = I18n.L;
  const PROJECT_NAME = 'Magnetismo e Transporte';

  const PAGES = (ns.pages || []).slice().sort((a, b) => a.id - b.id);
  if (!PAGES.length || PAGES.some((page, index) => page.id !== index + 1)) {
    throw new Error('Magnetismo e Transporte: páginas ausentes ou fora de ordem (esperado 1..N em js/pages/).');
  }
  const PAGE_COUNT = PAGES.length;

  // Actions reachable from any page (data-action="…" on a button).
  const GLOBAL_ACTIONS = {
    'previous-page': (app) => app.showPage(app.state.currentPage - 1, { focus: true }),
    'next-page': (app) => app.showPage(app.state.currentPage + 1, { focus: true }),
    resume: (app) => app.showPage(app.state.unlockedPage, { focus: true }),
    view: (app, trigger) => app.setView(trigger.dataset.view),
    'open-review': (app, trigger) => app.setView('review', trigger.dataset.section),
    'review-jump': (app, trigger) => Review.scrollTo(app.reviewRoot, trigger.dataset.section),
    'review-page': (app, trigger) => {
      app.setView('mission');
      app.showPage(Number(trigger.dataset.pageTarget), { focus: true });
    },
    'load-video': (app, trigger) => app.loadVideo(trigger.dataset.videoTarget),
    'reset-task': (app, trigger) => app.resetTask(trigger.dataset.task),
    'reset-all': (app) => app.resetAll(),
    'open-libras': (app, trigger) => app.openLibras(trigger),
    'set-language': (app, trigger) => app.setLanguage(trigger.dataset.lang),
    'toggle-lang-menu': (app, trigger) => app.toggleLanguageMenu(trigger),
    'toggle-theme-menu': (app) => app.toggleThemeMenu(),
    'set-theme': (app, trigger) => app.setTheme(trigger.dataset.theme),
    'toggle-description': (app, trigger) => app.toggleDescription(trigger),
    'speak-description': (app, trigger) => app.speakDescription(trigger),
    'unlock-all': (app) => app.unlockAllForTesting(),
    'run-mock': (app) => app.runMock()
  };

  const ACTIONS = PAGES.reduce((map, page) => {
    Object.keys(page.actions || {}).forEach((name) => {
      if (map[name]) {
        throw new Error(`Magnetismo e Transporte: ação "${name}" definida duas vezes.`);
      }
      map[name] = page.actions[name];
    });
    return map;
  }, Object.assign({}, GLOBAL_ACTIONS));

  // DOM events forwarded to the current page module (page.events[type]).
  // `input` is included so a textarea can report as the student types; the
  // pages that do not care simply do not define it.
  const PAGE_EVENTS = ['change', 'input', 'keydown', 'keyup', 'dragstart', 'dragover', 'dragleave', 'drop', 'pointerdown', 'pointermove', 'pointerup', 'pointercancel'];

  class Controller {
    constructor(host, params, contentId) {
      this.host = host;
      this.params = params || {};
      this.contentId = contentId;
      this.activityStartTime = Date.now();
      this.timers = new Set();
      this.frames = new Set();
      this.destroyed = false;
      this.justUnlocked = false;
      this.unlockAll = false;
      // Transient UI state of the pages (selected word, drag in progress…);
      // never saved.
      this.ui = {};

      const behaviour = this.params.behaviour || {};
      const query = new URLSearchParams(window.location.search);
      // Test tools: enabled by the teacher in the editor, or with ?mock=1
      // in the local developer preview only (never in a real H5P embed).
      this.testMode = Boolean(
        behaviour.showMockButton ||
        (contentId === 'developer-preview' && (query.get('mock') === '1' || query.get('maglevMock') === '1'))
      );

      this.store = new Storage.StorageAdapter(behaviour.storageKey, contentId);
      this.state = this.store.load();
      // Saved choice of the student first, then the editor default.
      this.state.language = I18n.set(this.state.language || behaviour.language);
      // Visual theme: a saved choice of the student, or the original design.
      this.state.theme = Themes.isSupported(this.state.theme) ? this.state.theme : '';
      this.view = 'mission';
      this.initPages();
      this.refreshUnlocks();
      this.justUnlocked = false;
    }

    initPages() {
      PAGES.forEach((page) => {
        if (page.init) {
          page.init(this);
        }
      });
    }

    attach(element) {
      const node = element && element.jquery ? element[0] : element;
      if (!node) {
        return;
      }
      this.container = node;
      this.renderShell();
    }

    destroy() {
      this.destroyed = true;
      Accessibility.stopSpeech();
      this.timers.forEach((timer) => window.clearTimeout(timer));
      this.timers.clear();
      this.frames.forEach((frame) => window.cancelAnimationFrame(frame));
      this.frames.clear();
      this.unbindScrollHint();
      if (this.container) {
        this.container.innerHTML = '';
      }
    }

    /* ------------------------- services for pages ------------------------- */

    /* Editor texts (content.json) only exist in Portuguese. The other two
     * languages come from js/data/params-<lang>.js; a field missing there
     * falls back to the Portuguese original, never to the other translation. */
    translation() {
      if (I18n.isEnglish()) {
        return ns.ParamsEn || {};
      }
      if (I18n.isSpanish()) {
        return ns.ParamsEs || {};
      }
      return {};
    }

    text(name) {
      const translated = this.translation()[name];
      return translated === undefined || translated === null || translated === '' ? this.params[name] : translated;
    }

    title() {
      return this.text('title') || PROJECT_NAME;
    }

    // Video URLs always come from the editor; titles and descriptions follow
    // the interface language.
    media() {
      const media = this.params.media || {};
      const translated = (this.translation().media) || {};
      return Object.assign({}, media, translated);
    }

    allowRetry() {
      return !this.params.behaviour || this.params.behaviour.allowRetry !== false;
    }

    section(pageId) {
      return this.sections ? this.sections[pageId - 1] : null;
    }

    heading(pageId, subtitle, badge, title) {
      return UI.pageHeading({
        page: pageId,
        total: PAGE_COUNT,
        title: title || PAGES[pageId - 1].title,
        subtitle,
        badge
      });
    }

    // The audio description comes from media.<key>VideoDescription (editable
    // in the H5P editor); its panel open state lives in app.ui.
    video(key, url, title, start, description) {
      const descriptions = this.ui.descriptions || {};
      const extra = Accessibility.descriptionPanel({
        key,
        title: title || L('Vídeo da atividade', 'Activity video', 'Vídeo de la actividad'),
        text: this.media()[`${key}VideoDescription`],
        open: Boolean(descriptions[key])
      });
      return UI.videoFacade({
        key,
        url,
        title,
        start,
        description,
        extra,
        opened: Boolean(this.state.videos[key]),
        // getYouTubeEmbedUrl() picks the caption language from this. Passing it
        // here is what makes Spanish students get Spanish captions; omitting it
        // silently fell back to pt-BR, because the videos are narrated in
        // Portuguese and the URL looked plausible.
        language: I18n.get()
      });
    }

    // requestAnimationFrame that is cancelled on destroy().
    frame(callback) {
      const id = window.requestAnimationFrame(() => {
        this.frames.delete(id);
        if (!this.destroyed) {
          callback();
        }
      });
      this.frames.add(id);
      return id;
    }

    resize() {
      this.frame(() => {
        try {
          this.host.trigger('resize');
        } catch (error) {
          // Preview fallback has no H5P resize listener.
        }
      });
    }

    announce(message) {
      if (!this.liveRegion) {
        return;
      }
      this.liveRegion.textContent = '';
      const timer = window.setTimeout(() => {
        this.liveRegion.textContent = message;
        this.timers.delete(timer);
      }, 20);
      this.timers.add(timer);
    }

    saveState() {
      this.refreshUnlocks();
      const saved = this.store.save(this.state);
      this.updateStorageWarning();
      return saved;
    }

    recordConceptError(concept, amount) {
      if (!concept) {
        return;
      }
      this.state.conceptErrors[concept] = Number(this.state.conceptErrors[concept] || 0) + (Number(amount) || 1);
    }

    rankedConceptErrors() {
      return Object.entries(this.state.conceptErrors)
        .filter(([id, value]) => ns.Content.CONCEPTS[id] && Number(value) > 0)
        .sort((a, b) => Number(b[1]) - Number(a[1]))
        .map(([id]) => id);
    }

    assetPath(relativePath) {
      if (H5P.getPath && this.contentId && this.contentId !== 'developer-preview') {
        try {
          return H5P.getPath(relativePath, this.contentId);
        } catch (error) {
          // Authoring preview fallback below.
        }
      }
      return `../h5p-src/content/${relativePath}`;
    }

    /* -------------------------- navigation rules -------------------------- */

    // A page can be left forward only when its requirement is met. Graded
    // pages use the persisted first result, so "Praticar novamente" never
    // locks pages the student already earned. Reading pages (1 and 6) only
    // require being on the page: the page 6 video is not required, and this
    // is deliberately not announced to students.
    canLeavePage(pageId) {
      const page = PAGES[pageId - 1];
      if (page.canLeave) {
        return page.canLeave(this);
      }
      if (page.task) {
        return Boolean(this.state.graded[page.task]);
      }
      return this.state.visitedPages.includes(pageId) || pageId === this.state.currentPage;
    }

    // Never re-locks a page.
    refreshUnlocks() {
      let page = this.state.unlockedPage;
      if (this.testMode && this.unlockAll) {
        page = PAGE_COUNT;
      }
      while (page < PAGE_COUNT && this.canLeavePage(page)) {
        page += 1;
      }
      if (page > this.state.unlockedPage) {
        this.state.unlockedPage = page;
        this.justUnlocked = true;
      }
    }

    showPage(pageNumber, options) {
      const settings = options || {};
      const page = clamp(pageNumber, 1, PAGE_COUNT);
      // Students may only move back or up to the furthest page they unlocked.
      if (page > this.state.unlockedPage) {
        this.announce(PAGES[this.state.currentPage - 1].unlockHint || L('Esta página ainda está bloqueada.', 'This page is still locked.', 'Esta página sigue bloqueada.'));
        return;
      }
      this.state.currentPage = page;
      if (!this.state.visitedPages.includes(page)) {
        this.state.visitedPages.push(page);
      }
      this.saveState();
      Accessibility.stopSpeech();
      this.sections.forEach((section, index) => {
        section.hidden = index !== page - 1;
        if (section.hidden) {
          this.stopSection(section);
        }
      });
      PAGES[page - 1].render(this, this.sections[page - 1]);
      this.updateShell();
      if (settings.focus !== false) {
        this.frame(() => {
          const heading = this.sections[page - 1].querySelector('h1');
          if (heading) {
            heading.focus({ preventScroll: true });
          }
          this.root.scrollIntoView({ block: 'start', behavior: 'auto' });
        });
      }
      this.resize();
    }

    // Empties a page that leaves the screen. Hidden sections stay in the DOM,
    // so without this an open YouTube iframe keeps playing in the background.
    // Pages render from state, so showing the page again rebuilds it.
    stopSection(section) {
      if (section && section.firstChild) {
        section.innerHTML = '';
      }
    }

    // Re-renders the current page, optionally focusing an element after.
    render(options) {
      const settings = options || {};
      const page = this.state.currentPage;
      const section = this.sections[page - 1];
      PAGES[page - 1].render(this, section);
      this.updateShell();
      this.resize();
      if (settings.focusSelector) {
        this.frame(() => {
          const target = section.querySelector(settings.focusSelector);
          if (target) {
            target.focus({ preventScroll: false });
          }
        });
      }
    }

    /* ------------------------------- shell ------------------------------- */

    renderShell() {
      this.container.classList.add('h5p-mt-host');
      this.root = document.createElement('div');
      this.root.className = 'h5p-mt';
      this.root.lang = I18n.get();
      Themes.apply(this.state.theme, [this.root, this.container]);
      this.root.innerHTML = `
        <a class="mt-skip" href="#h5p-mt-main">${L('Ir para o conteúdo principal', 'Skip to main content', 'Ir al contenido principal')}</a>
        <header class="mt-top">
          <div class="mt-top__inner">
            <div class="mt-brand">
              <span class="mt-brand__mark" aria-hidden="true">${UI.brandIcon()}</span>
              <div class="mt-brand__text">
                <strong>${escapeHtml(this.title())}</strong>
                <span>${escapeHtml(this.text('subtitle') || L('Missão MagLev · o trem que flutua', 'MagLev Mission · the floating train', 'Misión MagLev · el tren que flota'))}</span>
              </div>
            </div>
<div class="mt-top__tools">
            ${UI.scrollHint()}
            ${UI.languageSwitch(I18n.LANGUAGES, I18n.get())}
              ${this.themesEnabled() ? Themes.button(this.state.theme) : ''}
              ${this.librasEnabled() ? Accessibility.librasButton() : ''}
              <div class="mt-top__meta">
                <span class="mt-top__counter" id="h5p-mt-counter">1 / ${PAGE_COUNT}</span>
                <span class="mt-top__save" id="h5p-mt-save">${L('Progresso salvo', 'Progress saved', 'Progreso guardado')}</span>
              </div>
            </div>
          </div>
          <div class="mt-tabs" role="tablist" aria-label="${L('Seções', 'Sections', 'Secciones')}">
            <button type="button" class="mt-tab" role="tab" data-action="view" data-view="mission" id="h5p-mt-tab-mission" aria-controls="h5p-mt-main">${L('Missão', 'Mission', 'Misión')}</button>
            <button type="button" class="mt-tab" role="tab" data-action="view" data-view="review" id="h5p-mt-tab-review" aria-controls="h5p-mt-review"></button>
          </div>
          <ol class="mt-stepper" style="--mt-pages:${PAGE_COUNT}" aria-label="${L('Progresso da atividade', 'Activity progress', 'Progreso de la actividad')}"></ol>
        </header>
        ${this.testMode ? `
          <div class="mt-devbar" role="region" aria-label="${L('Ferramentas de teste', 'Test tools', 'Herramientas de prueba')}">
            <strong>${L('Modo de teste', 'Test mode', 'Modo de prueba')}</strong>
            <button type="button" class="mt-btn mt-btn--ghost mt-btn--sm" data-action="unlock-all">${L('Desbloquear todas as páginas', 'Unlock all pages', 'Desbloquear todas las páginas')}</button>
            <button type="button" class="mt-btn mt-btn--ghost mt-btn--sm" data-action="run-mock">${L('Simular resultados e xAPI', 'Simulate results and xAPI', 'Simular resultados y xAPI')}</button>
          </div>` : ''}
        <p class="mt-alert mt-alert--warn" data-role="storage-warning" role="status" hidden>
          ${L('Não foi possível salvar o progresso neste navegador. Você ainda pode concluir a atividade, mas recarregar a página pode apagar o estado.', 'Your progress could not be saved in this browser. You can still finish the activity, but reloading the page may erase it.', 'No ha sido posible guardar el progreso en este navegador. Aun así puede completar la actividad, pero recargar la página puede borrarlo.')}
        </p>
        <main id="h5p-mt-main" class="mt-main" tabindex="-1" role="tabpanel" aria-labelledby="h5p-mt-tab-mission"></main>
        <section id="h5p-mt-review" class="mt-main mt-review-view" role="tabpanel" aria-labelledby="h5p-mt-tab-review" hidden></section>
        <footer class="mt-nav">
          <div class="mt-nav__inner">
            <button type="button" class="mt-btn mt-btn--secondary" data-action="previous-page">
              <span aria-hidden="true">←</span> ${L('Anterior', 'Previous', 'Anterior')}
            </button>
            <div class="mt-nav__middle">
              <p class="mt-nav__hint" id="h5p-mt-hint" aria-live="polite"></p>
              <button type="button" class="mt-link" data-action="resume" hidden></button>
            </div>
            <button type="button" class="mt-btn mt-btn--primary" data-action="next-page" aria-describedby="h5p-mt-hint">
              ${L('Próxima', 'Next', 'Siguiente')} <span aria-hidden="true">→</span>
            </button>
          </div>
        </footer>
        <div class="mt-sr-only" data-role="live" aria-live="polite" aria-atomic="true"></div>
      `;
      this.container.replaceChildren(this.root);

      this.main = this.root.querySelector('#h5p-mt-main');
      this.reviewRoot = this.root.querySelector('#h5p-mt-review');
      this.liveRegion = this.root.querySelector('[data-role="live"]');
      this.storageWarning = this.root.querySelector('[data-role="storage-warning"]');
      this.createSections();
      this.bindEvents();
      this.bindScrollHint();
      this.showPage(this.state.currentPage, { focus: false });
      this.updateStorageWarning();
    }

    createSections() {
      this.main.innerHTML = '';
      this.sections = PAGES.map((page) => {
        const section = document.createElement('section');
        section.className = 'mt-page';
        section.id = `h5p-mt-page-${page.id}`;
        section.setAttribute('aria-labelledby', `h5p-mt-heading-${page.id}`);
        section.hidden = true;
        this.main.appendChild(section);
        return section;
      });
    }

    bindEvents() {
      this.root.addEventListener('click', (event) => {
        if (!event.target.closest('.mt-theme')) {
          this.toggleThemeMenu(false);
        }
        if (!event.target.closest('[data-role="lang"]')) {
          this.toggleLanguageMenu(false);
        }
        const trigger = event.target.closest('[data-action]');
        if (!trigger || !this.root.contains(trigger) || trigger.disabled) {
          return;
        }
        const action = ACTIONS[trigger.dataset.action];
        if (action) {
          action(this, trigger, event);
        }
      });
      this.root.addEventListener('keydown', (event) => {
        if (event.key !== 'Escape') {
          return;
        }
        if (event.target.closest('.mt-theme') && this.toggleThemeMenu(false)) {
          event.stopPropagation();
          const themeToggle = this.root.querySelector('[data-action="toggle-theme-menu"]');
          if (themeToggle) {
            themeToggle.focus();
          }
        }
        if (event.target.closest('[data-role="lang"]') && this.toggleLanguageMenu(false)) {
          event.stopPropagation();
          const langToggle = this.root.querySelector('[data-action="toggle-lang-menu"]');
          if (langToggle) {
            langToggle.focus();
          }
        }
      });
      PAGE_EVENTS.forEach((type) => {
        this.root.addEventListener(type, (event) => {
          const page = PAGES[this.state.currentPage - 1];
          if (this.view === 'mission' && page.events && page.events[type]) {
            page.events[type](this, event);
          }
        });
      });
    }

    // The stepper is informative only: it is never clickable.
    renderStepper() {
      const current = this.state.currentPage;
      const unlocked = this.state.unlockedPage;
      const stepper = this.root.querySelector('.mt-stepper');
      stepper.innerHTML = PAGES.map((page) => {
        const done = page.id < unlocked && page.id !== current;
        const status = page.id === current
          ? 'is-current'
          : page.id > unlocked
            ? 'is-locked'
            : done ? 'is-done' : 'is-open';
        const statusText = page.id === current
          ? L('página atual', 'current page', 'página actual')
          : page.id > unlocked ? L('bloqueada', 'locked', 'bloqueada') : L('liberada', 'unlocked', 'desbloqueada');
        const marker = status === 'is-locked'
          ? '<svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true"><path d="M4.5 7V5a3.5 3.5 0 0 1 7 0v2H13v7H3V7zm2 0h3V5a1.5 1.5 0 0 0-3 0z" fill="currentColor"/></svg>'
          : status === 'is-done'
            ? '<svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true"><path d="M6.4 11.6 2.8 8l1.4-1.4 2.2 2.2 5.4-5.4 1.4 1.4z" fill="currentColor"/></svg>'
            : `<span aria-hidden="true">${page.id}</span>`;
        return `
          <li class="mt-step ${status}" ${page.id === current ? 'aria-current="step"' : ''}>
            <span class="mt-step__dot">${marker}</span>
            <span class="mt-step__label">${escapeHtml(page.short)}</span>
            <span class="mt-sr-only">${L('Página', 'Page', 'Página')} ${page.id}, ${escapeHtml(page.short)}: ${statusText}</span>
          </li>
        `;
      }).join('');
    }

    /* --------------------------- scroll hint ---------------------------- */

    /* The hint promises there is a task below the fold, so it must only
     * show when there really is one: it is hidden as soon as the student
     * scrolls, and while the whole page fits on screen. Measuring is cheap
     * and runs on scroll/resize only (not on every frame). */
    bindScrollHint() {
      const hint = this.root.querySelector('[data-role="scroll-hint"]');
      if (!hint) {
        return;
      }
      const sync = () => {
        // 24px of tolerance: a task just below the fold still needs a nudge.
        const room = this.root.scrollHeight - window.innerHeight;
        const scrolled = window.scrollY > 8 || (this.container && this.container.scrollTop > 8);
        hint.hidden = scrolled || room <= 24;
      };
      window.addEventListener('scroll', sync, { passive: true });
      window.addEventListener('resize', sync);
      this.ui.scrollHintSync = sync;
      this.frame(sync);
    }

    unbindScrollHint() {
      const sync = this.ui && this.ui.scrollHintSync;
      if (!sync) {
        return;
      }
      window.removeEventListener('scroll', sync);
      window.removeEventListener('resize', sync);
      this.ui.scrollHintSync = null;
    }

    updateShell() {
      const page = this.state.currentPage;
      const unlocked = this.state.unlockedPage;
      this.renderStepper();
      this.root.querySelector('#h5p-mt-counter').textContent = `${page} / ${PAGE_COUNT}`;

      const previous = this.root.querySelector('[data-action="previous-page"]');
      const next = this.root.querySelector('[data-action="next-page"]');
      const hint = this.root.querySelector('#h5p-mt-hint');
      const resume = this.root.querySelector('[data-action="resume"]');
      previous.disabled = page === 1;
      next.hidden = page === PAGE_COUNT;
      const nextOpen = page + 1 <= unlocked;
      next.disabled = !nextOpen;
      next.classList.toggle('is-ready', nextOpen && this.justUnlocked);

      if (page === PAGE_COUNT) {
        hint.textContent = L('Fim da missão. Use “Anterior” para revisar qualquer página.', 'End of the mission. Use “Previous” to review any page.', 'Fin de la misión. Use “Anterior” para repasar cualquier página.');
      } else if (!nextOpen) {
        hint.innerHTML = `<span aria-hidden="true">🔒</span> ${escapeHtml(PAGES[page - 1].unlockHint || L('Conclua esta página para avançar.', 'Finish this page to move on.', 'Complete esta página para continuar.'))}`;
      } else if (this.justUnlocked) {
        hint.innerHTML = `<span aria-hidden="true">✓</span> ${L('Próxima página liberada!', 'Next page unlocked!', '¡Página siguiente desbloqueada!')}`;
      } else {
        hint.textContent = L(`Página ${page} de ${PAGE_COUNT}`, `Page ${page} of ${PAGE_COUNT}`, `Página ${page} de ${PAGE_COUNT}`);
      }
      hint.classList.toggle('is-locked', !nextOpen && page !== PAGE_COUNT);
      hint.classList.toggle('is-ready', nextOpen && this.justUnlocked);

      const reviewTab = this.root.querySelector('#h5p-mt-tab-review');
      const reviewOpen = this.reviewAvailable();
      const reviewLabel = L('Revisão estendida', 'Extended review', 'Repaso ampliado');
      reviewTab.innerHTML = reviewOpen
        ? reviewLabel
        : `<span aria-hidden="true">🔒</span> ${reviewLabel}<span class="mt-sr-only">${L(
          ` (abre ao terminar a página ${PAGE_COUNT})`,
          ` (opens when you finish page ${PAGE_COUNT})`,
          ` (se abre al terminar la página ${PAGE_COUNT})`
        )}</span>`;
      reviewTab.classList.toggle('is-locked', !reviewOpen);
      reviewTab.title = reviewOpen ? '' : L(
        `Abre quando você terminar a página ${PAGE_COUNT}`,
        `Opens when you finish page ${PAGE_COUNT}`,
        `Se abre cuando termine la página ${PAGE_COUNT}`
      );
      this.root.querySelectorAll('.mt-tab').forEach((tab) => {
        const active = tab.dataset.view === this.view;
        tab.classList.toggle('is-active', active);
        tab.setAttribute('aria-selected', active ? 'true' : 'false');
      });

      resume.hidden = unlocked - page < 2;
      resume.textContent = L(`Voltar para onde parei (página ${unlocked}) ⇥`, `Back to where I stopped (page ${unlocked}) ⇥`, `Volver donde lo dejé (página ${unlocked}) ⇥`);
      this.justUnlocked = false;
    }

    updateStorageWarning() {
      if (!this.storageWarning) {
        return;
      }
      this.storageWarning.hidden = !this.store.lastError;
      const label = this.root.querySelector('#h5p-mt-save');
      if (label) {
        label.textContent = this.store.lastError ? L('Salvamento indisponível', 'Saving unavailable', 'Guardado no disponible') : L('Progresso salvo', 'Progress saved', 'Progreso guardado');
        label.classList.toggle('is-error', Boolean(this.store.lastError));
      }
    }

    /* ------------------------- extended review tab ------------------------- */

    reviewAvailable() {
      const behaviour = this.params.behaviour || {};
      return Boolean(behaviour.reviewAlwaysOpen) ||
        this.state.unlockedPage >= PAGE_COUNT ||
        Boolean(this.testMode && this.unlockAll);
    }

    setView(view, sectionId) {
      if (view === 'review' && !this.reviewAvailable()) {
        // PAGE_COUNT, not a literal: this is the last page, and the page that
        // unlocks the review is the results panel. A hardcoded number went stale
        // twice — it still said "page 7" after the essay became page 8.
        this.announce(L(
          `A revisão estendida abre quando você terminar a página ${PAGE_COUNT}.`,
          `The extended review opens when you finish page ${PAGE_COUNT}.`,
          `El repaso ampliado se abre cuando termine la página ${PAGE_COUNT}.`
        ));
        return;
      }
      this.view = view === 'review' ? 'review' : 'mission';
      const inReview = this.view === 'review';
      this.main.hidden = inReview;
      this.reviewRoot.hidden = !inReview;
      this.root.querySelector('.mt-stepper').hidden = inReview;
      this.root.querySelector('.mt-nav').hidden = inReview;
      Accessibility.stopSpeech();
      if (inReview) {
        this.stopSection(this.sections[this.state.currentPage - 1]);
        Review.render(this.reviewRoot, this.rankedConceptErrors().slice(0, 3));
      } else {
        PAGES[this.state.currentPage - 1].render(this, this.sections[this.state.currentPage - 1]);
      }
      this.updateShell();
      this.resize();
      this.frame(() => {
        if (inReview && sectionId) {
          Review.scrollTo(this.reviewRoot, sectionId);
          return;
        }
        const heading = (inReview ? this.reviewRoot : this.sections[this.state.currentPage - 1]).querySelector('h1');
        if (heading) {
          heading.focus({ preventScroll: true });
        }
        this.root.scrollIntoView({ block: 'start', behavior: 'auto' });
      });
    }

    /* ------------------------------ actions ------------------------------ */

    loadVideo(key) {
      if (!key || !Object.prototype.hasOwnProperty.call(this.state.videos, key)) {
        return;
      }
      this.state.videos[key] = true;
      this.saveState();
      this.render({ focusSelector: `[data-video-key="${key}"] iframe` });
      this.announce(L('Vídeo carregado. Use os controles do player ou o link para abrir no YouTube.', 'Video loaded. Use the player controls or the link to open it on YouTube.', 'Vídeo cargado. Use los controles del reproductor o el enlace para abrirlo en YouTube.'));
    }

    /* ------------------------------ language ------------------------------ */

    // Language menu, same pattern as the theme menu. Clicking outside or
    // pressing Escape closes it and returns focus to the button.
    toggleLanguageMenu(force) {
      const toggle = this.root && this.root.querySelector('[data-action="toggle-lang-menu"]');
      const menu = this.root && this.root.querySelector('#mt-lang-menu');
      if (!toggle || !menu) {
        return false;
      }
      const open = typeof force === 'boolean' ? force : menu.hidden;
      if (open === !menu.hidden) {
        return false;
      }
      menu.hidden = !open;
      toggle.setAttribute('aria-expanded', String(open));
      if (open) {
        const current = menu.querySelector('[aria-checked="true"]');
        (current || menu.querySelector('button')).focus({ preventScroll: true });
      }
      return true;
    }

    // Rebuilds the whole shell in the new language. Progress is untouched:
    // only state.language changes. Focus returns to the language button.
    setLanguage(code) {
      if (!I18n.isSupported(code)) {
        return;
      }
      const view = this.view;
      const changed = code !== I18n.get();
      Accessibility.stopSpeech();
      this.state.language = I18n.set(code);
      this.ui.descriptions = {};
      if (changed) {
        // renderShell() rebuilds the root, so the fresh hint element needs
        // its own measurement (the window listeners are still bound).
        this.renderShell();
        this.bindScrollHint();
        if (view === 'review') {
          this.setView('review');
        }
      } else {
        this.toggleLanguageMenu(false);
      }
      this.saveState();
      this.frame(() => {
        const toggle = this.root.querySelector('[data-action="toggle-lang-menu"]');
        if (toggle) {
          toggle.focus({ preventScroll: true });
        }
      });
      if (changed) {
        const active = I18n.LANGUAGES.filter((language) => language.code === I18n.get())[0];
        this.announce(L(
          `Idioma alterado para ${active ? active.name : 'português do Brasil'}.`,
          `Language changed to ${active ? active.name : 'Portuguese (Brazil)'}.`,
          `Idioma cambiado a ${active ? active.name : 'portugués (Brasil)'}.`
        ));
      }
    }

    /* ------------------------------- themes ------------------------------- */

    themesEnabled() {
      const behaviour = this.params.behaviour || {};
      return behaviour.themes !== false;
    }

    // Opens or closes the "Aparência" menu (force = true/false to set it).
    // Returns true when the menu state changed.
    toggleThemeMenu(force) {
      const toggle = this.root && this.root.querySelector('[data-action="toggle-theme-menu"]');
      const menu = this.root && this.root.querySelector('#h5p-mt-theme-menu');
      if (!toggle || !menu) {
        return false;
      }
      const open = typeof force === 'boolean' ? force : menu.hidden;
      if (open === !menu.hidden) {
        return false;
      }
      menu.hidden = !open;
      toggle.setAttribute('aria-expanded', String(open));
      if (open) {
        const current = menu.querySelector('[aria-pressed="true"]');
        (current || menu.querySelector('button')).focus({ preventScroll: true });
      }
      return true;
    }

    // Applies a theme in place (no re-render: progress, focus and videos
    // stay as they are) and saves it as a preference.
    setTheme(id) {
      if (!Themes.isSupported(id)) {
        return;
      }
      this.state.theme = Themes.apply(id, [this.root, this.container]);
      this.root.querySelectorAll('[data-action="set-theme"]').forEach((option) => {
        option.setAttribute('aria-pressed', String(option.dataset.theme === this.state.theme));
      });
      this.saveState();
      this.toggleThemeMenu(false);
      const toggle = this.root.querySelector('[data-action="toggle-theme-menu"]');
      if (toggle) {
        toggle.focus({ preventScroll: true });
      }
      this.resize();
      this.announce(L(`Aparência alterada: ${Themes.find(id).name()}.`, `Appearance changed: ${Themes.find(id).name()}.`, `Apariencia cambiada: ${Themes.find(id).name()}.`));
    }

    /* --------------------------- accessibility --------------------------- */

    // VLibras translates Portuguese text into Libras (Brazilian Sign
    // Language), so the button is only offered in pt-BR.
    librasEnabled() {
      const behaviour = this.params.behaviour || {};
      return behaviour.libras !== false && !I18n.isEnglish() && !I18n.isSpanish();
    }

    openLibras(trigger) {
      this.announce(L('Abrindo o VLibras. Depois, clique em um texto para vê-lo em Libras.', 'Opening VLibras.', 'Abriendo VLibras. Después, pulse un texto para verlo en Libras.'));
      // placeVlibras() puts the window 40 px above the anchor: open it just below the button.
      const anchor = trigger ? trigger.getBoundingClientRect().bottom + 56 : 0;
      Accessibility.openLibras(anchor).catch(() => {
        this.announce(L('Não foi possível abrir o VLibras. Ele precisa de internet e pode estar bloqueado nesta rede.', 'VLibras could not be opened.', 'No ha sido posible abrir VLibras. Necesita internet y puede estar bloqueado en esta red.'));
        const button = this.root.querySelector('[data-action="open-libras"]');
        if (button) {
          button.classList.add('is-error');
          button.title = 'VLibras indisponível: precisa de internet';
        }
      });
    }

    // Opens/closes the panel in place (no re-render), keeping focus.
    toggleDescription(trigger) {
      const key = trigger.dataset.videoKey;
      const panel = this.root.querySelector(`#${CSS.escape(trigger.getAttribute('aria-controls'))}`);
      if (!key || !panel) {
        return;
      }
      this.ui.descriptions = this.ui.descriptions || {};
      const open = panel.hidden;
      this.ui.descriptions[key] = open;
      panel.hidden = !open;
      trigger.setAttribute('aria-expanded', open ? 'true' : 'false');
      if (!open) {
        Accessibility.stopSpeech();
      }
      this.resize();
    }

    speakDescription(trigger) {
      if (trigger.getAttribute('aria-pressed') === 'true') {
        Accessibility.stopSpeech();
        return;
      }
      const text = this.media()[`${trigger.dataset.videoKey}VideoDescription`];
      const reset = () => {
        trigger.setAttribute('aria-pressed', 'false');
        trigger.textContent = L('🔊 Ouvir', '🔊 Listen', '🔊 Escuchar');
      };
      this.root.querySelectorAll('[data-action="speak-description"][aria-pressed="true"]').forEach((other) => {
        other.setAttribute('aria-pressed', 'false');
        other.textContent = L('🔊 Ouvir', '🔊 Listen', '🔊 Escuchar');
      });
      if (Accessibility.speak(text, reset)) {
        trigger.setAttribute('aria-pressed', 'true');
        trigger.textContent = L('⏹ Parar', '⏹ Stop', '⏹ Detener');
      }
    }

    // "Praticar novamente": delegated to the page that owns the task.
    resetTask(taskId) {
      const page = PAGES.find((candidate) => candidate.task === taskId && candidate.reset);
      if (!page) {
        return;
      }
      page.reset(this);
      this.saveState();
      this.render({ focusSelector: 'h1' });
      this.announce(L('Atividade reiniciada para praticar. A primeira nota continua registrada.', 'Activity restarted for practice. Your first score is still recorded.', 'Actividad reiniciada para practicar. La primera nota sigue registrada.'));
    }

    resetAll() {
      if (!window.confirm(L('Apagar todo o progresso salvo neste dispositivo e recomeçar do início?', 'Erase all progress saved on this device and start over?', '¿Borrar todo el progreso guardado en este dispositivo y empezar de cero?'))) {
        return;
      }
      this.store.clear();
      // Language and theme are preferences, not progress: they survive the reset.
      const theme = this.state.theme;
      this.state = Storage.hydrate(Storage.createDefaultState());
      this.state.language = I18n.get();
      this.state.theme = theme;
      this.unlockAll = false;
      this.ui = {};
      this.initPages();
      this.refreshUnlocks();
      this.justUnlocked = false;
      this.createSections();
      this.showPage(1, { focus: true });
      this.announce(L('Atividade reiniciada. Você está na página 1.', 'Activity restarted. You are on page 1.', 'Actividad reiniciada. Está en la página 1.'));
    }

    /* ------------------------------ grading ------------------------------ */

    // Records the result of a graded activity. Only the first completion
    // counts and sends xAPI; later ones update latestScore.
    completeActivity(activityId, score, details) {
      const meta = Activities.ACTIVITIES[activityId];
      if (!meta) {
        return;
      }
      const safeScore = Math.max(0, Math.min(meta.max, Number(score) || 0));
      const existing = this.state.graded[activityId];
      const isFirstCompletion = !existing;

      this.state.graded[activityId] = {
        id: activityId,
        titulo: meta.xapiTitle,
        pontuacaoObtida: isFirstCompletion ? safeScore : existing.pontuacaoObtida,
        pontuacaoMaxima: meta.max,
        firstScore: isFirstCompletion ? safeScore : existing.firstScore,
        latestScore: safeScore,
        timestamp: isFirstCompletion ? new Date().toISOString() : existing.timestamp,
        source: 'internal',
        details: Array.isArray(details) ? details : [details || {}]
      };

      if (isFirstCompletion) {
        this.sendXapiCompletion(activityId, safeScore, meta.max);
      }
    }

    sendXapiCompletion(activityId, rawScore, maxScore) {
      const statement = XAPI.buildStatement(activityId, rawScore, maxScore, this.activityStartTime, {
        contentId: this.contentId
      });
      try {
        this.host.trigger(XAPI.createEvent(this.host, statement));
      } catch (error) {
        // A failing LMS hook must not break the activity.
      }
    }

    getScore() {
      return Activities.ids.reduce(
        (sum, id) => sum + Number((this.state.graded[id] && this.state.graded[id].pontuacaoObtida) || 0),
        0
      );
    }

    /* ---------------------------- test tools ---------------------------- */

    unlockAllForTesting() {
      if (!this.testMode) {
        return;
      }
      this.unlockAll = true;
      this.saveState();
      this.updateShell();
      this.announce(L('Modo de teste: todas as páginas foram desbloqueadas.', 'Test mode: all pages were unlocked.', 'Modo de prueba: se han desbloqueado todas las páginas.'));
    }

    runMock() {
      if (!this.testMode) {
        return;
      }
      /* One simulated event per graded activity, so adding an activity cannot
     * leave the mock (or the announce text) describing a stale count. */
      const scores = { dragWords: 4, singleChoice: 3, memory: 1, trueFalse: 4, essay: 3 };
      const count = Activities.ids.length;
      const planned = Activities.ids.filter((id) => Number(scores[id]) > 0);
      const total = planned.reduce((sum, id) => sum + Number(scores[id]), 0);
      // Ask BEFORE touching the state. completeActivity() writes to
      // state.graded and fires an xAPI completion event, so summing with it
      // first would mutate the very results the dialog offers to replace, and
      // cancelling would leave them changed.
      if (Object.keys(this.state.graded).length && !window.confirm(L(
        `Substituir os resultados atuais pelos ${count} eventos simulados?`,
        `Replace the current results with the ${count} simulated events?`,
        `¿Sustituir los resultados actuales por los ${count} eventos simulados?`
      ))) {
        return;
      }
      this.state.graded = {};
      this.state.conceptErrors = {};
      planned.forEach((id) => this.completeActivity(id, scores[id], { mock: true }));
      this.recordConceptError('supercondutor', 2);
      this.recordConceptError('campo', 1);
      this.recordConceptError('inducao', 1);
      this.saveState();
      this.render({ focusSelector: '#total-score-title' });
      this.announce(L(
        `${count} eventos xAPI simulados. O painel mostra ${total} de ${Activities.TOTAL_MAX} pontos.`,
        `${count} simulated xAPI events. The panel shows ${total} of ${Activities.TOTAL_MAX} points.`,
        `${count} eventos xAPI simulados. El panel muestra ${total} de ${Activities.TOTAL_MAX} puntos.`
      ));
    }
  }

  /* ------------------------------ H5P class ------------------------------ */

  const controllers = new WeakMap();

  function createFallbackDispatcher() {
    return class FallbackDispatcher {
      constructor() {
        this.listeners = Object.create(null);
      }

      on(type, listener) {
        if (!this.listeners[type]) {
          this.listeners[type] = [];
        }
        this.listeners[type].push(listener);
      }

      trigger(event, data) {
        if (typeof event === 'string') {
          event = { type: event, data: data };
        } else if (data !== undefined) {
          event.data = data;
        }
        (this.listeners[event.type] || []).slice().forEach((listener) => listener.call(this, event));
      }
    };
  }

  const BaseClass = H5P.EventDispatcher || H5P.Class || createFallbackDispatcher();

  class MagnetismoTransporte extends BaseClass {
    constructor(params, contentId, extras) {
      super(params, contentId, extras);
      this.contentId = contentId;
      controllers.set(this, new Controller(this, params, contentId));
    }

    attach(element) {
      controllers.get(this).attach(element);
    }

    destroy() {
      controllers.get(this).destroy();
    }

    getScore() {
      return controllers.get(this).getScore();
    }

    getMaxScore() {
      return Activities.TOTAL_MAX;
    }

    getAnswerGiven() {
      return Object.keys(controllers.get(this).state.graded).length > 0;
    }

    getTitle() {
      return controllers.get(this).title();
    }

    getCurrentState() {
      return JSON.parse(JSON.stringify(controllers.get(this).state));
    }
  }

  // Safe, read-only metadata for tooling. The sealed bank and the answer
  // key are deliberately not re-exposed.
  MagnetismoTransporte.PAGES = PAGES.map(({ id, short, title }) => ({ id, short, title }));
  MagnetismoTransporte.TOTAL_MAX = Activities.TOTAL_MAX;
  H5P.MagnetismoTransporte = MagnetismoTransporte;
})(window.H5P = window.H5P || {});
