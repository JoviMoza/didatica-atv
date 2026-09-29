(function (H5P) {
  'use strict';

  /* Page 5 — MagLev-Cobra memory game (score = hits ÷ tries, 0–1) with an
   * accessible matching alternative. Cards are addressed in the DOM by
   * their position on the table only, and the saved deck uses opaque
   * tokens, so neither the page nor the saved state reveals the pairs. */

  const ns = H5P.MagnetismoTransporte;
  const { escapeHtml, seededShuffle, createSeed } = ns.Util;
  const { UI } = ns;
  const L = ns.I18n.L;
  const PAIRS = ns.Content.MEMORY_PAIRS;
  const CARD_COUNT = PAIRS.length * 2;

  function pairOf(cardId) {
    return Math.floor(Number(cardId) / 2);
  }

  function describe(cardId) {
    const id = Number(cardId);
    const pair = PAIRS[pairOf(id)];
    return id % 2 === 0 ? pair.alt : pair.label;
  }

  // The saved deck holds opaque per-student tokens instead of card ids, so
  // getCurrentState() and localStorage do not reveal where each pair is
  // (card ids 2i and 2i+1 form pair i). The score depends on the number of
  // tries, so the layout must stay hidden until cards are flipped.
  function cardToken(seed, cardId) {
    return 'c' + ns.Util.hashHex(`${ns.Bank.salt}|memory|${seed}|${cardId}`).slice(0, 10);
  }

  function tokenMap(seed) {
    const map = {};
    for (let id = 0; id < CARD_COUNT; id += 1) {
      map[cardToken(seed, id)] = id;
    }
    return map;
  }

  // Card ids in table order, decoded from the saved tokens.
  function deckIds(memory) {
    const map = tokenMap(memory.seed);
    return memory.deck.map((token) => map[token]);
  }

  function init(app) {
    const memory = app.state.tasks.memory;
    const map = tokenMap(memory.seed);
    const validDeck = Array.isArray(memory.deck) &&
      memory.deck.length === CARD_COUNT &&
      new Set(memory.deck).size === CARD_COUNT &&
      memory.deck.every((token) => Object.prototype.hasOwnProperty.call(map, token));
    if (!validDeck) {
      // Fresh students get a random layout: the default seed is fixed, so
      // without this every new student would see the same table.
      memory.seed = createSeed();
      memory.deck = seededShuffle(Array.from({ length: CARD_COUNT }, (_, index) => index), memory.seed)
        .map((id) => cardToken(memory.seed, id));
    }
    const pairIndexes = (list) => Array.from(new Set((Array.isArray(list) ? list : [])
      .map(Number)
      .filter((id) => Number.isInteger(id) && id >= 0 && id < PAIRS.length)));
    // Skipped pairs are revealed but never count as found.
    memory.skipped = pairIndexes(memory.skipped);
    memory.matched = pairIndexes(memory.matched).filter((id) => !memory.skipped.includes(id));
    memory.open = (Array.isArray(memory.open) ? memory.open : [])
      .map(Number)
      .filter((id) => Number.isInteger(id) && id >= 0 && id < CARD_COUNT && !isSettled(memory, pairOf(id)))
      .slice(0, 2);
  }

  // A pair is settled when it was found or skipped: its cards stay face up.
  function isSettled(memory, pairIndex) {
    return memory.matched.includes(pairIndex) || memory.skipped.includes(pairIndex);
  }

  // Score = hits / tries, on the activity's 0–1 scale (two decimals).
  function accuracyScore(hits, tries) {
    return tries > 0 ? Math.round((hits / tries) * 100) / 100 : 0;
  }

  function renderMatching(app) {
    const memory = app.state.tasks.memory;
    if (memory.complete) {
      return '';
    }
    const selected = memory.matchingAnswers;
    const results = app.ui.matching || {};
    return `
      <details class="mt-details" ${results.checked ? 'open' : ''}>
        <summary>${L('Prefere associar sem cartas? (alternativa acessível)', 'Prefer matching without cards? (accessible alternative)')}</summary>
        <p class="mt-muted">${L('Mesmo gabarito e mesma pontuação do jogo da memória.', 'Same answers and same scoring as the memory game.')}</p>
        <form class="mt-matching" onsubmit="return false;">
          ${PAIRS.map((pair, pairIndex) => memory.skipped.includes(pairIndex) ? `
            <label>
              <span>${escapeHtml(pair.shortLabel)}</span>
              <select disabled><option selected>${escapeHtml(pair.label)}</option></select>
              <span class="mt-small">${L('Pulado', 'Skipped')}</span>
            </label>
          ` : `
            <label>
              <span>${escapeHtml(pair.shortLabel)}</span>
              <select data-role="matching-select" data-pair-id="${escapeHtml(pair.id)}">
                <option value="">${L('Escolher…', 'Choose…')}</option>
                ${PAIRS.map((candidate) => {
                  // Each answer can be used only once across the rows.
                  const usedElsewhere = selected[pair.id] !== candidate.id && Object.values(selected).includes(candidate.id);
                  return `<option value="${escapeHtml(candidate.id)}" ${selected[pair.id] === candidate.id ? 'selected' : ''} ${usedElsewhere ? 'disabled' : ''}>${escapeHtml(candidate.label)}</option>`;
                }).join('')}
              </select>
              <span class="mt-small">${results.checked && selected[pair.id] ? (selected[pair.id] === pair.id ? L('✓ Correta', '✓ Correct') : L('✕ Revise', '✕ Review')) : ''}</span>
            </label>
          `).join('')}
          <div class="mt-card__foot">
            <p id="matching-status" class="mt-feedback" role="status" tabindex="-1">${escapeHtml(results.message || '')}</p>
            <button type="button" class="mt-btn mt-btn--primary" data-action="check-matching">${L('Verificar associações', 'Check matches')}</button>
          </div>
        </form>
      </details>
    `;
  }

  function render(app, section) {
    const memory = app.state.tasks.memory;
    const media = app.media();
    const cardHtml = deckIds(memory).map((cardId, position) => {
      const pairIndex = pairOf(cardId);
      const pair = PAIRS[pairIndex];
      const isImageCard = cardId % 2 === 0;
      const isSkipped = memory.skipped.includes(pairIndex);
      const isMatched = isSettled(memory, pairIndex);
      const isOpen = memory.open.includes(cardId);
      const visible = isMatched || isOpen;
      const face = isImageCard
        ? `<img src="${escapeHtml(app.assetPath(`images/${pair.image}`))}" alt="${escapeHtml(pair.alt)}">`
        : `<span class="mt-mcard__label">${escapeHtml(pair.label)}</span>`;
      const accessibleLabel = isSkipped
        ? `${describe(cardId)}. ${L('Par pulado.', 'Pair skipped.')}`
        : isMatched
          ? `${describe(cardId)}. ${L('Par encontrado.', 'Pair found.')}`
          : isOpen
          ? `${describe(cardId)}. ${L('Carta aberta.', 'Card face up.')}`
          : L(`Carta virada ${position + 1} de ${CARD_COUNT}.`, `Face-down card ${position + 1} of ${CARD_COUNT}.`);
      const wrongPair = memory.open.length === 2 && isOpen;
      return `
        <button type="button" class="mt-mcard ${visible ? 'is-open' : ''} ${isMatched ? 'is-matched' : ''} ${isSkipped ? 'is-skipped' : ''} ${wrongPair ? 'is-wrong' : ''}"
          data-action="memory-card" data-position="${position}" aria-label="${escapeHtml(accessibleLabel)}"
          ${isMatched || memory.open.length === 2 || isOpen ? 'disabled' : ''}>
          <span class="mt-mcard__inner">
            <span class="mt-mcard__face mt-mcard__back" aria-hidden="true">${UI.brandIcon()}</span>
            <span class="mt-mcard__face mt-mcard__front" aria-hidden="true">${visible ? face : ''}</span>
          </span>
        </button>
      `;
    }).join('');

    section.innerHTML = `
      ${app.heading(page.id, L('Conheça o projeto brasileiro e associe cada imagem ao seu conceito.', 'Meet the Brazilian project and match each image to its concept.'), L('Pontos = acertos ÷ tentativas', 'Points = hits ÷ tries'))}
      ${app.video('cobra', media.cobraVideoUrl, media.cobraVideoTitle || '01. Maglev Cobra', 63, L('O trecho começa em 1:03.', 'The clip starts at 1:03.'))}
      <section class="mt-card mt-memory" aria-labelledby="memory-title">
        <div class="mt-card__head">
          <h2 id="memory-title">${L('Encontre os seis pares', 'Find the six pairs')}</h2>
          <span class="mt-chip ${memory.complete ? 'mt-chip--success' : ''}">${L(`${memory.matched.length} / 6 pares · ${memory.moves} tentativas`, `${memory.matched.length} / 6 pairs · ${memory.moves} tries`)}${memory.skipped.length ? L(` · ${memory.skipped.length} pulado${memory.skipped.length === 1 ? '' : 's'}`, ` · ${memory.skipped.length} skipped`) : ''}</span>
        </div>
        <p id="memory-status" class="mt-feedback ${memory.complete ? 'is-success' : memory.open.length === 2 ? 'is-error' : ''}" role="status" tabindex="-1">
          ${memory.complete
            ? L('✓ Jogo concluído! A próxima página foi liberada.', '✓ Game complete! The next page is unlocked.')
            : memory.open.length === 2
              ? L('Essas duas cartas não formam um par. Clique em “Virar de volta” para tentar outras.', 'These two cards are not a pair. Click “Flip back” to try others.')
              : L('Vire duas cartas: uma imagem e a descrição que combina com ela.', 'Flip two cards: an image and the description that matches it.')}
        </p>
        <div class="mt-memory-grid" role="group" aria-label="${L('Doze cartas do jogo da memória', 'Twelve memory game cards')}">${cardHtml}</div>
        <div class="mt-card__foot mt-card__foot--center">
          ${memory.open.length === 2 ? `<button type="button" class="mt-btn mt-btn--primary" data-action="hide-mismatch">${L('Virar de volta', 'Flip back')}</button>` : ''}
          ${!memory.complete ? `<button type="button" class="mt-btn mt-btn--secondary" data-action="skip-memory-pair" aria-label="${L('Pular um par sem encontrá-lo. Conta como erro e mostra onde ele estava.', 'Skip a pair without finding it. It counts as a mistake and shows where it was.')}">${L('Pular par', 'Skip pair')}</button>` : ''}
          ${!memory.complete && memory.moves > 0 ? `<button type="button" class="mt-link" data-action="reset-task" data-task="memory">${L('Embaralhar e recomeçar', 'Shuffle and restart')}</button>` : ''}
          ${memory.complete ? `<button type="button" class="mt-btn mt-btn--primary" data-action="next-page">${L('Continuar', 'Continue')} →</button>` : ''}
        </div>
      </section>
      ${renderMatching(app)}
      <aside class="mt-callout mt-callout--soft">
        ${L('<strong>Precisão histórica:</strong> as cartas de energia solar e emissão zero representam possibilidades de um sistema sustentável; não indicam que esses recursos já estejam instalados no protótipo.', '<strong>Historical accuracy:</strong> the solar energy and zero emission cards show possibilities for a sustainable system; they do not mean these features are already installed on the prototype.')}
      </aside>
      <details class="mt-details">
        <summary>${L('Créditos e licenças das imagens', 'Image credits and licenses')}</summary>
        <p><strong>MaglevCobra</strong>, Cristina Indio do Brasil/Agência Brasil, CC BY 3.0 BR. <strong>YBCO-modified</strong>, Puppy8800, CC BY-SA 3.0. <strong>Magnet 4</strong>, Peter Nussbaumer, CC BY-SA 3.0. <strong>Cooling superconductor by liquid nitrogen</strong>, Ainur physicist, CC BY 4.0. ${L('Os ícones de energia solar e sustentabilidade são ilustrações vetoriais originais.', 'The solar energy and sustainability icons are original vector illustrations.')}</p>
      </details>
    `;
  }

  function openCard(app, position) {
    const memory = app.state.tasks.memory;
    const cardId = deckIds(memory)[position];
    if (cardId === undefined || memory.complete || memory.open.includes(cardId) || isSettled(memory, pairOf(cardId)) || memory.open.length >= 2) {
      return;
    }
    memory.open.push(cardId);
    if (memory.open.length === 1) {
      app.saveState();
      app.render({ focusSelector: '.mt-memory-grid button:not(:disabled)' });
      app.announce(L(`Primeira carta: ${describe(cardId)}. Escolha a segunda.`, `First card: ${describe(cardId)}. Choose the second one.`));
      return;
    }

    memory.moves += 1;
    const [firstId, secondId] = memory.open;
    const firstPair = pairOf(firstId);
    const secondPair = pairOf(secondId);
    if (firstPair === secondPair) {
      memory.matched = Array.from(new Set(memory.matched.concat([firstPair]))).sort((a, b) => a - b);
      memory.open = [];
      if (!finishIfSettled(app)) {
        app.saveState();
        app.render({ focusSelector: '.mt-memory-grid button:not(:disabled)' });
        app.announce(L(`Par correto: ${describe(secondId)}. ${memory.matched.length} de 6 pares.`, `Correct pair: ${describe(secondId)}. ${memory.matched.length} of 6 pairs.`));
      }
      return;
    }
    app.recordConceptError(PAIRS[firstPair].concept, 0.5);
    app.recordConceptError(PAIRS[secondPair].concept, 0.5);
    memory.mismatches[firstPair] = Number(memory.mismatches[firstPair] || 0) + 1;
    memory.mismatches[secondPair] = Number(memory.mismatches[secondPair] || 0) + 1;
    app.saveState();
    app.render({ focusSelector: '[data-action="hide-mismatch"]' });
    app.announce(L(`Segunda carta: ${describe(secondId)}. Não formam um par.`, `Second card: ${describe(secondId)}. They are not a pair.`));
  }

  // Ends the card game once every pair was found or skipped. Skips were
  // already counted as tries without a hit. Returns true when it finished.
  function finishIfSettled(app) {
    const memory = app.state.tasks.memory;
    if (memory.matched.length + memory.skipped.length < PAIRS.length) {
      return false;
    }
    memory.complete = true;
    memory.attempts += 1;
    // Score from the mode the student played: the cards, or only the
    // matching list (then its checks hold the real tries).
    const skips = memory.skipped.length;
    const listOnly = memory.moves === skips && memory.matchingTries > skips;
    const hits = listOnly ? memory.matchingHits : memory.matched.length;
    const tries = listOnly ? memory.matchingTries : memory.moves;
    app.completeActivity('memory', accuracyScore(hits, tries), {
      matched: memory.matched.length, max: PAIRS.length, moves: memory.moves, skipped: skips,
      mode: listOnly ? 'matching' : 'cards', acertos: hits, tentativas: tries
    });
    app.saveState();
    app.render({ focusSelector: '#memory-status' });
    app.announce(memory.skipped.length
      ? L(`Jogo concluído: ${memory.matched.length} de 6 pares encontrados e ${memory.skipped.length} pulado${memory.skipped.length === 1 ? '' : 's'}. A próxima página foi liberada.`,
        `Game complete: ${memory.matched.length} of 6 pairs found and ${memory.skipped.length} skipped. The next page is unlocked.`)
      : L('Todos os seis pares foram encontrados! A próxima página foi liberada.', 'All six pairs were found! The next page is unlocked.'));
    return true;
  }

  // Skip: reveals the first pair not yet settled, counts one try without a
  // hit in both modes (cards and matching list) and records the concept
  // error. As in the other pages, the answer shows only after the skip.
  function skipPair(app) {
    const memory = app.state.tasks.memory;
    if (memory.complete) {
      return;
    }
    const pairIndex = PAIRS.findIndex((_, index) => !isSettled(memory, index));
    if (pairIndex < 0) {
      return;
    }
    const pair = PAIRS[pairIndex];
    memory.open = [];
    memory.skipped = memory.skipped.concat([pairIndex]);
    memory.moves += 1;
    memory.matchingTries += 1;
    // The matching list shows the skipped row already answered and locked.
    const answers = memory.matchingAnswers;
    Object.keys(answers).forEach((otherId) => {
      if (answers[otherId] === pair.id) {
        delete answers[otherId];
      }
    });
    answers[pair.id] = pair.id;
    app.recordConceptError(pair.concept, 1);
    if (finishIfSettled(app)) {
      return;
    }
    app.saveState();
    app.render({ focusSelector: '[data-action="skip-memory-pair"]' });
    app.announce(L(`Par pulado. Conta como erro. O par era: ${pair.shortLabel} com “${pair.label}”.`,
      `Pair skipped. It counts as a mistake. The pair was: ${pair.shortLabel} with “${pair.label}”.`));
  }

  function checkMatching(app) {
    const memory = app.state.tasks.memory;
    if (memory.complete) {
      return;
    }
    const answers = memory.matchingAnswers;
    const missing = PAIRS.filter((pair) => !answers[pair.id]);
    if (missing.length) {
      app.ui.matching = { checked: true, message: L(`Faltam ${missing.length} escolha${missing.length === 1 ? '' : 's'}.`, `${missing.length} choice${missing.length === 1 ? '' : 's'} missing.`) };
      app.render({ focusSelector: '#matching-status' });
      app.announce(app.ui.matching.message);
      return;
    }
    const correct = PAIRS.filter((pair) => answers[pair.id] === pair.id);
    // Each check counts every row as one try; correct rows add hits.
    // Skipped rows were already counted as a try without a hit.
    const playable = PAIRS.filter((_, index) => !memory.skipped.includes(index));
    const playableCorrect = playable.filter((pair) => answers[pair.id] === pair.id);
    memory.matchingTries += playable.length;
    memory.matchingHits += playableCorrect.length;
    app.ui.matching = { checked: true, message: L(`${correct.length} de 6 associações corretas.`, `${correct.length} of 6 matches correct.`) };
    playable.filter((pair) => answers[pair.id] !== pair.id).forEach((pair) => app.recordConceptError(pair.concept, 1));
    if (correct.length === PAIRS.length) {
      memory.complete = true;
      memory.attempts += 1;
      memory.matched = PAIRS.map((_, index) => index).filter((index) => !memory.skipped.includes(index));
      app.completeActivity('memory', accuracyScore(memory.matchingHits, memory.matchingTries), {
        matched: PAIRS.length, max: PAIRS.length, moves: 0, mode: 'matching',
        acertos: memory.matchingHits, tentativas: memory.matchingTries
      });
      app.saveState();
      app.render({ focusSelector: '#memory-status' });
      app.announce(L('Seis de seis! A próxima página foi liberada.', 'Six out of six! The next page is unlocked.'));
    } else {
      app.saveState();
      app.render({ focusSelector: '#matching-status' });
      app.announce(app.ui.matching.message);
    }
  }

  const page = {
    id: 5,
    get short() { return L('Memória', 'Memory'); },
    get title() { return L('MagLev-Cobra: jogo da memória', 'MagLev-Cobra: memory game'); },
    get unlockHint() { return L('Encontre os seis pares para avançar.', 'Find the six pairs to move on.'); },
    task: 'memory',
    init,
    reset(app) {
      const previousSeed = Number(app.state.tasks.memory.seed) || 20260924;
      app.state.tasks.memory = ns.Storage.createDefaultState().tasks.memory;
      app.state.tasks.memory.seed = (previousSeed * 7 + 13) % 2147483647 || 1;
      app.ui.matching = {};
      init(app);
    },
    render,
    actions: {
      'memory-card': (app, trigger) => openCard(app, Number(trigger.dataset.position)),
      'hide-mismatch': (app) => {
        app.state.tasks.memory.open = [];
        app.saveState();
        app.render({ focusSelector: '.mt-memory-grid button:not(:disabled)' });
        app.announce(L('As duas cartas que não combinaram foram viradas de volta.', 'The two cards that did not match were flipped back.'));
      },
      'check-matching': checkMatching,
      'skip-memory-pair': skipPair
    },
    events: {
      change(app, event) {
        const matching = event.target.closest('[data-role="matching-select"]');
        if (!matching) {
          return;
        }
        const pairId = matching.dataset.pairId;
        if (!PAIRS.some((pair) => pair.id === pairId)) {
          return;
        }
        const answers = app.state.tasks.memory.matchingAnswers;
        if (matching.value === '') {
          delete answers[pairId];
        } else {
          // Release the answer from any other row that still holds it.
          const skippedIds = app.state.tasks.memory.skipped.map((index) => PAIRS[index].id);
          if (skippedIds.includes(matching.value)) {
            return;
          }
          Object.keys(answers).forEach((otherId) => {
            if (otherId !== pairId && answers[otherId] === matching.value) {
              delete answers[otherId];
            }
          });
          answers[pairId] = matching.value;
        }
        syncMatchingSelects(matching.closest('.mt-matching'), answers);
        app.saveState();
      }
    }
  };

  // Updates the selects in place (no re-render, so focus stays put).
  function syncMatchingSelects(form, answers) {
    if (!form) {
      return;
    }
    const used = Object.values(answers);
    form.querySelectorAll('[data-role="matching-select"]').forEach((select) => {
      const own = answers[select.dataset.pairId] || '';
      select.value = own;
      Array.from(select.options).forEach((option) => {
        option.disabled = option.value !== '' && option.value !== own && used.includes(option.value);
      });
    });
  }

  (ns.pages = ns.pages || []).push(page);
})(window.H5P = window.H5P || {});
