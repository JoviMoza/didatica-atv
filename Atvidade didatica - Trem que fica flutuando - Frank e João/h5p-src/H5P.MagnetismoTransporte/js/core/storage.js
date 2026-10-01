(function (H5P) {
  'use strict';

  // v3: each student gets questions drawn at random from the banks
  // (seed + questionIds per quiz).
  // v4: opaque option ids (sealed answer key) and signed records.
  // v5: variable magnet count in the lab (2..10, default 2), Spanish, and the
  // essay page. The essay key is additive — hydrate() reads a missing one as an
  // empty draft — so v5 stays v5 on purpose: bumping it would throw away the
  // progress of a class that is halfway through v5. Bump it only when an
  // existing field changes meaning.
  // The storage key includes the schema version, so records from v3/v4 are
  // ignored instead of being migrated.
  const SCHEMA_VERSION = 5;
  const SIGNATURE_SEED = 0x4d542d34;
  const Util = H5P.MagnetismoTransporte && H5P.MagnetismoTransporte.Util;
  const PAGE_COUNT = 9;
  // Magnets in the lab: the student adds them one at a time, up to MAX.
  const MAGNET_MIN = 2;
  const MAGNET_MAX = 10;
  const MAGNET_DEFAULT = 2;
  const SAFE_KEYS = new Set(['__proto__', 'prototype', 'constructor']);
  // Interface languages; '' = not chosen yet. Duplicated from core/i18n.js
  // on purpose: both lists have to agree, and keeping them literal here makes
  // the whitelist check a plain includes() instead of a namespace lookup.
  const LANGUAGES = ['pt-BR', 'en-US', 'es-ES'];
  // Visual theme id (js/ui/themes.js); '' = default design. The list is
  // checked again by Themes.isSupported() before it is applied.
  const THEME_ID = /^[a-z][a-z0-9-]{0,30}$/;

  function createDefaultState() {
    return {
      schemaVersion: SCHEMA_VERSION,
      language: '',
      theme: '',
      currentPage: 1,
      unlockedPage: 1,
      visitedPages: [1],
      videos: {
        intro: false,
        meissner: false,
        cobra: false
      },
      conceptErrors: {},
      tasks: {
        dragWords: {
          placements: {},
          mistakes: {},
          skipped: {},
          complete: false,
          attempts: 0
        },
        magnets: {
          count: MAGNET_DEFAULT,
          // defaultAngles() owns the starting orientation; do not duplicate it.
          angles: defaultAngles(MAGNET_DEFAULT),
          answers: {},
          checked: {},
          skipped: {},
          tries: {},
          missions: {
            aligned: false,
            nulled: false
          },
          showLines: true,
          showCompass: false,
          done: false
        },
        singleChoice: {
          seed: 0,
          questionIds: [],
          index: 0,
          answers: {},
          complete: false,
          attempts: 0
        },
        memory: {
          seed: 20260924,
          deck: [],
          matched: [],
          skipped: [],
          open: [],
          moves: 0,
          mismatches: {},
          matchingAnswers: {},
          matchingHits: 0,
          matchingTries: 0,
          complete: false,
          attempts: 0
        },
        trueFalse: {
          seed: 0,
          questionIds: [],
          index: 0,
          answers: {},
          complete: false,
          attempts: 0
        },
        // Open-ended answer. `text` is the student's own words, so it gets a
        // real length cap (sanitizeAnswerMap's 120 chars is for options).
        essay: {
          text: '',
          submitted: false,
          evaluated: null,
          attempts: 0
        }
      },
      graded: {}
    };
  }

  function isPlainObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
  }

  function copyArray(value) {
    return Array.isArray(value) ? value.slice() : [];
  }

  function numberInRange(value, fallback, min, max) {
    const number = Number(value);
    if (!Number.isFinite(number)) {
      return fallback;
    }
    return Math.min(max, Math.max(min, number));
  }

  // Starting orientation for N magnets: all pointing up (N north) except the
  // last one lying on its side, which is the situation the first lab
  // question asks about. Deterministic, so a reload redraws the same picture.
  function defaultAngles(count) {
    const total = Math.max(MAGNET_MIN, Math.min(MAGNET_MAX, Math.round(Number(count) || MAGNET_DEFAULT)));
    return Array.from({ length: total }, (_, index) => (index === total - 1 ? 90 : 0));
  }

  function normalizeAngle(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) {
      return 0;
    }
    return ((number % 360) + 360) % 360;
  }

  function sanitizeText(value, limit) {
    return String(value === undefined || value === null ? '' : value).slice(0, limit);
  }

  // Free text from the student: collapsed to a single line so a stored record
  // can never inject markup, and capped well below the localStorage quota.
  function sanitizeAnswer(value) {
    return String(value === undefined || value === null ? '' : value)
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 2000);
  }

  function sanitizeAnswerMap(value) {
    if (!isPlainObject(value)) {
      return {};
    }
    return Object.keys(value).reduce((result, key) => {
      if (SAFE_KEYS.has(key)) {
        return result;
      }
      const answer = value[key];
      if (isPlainObject(answer)) {
        result[key] = {
          choice: String(answer.choice === undefined ? '' : answer.choice).slice(0, 120),
          correct: String(answer.correct === undefined ? '0' : answer.correct).slice(0, 12),
          feedback: String(answer.feedback || '').slice(0, 1000)
        };
      } else if (['string', 'number', 'boolean'].includes(typeof answer)) {
        result[key] = answer;
      }
      return result;
    }, {});
  }

  function sanitizeIdList(value) {
    return copyArray(value)
      .filter((id) => typeof id === 'string' && /^[a-z0-9-]{1,60}$/.test(id))
      .slice(0, 20);
  }

  function sanitizeStringMap(value) {
    if (!isPlainObject(value)) {
      return {};
    }
    return Object.keys(value).reduce((result, key) => {
      if (!SAFE_KEYS.has(key) && ['string', 'number', 'boolean'].includes(typeof value[key])) {
        result[key] = value[key];
      }
      return result;
    }, {});
  }

  // Every field is rebuilt from a whitelist, so a corrupted localStorage
  // record cannot inject arbitrary properties into the runtime state.
  function hydrate(rawState) {
    const source = isPlainObject(rawState) ? rawState : {};
    const defaults = createDefaultState();
    const state = defaults;
    const sourceTasks = isPlainObject(source.tasks) ? source.tasks : {};

    state.language = LANGUAGES.includes(source.language) ? source.language : '';
    state.theme = typeof source.theme === 'string' && THEME_ID.test(source.theme) ? source.theme : '';
    state.unlockedPage = numberInRange(source.unlockedPage, 1, 1, PAGE_COUNT);
    state.currentPage = numberInRange(source.currentPage, 1, 1, state.unlockedPage);
    state.visitedPages = Array.from(new Set(copyArray(source.visitedPages)
      .map((page) => Math.round(numberInRange(page, 1, 1, PAGE_COUNT)))
      .concat([1])));

    const videos = isPlainObject(source.videos) ? source.videos : {};
    state.videos = {
      intro: Boolean(videos.intro),
      meissner: Boolean(videos.meissner),
      cobra: Boolean(videos.cobra)
    };
    state.conceptErrors = sanitizeStringMap(source.conceptErrors);

    const dragWords = isPlainObject(sourceTasks.dragWords) ? sourceTasks.dragWords : {};
    state.tasks.dragWords = {
      placements: sanitizeStringMap(dragWords.placements),
      mistakes: sanitizeStringMap(dragWords.mistakes),
      skipped: sanitizeStringMap(dragWords.skipped),
      complete: Boolean(dragWords.complete),
      attempts: numberInRange(dragWords.attempts, 0, 0, 999)
    };

    const magnets = isPlainObject(sourceTasks.magnets) ? sourceTasks.magnets : {};
    // The student chooses how many magnets the lab has (2..10), so the saved
    // angle array must match the saved count or it is rebuilt from scratch.
    const count = Math.round(numberInRange(magnets.count, MAGNET_DEFAULT, MAGNET_MIN, MAGNET_MAX));
    const angles = copyArray(magnets.angles);
    const missions = isPlainObject(magnets.missions) ? magnets.missions : {};
    state.tasks.magnets = {
      count,
      angles: angles.length === count
        ? angles.map(normalizeAngle)
        : defaultAngles(count),
      answers: sanitizeStringMap(magnets.answers),
      checked: sanitizeStringMap(magnets.checked),
      skipped: sanitizeStringMap(magnets.skipped),
      tries: sanitizeStringMap(magnets.tries),
      missions: {
        aligned: Boolean(missions.aligned),
        nulled: Boolean(missions.nulled)
      },
      showLines: magnets.showLines === undefined ? true : Boolean(magnets.showLines),
      showCompass: Boolean(magnets.showCompass),
      done: Boolean(magnets.done)
    };

    const singleChoice = isPlainObject(sourceTasks.singleChoice) ? sourceTasks.singleChoice : {};
    state.tasks.singleChoice = {
      seed: numberInRange(singleChoice.seed, 0, 0, 2147483647),
      questionIds: sanitizeIdList(singleChoice.questionIds),
      index: numberInRange(singleChoice.index, 0, 0, 3),
      answers: sanitizeAnswerMap(singleChoice.answers),
      complete: Boolean(singleChoice.complete),
      attempts: numberInRange(singleChoice.attempts, 0, 0, 999)
    };

    const memory = isPlainObject(sourceTasks.memory) ? sourceTasks.memory : {};
    state.tasks.memory = {
      seed: numberInRange(memory.seed, 20260924, 1, 2147483647),
      deck: copyArray(memory.deck),
      matched: copyArray(memory.matched),
      skipped: copyArray(memory.skipped),
      open: copyArray(memory.open),
      moves: numberInRange(memory.moves, 0, 0, 9999),
      mismatches: sanitizeStringMap(memory.mismatches),
      matchingAnswers: sanitizeStringMap(memory.matchingAnswers),
      matchingHits: numberInRange(memory.matchingHits, 0, 0, 9999),
      matchingTries: numberInRange(memory.matchingTries, 0, 0, 9999),
      complete: Boolean(memory.complete),
      attempts: numberInRange(memory.attempts, 0, 0, 999)
    };

    const trueFalse = isPlainObject(sourceTasks.trueFalse) ? sourceTasks.trueFalse : {};
    state.tasks.trueFalse = {
      seed: numberInRange(trueFalse.seed, 0, 0, 2147483647),
      questionIds: sanitizeIdList(trueFalse.questionIds),
      index: numberInRange(trueFalse.index, 0, 0, 4),
      answers: sanitizeAnswerMap(trueFalse.answers),
      complete: Boolean(trueFalse.complete),
      attempts: numberInRange(trueFalse.attempts, 0, 0, 999)
    };

    const essay = isPlainObject(sourceTasks.essay) ? sourceTasks.essay : {};
    // Old records (v5 and earlier) have no `essay` key: they load as empty so
    // a student mid-course is not asked to retype anything.
    state.tasks.essay = {
      text: sanitizeAnswer(essay.text),
      submitted: Boolean(essay.submitted),
      evaluated: sanitizeEvaluation(essay.evaluated),
      attempts: numberInRange(essay.attempts, 0, 0, 99)
    };

// Mirror of the graded ids in core/activities.js. It cannot be derived from
  // ACTIVITIES: this module is evaluated before activities.js (library.json
  // order), so ACTIVITIES is still undefined here. An id missing from this set
  // is silently dropped from `graded` on every reload — which is how the essay
  // score used to disappear (docs/questoes-dissertativas-viabilidade.md).
  const allowed = new Set(['dragWords', 'singleChoice', 'memory', 'trueFalse', 'essay']);
    const graded = isPlainObject(source.graded) ? source.graded : {};
    state.graded = Object.keys(graded).reduce((result, key) => {
      const value = graded[key];
      if (!allowed.has(key) || !isPlainObject(value)) {
        return result;
      }
      result[key] = {
        id: key,
        titulo: String(value.titulo || '').slice(0, 160),
        pontuacaoObtida: numberInRange(value.pontuacaoObtida, 0, -1000, 1000),
        pontuacaoMaxima: numberInRange(value.pontuacaoMaxima, 1, 1, 1000),
        firstScore: numberInRange(
          value.firstScore === undefined ? value.pontuacaoObtida : value.firstScore,
          0,
          -1000,
          1000
        ),
        latestScore: numberInRange(
          value.latestScore === undefined ? value.pontuacaoObtida : value.latestScore,
          0,
          -1000,
          1000
        ),
        timestamp: String(value.timestamp || '').slice(0, 80),
        source: String(value.source || 'internal').slice(0, 40),
        details: Array.isArray(value.details) ? value.details.slice(0, 100) : []
      };
      return result;
    }, {});

    return state;
  }

  // The grader's verdict is rebuilt from a whitelist too, so a tampered record
  // cannot inject a fake score or a fake "all concepts correct" list. Note what
  // is deliberately NOT kept: the seals and the reference answer. The page
  // re-reads those from the live rubric through answer-key.js, so they must
  // never reach localStorage.
  function sanitizeEvaluation(value) {
    if (!isPlainObject(value)) {
      return null;
    }
    const statuses = ['correct', 'partial', 'missing'];
    const conceptList = (list) => (Array.isArray(list) ? list : []).slice(0, 20).reduce((result, item) => {
      if (!isPlainObject(item) || typeof item.id !== 'string' || !/^[a-z0-9-]{1,40}$/.test(item.id)) {
        return result;
      }
      result.push({
        id: item.id,
        label: sanitizeText(item.label, 160),
        status: statuses.indexOf(item.status) === -1 ? 'missing' : item.status,
        hits: numberInRange(item.hits, 0, 0, 99),
        required: Boolean(item.required)
      });
      return result;
    }, []);
    return {
      // numberInRange falls back to `fallback` on a non-number, so a corrupted
      // or hand-edited score cannot become NaN and render as "NaN / 5".
      score: numberInRange(value.score, 0, 0, 1),
      confidence: numberInRange(value.confidence, 0, 0, 1),
      needsReview: Boolean(value.needsReview),
      concepts: conceptList(value.concepts),
      relations: (Array.isArray(value.relations) ? value.relations : []).slice(0, 20).reduce((result, item) => {
        if (isPlainObject(item) && typeof item.from === 'string' && typeof item.to === 'string') {
          result.push({
            from: sanitizeText(item.from, 40),
            to: sanitizeText(item.to, 40),
            ok: Boolean(item.ok)
          });
        }
        return result;
      }, []),
      contradictions: (Array.isArray(value.contradictions) ? value.contradictions : []).slice(0, 10)
        .map((item) => sanitizeText(item && item.id, 40)).filter(Boolean)
    };
  }

  // Session id for a content that has none (the authoring preview). A real
  // Lumi/LMS content always passes its own id.
  function createSessionToken() {
    try {
      if (window.crypto && typeof window.crypto.randomUUID === 'function') {
        return window.crypto.randomUUID();
      }
    } catch (error) {
      // Fall through to Math.random for older authoring previews.
    }
    return `preview-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }

  // Records are stored as { d: "<state JSON>", s: "<signature>" }. A record
  // edited by hand (for example, to raise a score or unlock pages) no longer
  // matches its signature and is discarded, as if it were corrupted.
  // Backend: the local preview (developer-preview) uses sessionStorage, so
  // every new tab/window draws fresh questions (a new student) while reloads
  // in the same tab keep progress. Lumi/LMS use localStorage per device.
  function pickBackend(contentId) {
    if (contentId === 'developer-preview') {
      try {
        const session = window.sessionStorage;
        session.getItem('__mt_probe__');
        return session;
      } catch (error) {
        // Blocked storage falls through to localStorage below.
      }
    }
    return window.localStorage;
  }

  class StorageAdapter {
    constructor(baseKey, contentId) {
      this.baseKey = String(baseKey || 'h5p.magnetismo-transporte').replace(/[^a-zA-Z0-9._-]/g, '-');
      this.instanceId = contentId ? `cid-${contentId}` : createSessionToken();
      this.key = `${this.baseKey}:v${SCHEMA_VERSION}:${this.instanceId}`;
      this.backend = pickBackend(contentId);
      this.lastError = null;
    }

    sign(data) {
      return Util.hashHex(`${this.key}|${data}`, SIGNATURE_SEED);
    }

    load() {
      try {
        const raw = this.backend.getItem(this.key);
        if (!raw) {
          return hydrate(createDefaultState());
        }
        const record = JSON.parse(raw);
        if (!isPlainObject(record) || typeof record.d !== 'string' || record.s !== this.sign(record.d)) {
          return hydrate(createDefaultState());
        }
        return hydrate(JSON.parse(record.d));
      } catch (error) {
        this.lastError = error;
        return hydrate(createDefaultState());
      }
    }

    save(state) {
      try {
        const data = JSON.stringify(state);
        this.backend.setItem(this.key, JSON.stringify({ d: data, s: this.sign(data) }));
        this.lastError = null;
        return true;
      } catch (error) {
        // Quota, privacy mode and blocked third-party storage must not break
        // the activity. State remains available in memory for this session.
        this.lastError = error;
        return false;
      }
    }

    clear() {
      try {
        this.backend.removeItem(this.key);
        return true;
      } catch (error) {
        this.lastError = error;
        return false;
      }
    }
  }

  H5P.MagnetismoTransporte = H5P.MagnetismoTransporte || {};
  H5P.MagnetismoTransporte.Storage = {
    SCHEMA_VERSION,
    MAGNET_MIN,
    MAGNET_MAX,
    MAGNET_DEFAULT,
    defaultAngles,
    createDefaultState,
    hydrate,
    normalizeAngle,
    StorageAdapter,
    createSessionToken
  };
})(window.H5P = window.H5P || {});
