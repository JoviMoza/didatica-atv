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
  const REQUIRED = ['Util', 'I18n', 'Storage', 'Activities', 'XAPI', 'AnswerKey', 'Quiz', 'Content', 'ParamsEn', 'Bank', 'Physics', 'UI', 'Review', 'Accessibility', 'Themes'];
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
  const PAGE_EVENTS = ['change', 'keydown', 'dragstart', 'dragover', 'dragleave', 'drop', 'pointerdown', 'pointermove', 'pointerup', 'pointercancel'];

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
      if (this.container) {
        this.container.innerHTML = '';
      }
    }

    /* ------------------------- services for pages ------------------------- */

    // Editor texts (content.json) are in Portuguese; in English the
    // translations of js/data/params-en.js are used instead.
    text(name) {
      return I18n.isEnglish() ? ns.ParamsEn[name] : this.params[name];
    }

    title() {
      return this.text('title') || PROJECT_NAME;
    }

    // Video URLs always come from the editor; titles and descriptions follow
    // the language.
    media() {
      const media = this.params.media || {};
      return I18n.isEnglish() ? Object.assign({}, media, ns.ParamsEn.media) : media;
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
        title: title || L('Vídeo da atividade', 'Activity video'),
        text: this.media()[`${key}VideoDescription`],
        open: Boolean(descriptions[key])
      });
      return UI.videoFacade({ key, url, title, start, description, extra, opened: Boolean(this.state.videos[key]) });
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
        this.announce(PAGES[this.state.currentPage - 1].unlockHint || L('Esta página ainda está bloqueada.', 'This page is still locked.'));
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
        <a class="mt-skip" href="#h5p-mt-main">${L('Ir para o conteúdo principal', 'Skip to main content')}</a>
        <header class="mt-top">
          <div class="mt-top__inner">
            <div class="mt-brand">
              <span class="mt-brand__mark" aria-hidden="true">${UI.brandIcon()}</span>
              <div class="mt-brand__text">
                <strong>${escapeHtml(this.title())}</strong>
                <span>${escapeHtml(this.text('subtitle') || L('Missão MagLev · o trem que flutua', 'MagLev Mission · the floating train'))}</span>
              </div>
            </div>
            <div class="mt-top__tools">
              ${UI.languageSwitch(I18n.LANGUAGES, I18n.get())}
              ${this.themesEnabled() ? Themes.button(this.state.theme) : ''}
              ${this.librasEnabled() ? Accessibility.librasButton() : ''}
              <div class="mt-top__meta">
                <span class="mt-top__counter" id="h5p-mt-counter">1 / ${PAGE_COUNT}</span>
                <span class="mt-top__save" id="h5p-mt-save">${L('Progresso salvo', 'Progress saved')}</span>
              </div>
            </div>
          </div>
          <div class="mt-tabs" role="tablist" aria-label="${L('Seções', 'Sections')}">
            <button type="button" class="mt-tab" role="tab" data-action="view" data-view="mission" id="h5p-mt-tab-mission" aria-controls="h5p-mt-main">${L('Missão', 'Mission')}</button>
            <button type="button" class="mt-tab" role="tab" data-action="view" data-view="review" id="h5p-mt-tab-review" aria-controls="h5p-mt-review"></button>
          </div>
          <ol class="mt-stepper" aria-label="${L('Progresso da atividade', 'Activity progress')}"></ol>
        </header>
        ${this.testMode ? `
          <div class="mt-devbar" role="region" aria-label="${L('Ferramentas de teste', 'Test tools')}">
            <strong>${L('Modo de teste', 'Test mode')}</strong>
            <button type="button" class="mt-btn mt-btn--ghost mt-btn--sm" data-action="unlock-all">${L('Desbloquear todas as páginas', 'Unlock all pages')}</button>
          </div>` : ''}
        <p class="mt-alert mt-alert--warn" data-role="storage-warning" role="status" hidden>
          ${L('Não foi possível salvar o progresso neste navegador. Você ainda pode concluir a atividade, mas recarregar a página pode apagar o estado.', 'Your progress could not be saved in this browser. You can still finish the activity, but reloading the page may erase it.')}
        </p>
        <main id="h5p-mt-main" class="mt-main" tabindex="-1" role="tabpanel" aria-labelledby="h5p-mt-tab-mission"></main>
        <section id="h5p-mt-review" class="mt-main mt-review-view" role="tabpanel" aria-labelledby="h5p-mt-tab-review" hidden></section>
        <footer class="mt-nav">
          <div class="mt-nav__inner">
            <button type="button" class="mt-btn mt-btn--secondary" data-action="previous-page">
              <span aria-hidden="true">←</span> ${L('Anterior', 'Previous')}
            </button>
            <div class="mt-nav__middle">
              <p class="mt-nav__hint" id="h5p-mt-hint" aria-live="polite"></p>
              <button type="button" class="mt-link" data-action="resume" hidden></button>
            </div>
            <button type="button" class="mt-btn mt-btn--primary" data-action="next-page" aria-describedby="h5p-mt-hint">
              ${L('Próxima', 'Next')} <span aria-hidden="true">→</span>
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
        if (event.key === 'Escape' && event.target.closest('.mt-theme') && this.toggleThemeMenu(false)) {
          event.stopPropagation();
          this.root.querySelector('[data-action="toggle-theme-menu"]').focus();
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
          ? L('página atual', 'current page')
          : page.id > unlocked ? L('bloqueada', 'locked') : L('liberada', 'unlocked');
        const marker = status === 'is-locked'
          ? '<svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true"><path d="M4.5 7V5a3.5 3.5 0 0 1 7 0v2H13v7H3V7zm2 0h3V5a1.5 1.5 0 0 0-3 0z" fill="currentColor"/></svg>'
          : status === 'is-done'
            ? '<svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true"><path d="M6.4 11.6 2.8 8l1.4-1.4 2.2 2.2 5.4-5.4 1.4 1.4z" fill="currentColor"/></svg>'
            : `<span aria-hidden="true">${page.id}</span>`;
        return `
          <li class="mt-step ${status}" ${page.id === current ? 'aria-current="step"' : ''}>
            <span class="mt-step__dot">${marker}</span>
            <span class="mt-step__label">${escapeHtml(page.short)}</span>
            <span class="mt-sr-only">${L('Página', 'Page')} ${page.id}, ${escapeHtml(page.short)}: ${statusText}</span>
          </li>
        `;
      }).join('');
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
        hint.textContent = L('Fim da missão. Use “Anterior” para revisar qualquer página.', 'End of the mission. Use “Previous” to review any page.');
      } else if (!nextOpen) {
        hint.innerHTML = `<span aria-hidden="true">🔒</span> ${escapeHtml(PAGES[page - 1].unlockHint || L('Conclua esta página para avançar.', 'Finish this page to move on.'))}`;
      } else if (this.justUnlocked) {
        hint.innerHTML = `<span aria-hidden="true">✓</span> ${L('Próxima página liberada!', 'Next page unlocked!')}`;
      } else {
        hint.textContent = L(`Página ${page} de ${PAGE_COUNT}`, `Page ${page} of ${PAGE_COUNT}`);
      }
      hint.classList.toggle('is-locked', !nextOpen && page !== PAGE_COUNT);
      hint.classList.toggle('is-ready', nextOpen && this.justUnlocked);

      const reviewTab = this.root.querySelector('#h5p-mt-tab-review');
      const reviewOpen = this.reviewAvailable();
      const reviewLabel = L('Revisão estendida', 'Extended review');
      reviewTab.innerHTML = reviewOpen
        ? reviewLabel
        : `<span aria-hidden="true">🔒</span> ${reviewLabel}<span class="mt-sr-only">${L(' (abre ao terminar a página 7)', ' (opens when you finish page 7)')}</span>`;
      reviewTab.classList.toggle('is-locked', !reviewOpen);
      reviewTab.title = reviewOpen ? '' : L('Abre quando você terminar a página 7', 'Opens when you finish page 7');
      this.root.querySelectorAll('.mt-tab').forEach((tab) => {
        const active = tab.dataset.view === this.view;
        tab.classList.toggle('is-active', active);
        tab.setAttribute('aria-selected', active ? 'true' : 'false');
      });

      resume.hidden = unlocked - page < 2;
      resume.textContent = L(`Voltar para onde parei (página ${unlocked}) ⇥`, `Back to where I stopped (page ${unlocked}) ⇥`);
      this.justUnlocked = false;
    }

    updateStorageWarning() {
      if (!this.storageWarning) {
        return;
      }
      this.storageWarning.hidden = !this.store.lastError;
      const label = this.root.querySelector('#h5p-mt-save');
      if (label) {
        label.textContent = this.store.lastError ? L('Salvamento indisponível', 'Saving unavailable') : L('Progresso salvo', 'Progress saved');
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
        this.announce(L('A revisão estendida abre quando você terminar a página 7.', 'The extended review opens when you finish page 7.'));
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
      this.announce(L('Vídeo carregado. Use os controles do player ou o link para abrir no YouTube.', 'Video loaded. Use the player controls or the link to open it on YouTube.'));
    }

    /* ------------------------------ language ------------------------------ */

    // Rebuilds the whole shell in the new language. Progress is untouched:
    // only state.language changes. Focus returns to the pressed button.
    setLanguage(code) {
      if (!I18n.isSupported(code) || code === I18n.get()) {
        return;
      }
      const view = this.view;
      Accessibility.stopSpeech();
      this.state.language = I18n.set(code);
      this.ui.descriptions = {};
      this.renderShell();
      if (view === 'review') {
        this.setView('review');
      }
      this.frame(() => {
        const button = this.root.querySelector(`[data-action="set-language"][data-lang="${code}"]`);
        if (button) {
          button.focus({ preventScroll: true });
        }
      });
      this.announce(L('Idioma alterado para português do Brasil.', 'Language changed to English (US).'));
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
      this.announce(L(`Aparência alterada: ${Themes.find(id).name()}.`, `Appearance changed: ${Themes.find(id).name()}.`));
    }

    /* --------------------------- accessibility --------------------------- */

    // VLibras translates Portuguese text into Libras (Brazilian Sign
    // Language), so the button is only offered in pt-BR.
    librasEnabled() {
      const behaviour = this.params.behaviour || {};
      return behaviour.libras !== false && !I18n.isEnglish();
    }

    openLibras(trigger) {
      this.announce(L('Abrindo o VLibras. Depois, clique em um texto para vê-lo em Libras.', 'Opening VLibras.'));
      // placeVlibras() puts the window 40 px above the anchor: open it just below the button.
      const anchor = trigger ? trigger.getBoundingClientRect().bottom + 56 : 0;
      Accessibility.openLibras(anchor).catch(() => {
        this.announce(L('Não foi possível abrir o VLibras. Ele precisa de internet e pode estar bloqueado nesta rede.', 'VLibras could not be opened.'));
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
        trigger.textContent = L('🔊 Ouvir', '🔊 Listen');
      };
      this.root.querySelectorAll('[data-action="speak-description"][aria-pressed="true"]').forEach((other) => {
        other.setAttribute('aria-pressed', 'false');
        other.textContent = L('🔊 Ouvir', '🔊 Listen');
      });
      if (Accessibility.speak(text, reset)) {
        trigger.setAttribute('aria-pressed', 'true');
        trigger.textContent = L('⏹ Parar', '⏹ Stop');
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
      this.announce(L('Atividade reiniciada para praticar. A primeira nota continua registrada.', 'Activity restarted for practice. Your first score is still recorded.'));
    }

    resetAll() {
      if (!window.confirm(L('Apagar todo o progresso salvo neste dispositivo e recomeçar do início?', 'Erase all progress saved on this device and start over?'))) {
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
      this.announce(L('Atividade reiniciada. Você está na página 1.', 'Activity restarted. You are on page 1.'));
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
      this.announce(L('Modo de teste: todas as páginas foram desbloqueadas.', 'Test mode: all pages were unlocked.'));
    }

    runMock() {
      if (!this.testMode) {
        return;
      }
      if (Object.keys(this.state.graded).length && !window.confirm(L('Substituir os resultados atuais pelos quatro eventos simulados?', 'Replace the current results with the four simulated events?'))) {
        return;
      }
      this.state.graded = {};
      this.state.conceptErrors = {};
      this.completeActivity('dragWords', 4, { mock: true });
      this.completeActivity('singleChoice', 3, { mock: true });
      this.completeActivity('memory', 1, { mock: true });
      this.completeActivity('trueFalse', 4, { mock: true });
      this.recordConceptError('supercondutor', 2);
      this.recordConceptError('campo', 1);
      this.recordConceptError('inducao', 1);
      this.saveState();
      this.render({ focusSelector: '#total-score-title' });
      this.announce(L(`Quatro eventos xAPI simulados. O painel mostra 12 de ${Activities.TOTAL_MAX} pontos.`, `Four simulated xAPI events. The panel shows 12 of ${Activities.TOTAL_MAX} points.`));
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
