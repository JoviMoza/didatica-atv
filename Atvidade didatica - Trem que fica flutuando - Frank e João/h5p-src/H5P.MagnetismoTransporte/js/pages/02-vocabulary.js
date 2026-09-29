(function (H5P) {
  'use strict';

  /* Page 2 — "As palavras do magnetismo" (Drag the Words, 5 points).
   * The student drags (or taps) a word into a blank. Only right placements
   * stay; the score is the full 5 points on completion. Which word belongs
   * to which blank is sealed in js/data/bank.js. */

  const ns = H5P.MagnetismoTransporte;
  const { escapeHtml } = ns.Util;
  const { I18n } = ns;
  const L = I18n.L;
  const DRAG = ns.Bank.dragWords;
  const key = ns.AnswerKey.create(ns.Bank.salt);
  const TERM_IDS = DRAG.terms.map((term) => term.id);
  const SLOT_COUNT = DRAG.slots.length;
  const { UI } = ns;
  const { SKIP_AFTER_TRIES } = ns.Activities;

  function findTerm(tokenId) {
    return DRAG.terms.find((term) => term.id === tokenId) || null;
  }

  // Word as shown to the student, in the interface language.
  function termText(term) {
    return I18n.field(term, 'text');
  }

  function sentenceParts() {
    return I18n.isEnglish() && DRAG.sentenceEn ? DRAG.sentenceEn : DRAG.sentence;
  }

  // Returns the concept sealed for this blank when tokenId is the right word.
  function openSlot(index, tokenId) {
    return tokenId ? key.open(DRAG.slots[index], ['drag', `slot-${index}`, tokenId]) : null;
  }

  function isPlaced(task, index) {
    return openSlot(index, task.placements[`slot-${index}`]) !== null;
  }

  function isSkipped(task, index) {
    return Boolean(task.skipped[`slot-${index}`]);
  }

  // The right term of a skipped blank, revealed only after the skip.
  function skippedTerm(index) {
    const expected = key.reveal(DRAG.slots[index], ['drag', `slot-${index}`], TERM_IDS);
    return (expected && findTerm(expected.answer)) || null;
  }

  function slotIndex(slotId) {
    const match = /^slot-(\d+)$/.exec(String(slotId || ''));
    const index = match ? Number(match[1]) : -1;
    return index >= 0 && index < SLOT_COUNT ? index : -1;
  }

  function dragSlot(app, index) {
    const task = app.state.tasks.dragWords;
    const token = findTerm(task.placements[`slot-${index}`]);
    const isCorrect = isPlaced(task, index);
    if (!isCorrect && isSkipped(task, index)) {
      const answer = skippedTerm(index);
      const label = answer ? termText(answer) : L(`lacuna ${index + 1}`, `blank ${index + 1}`);
      return `<button type="button" class="mt-slot is-skipped"
      data-slot-id="slot-${index}"
      aria-label="${L(`Espaço ${index + 1}: pulado, resposta ${escapeHtml(label)}`, `Blank ${index + 1}: skipped, answer ${escapeHtml(label)}`)}"
      disabled>${escapeHtml(label)}</button>`;
    }
    const label = isCorrect && token ? termText(token) : L(`lacuna ${index + 1}`, `blank ${index + 1}`);
    return `<button type="button" class="mt-slot ${isCorrect ? 'is-correct' : ''} ${app.ui.dragToken && !isCorrect ? 'is-target' : ''}"
      data-action="place-drag-token" data-slot-id="slot-${index}" data-role="drag-slot"
      aria-label="${L('Espaço', 'Blank')} ${index + 1}: ${isCorrect ? escapeHtml(label) + L(', correto', ', correct') : L('vazio', 'empty')}"
      ${isCorrect ? 'disabled' : ''}>${escapeHtml(label)}</button>`;
  }

  function render(app, section) {
    const task = app.state.tasks.dragWords;
    const selected = app.ui.dragToken;
    const used = new Set();
    Array.from({ length: SLOT_COUNT }, (_, index) => {
      if (isPlaced(task, index)) {
        used.add(task.placements[`slot-${index}`]);
      } else if (isSkipped(task, index)) {
        const answer = skippedTerm(index);
        if (answer) {
          used.add(answer.id);
        }
      }
    });
    const pool = DRAG.terms
      .filter((term) => !used.has(term.id))
      .sort((a, b) => termText(a).localeCompare(termText(b), I18n.get()));
    const correctCount = Array.from({ length: SLOT_COUNT }, (_, index) => isPlaced(task, index)).filter(Boolean).length;
    const skippedCount = Array.from({ length: SLOT_COUNT }, (_, index) => isSkipped(task, index)).filter(Boolean).length;
    const remaining = SLOT_COUNT - correctCount - skippedCount;

    const sentence = sentenceParts().map((text, index) => (
      escapeHtml(text) + (index < SLOT_COUNT ? dragSlot(app, index) : '')
    )).join('');

    section.innerHTML = `
      ${app.heading(page.id, L('Complete o texto com os cinco termos que explicam o experimento.', 'Complete the text with the five terms that explain the experiment.'), L('Vale 5 pontos', 'Worth 5 points'))}
      <section class="mt-card mt-drag" aria-labelledby="drag-task-title">
        <div class="mt-card__head">
          <h2 id="drag-task-title">${L('Banco de palavras', 'Word bank')}</h2>
          <span class="mt-chip ${task.complete ? 'mt-chip--success' : ''}">${correctCount} / ${SLOT_COUNT}</span>
        </div>
        <p class="mt-muted mt-small">${L('Arraste uma palavra até um espaço — ou toque na palavra e depois no espaço. Há duas palavras que não pertencem ao texto.', 'Drag a word to a blank — or tap the word and then the blank. Two words do not belong in the text.')}</p>
        <div class="mt-token-bank" role="group" aria-label="${L('Palavras disponíveis', 'Available words')}">
          ${pool.length ? pool.map((term) => `
            <button type="button" class="mt-token ${selected === term.id ? 'is-selected' : ''}"
              data-action="select-drag-token" data-token-id="${escapeHtml(term.id)}" data-role="drag-token"
              draggable="true" aria-pressed="${selected === term.id ? 'true' : 'false'}"
              ${task.complete ? 'disabled' : ''}>${escapeHtml(termText(term))}</button>
          `).join('') : `<span class="mt-muted">${L('Todas as palavras foram usadas.', 'All the words have been used.')}</span>`}
        </div>
        <p class="mt-reading">${sentence}</p>
        <div class="mt-card__foot">
          <p class="mt-feedback ${task.complete ? 'is-success' : ''}" id="drag-feedback" role="status" tabindex="-1">
            ${task.complete
              ? L(`✓ Atividade concluída: ${correctCount} de ${SLOT_COUNT} termos${skippedCount ? ` (${skippedCount} pulada${skippedCount === 1 ? '' : 's'})` : ''}. A próxima página foi liberada.`,
                `✓ Activity complete: ${correctCount} of ${SLOT_COUNT} terms${skippedCount ? ` (${skippedCount} skipped)` : ''}. The next page is unlocked.`)
              : L(`${remaining} espaço${remaining === 1 ? '' : 's'} ainda ${remaining === 1 ? 'resta' : 'restam'}.${selected ? ' Agora toque em um espaço.' : ''}`,
                `${remaining} blank${remaining === 1 ? '' : 's'} left.${selected ? ' Now tap a blank.' : ''}`)}
          </p>
          ${!task.complete ? skipControl(task) : ''}
          ${task.complete && app.allowRetry()
            ? `<button type="button" class="mt-link" data-action="reset-task" data-task="dragWords">${L('Praticar novamente', 'Practice again')}</button>`
            : ''}
        </div>
      </section>
    `;
  }

  function selectToken(app, tokenId) {
    const term = findTerm(tokenId);
    if (!term || app.state.tasks.dragWords.complete) {
      return;
    }
    app.ui.dragToken = app.ui.dragToken === tokenId ? null : tokenId;
    app.render({ focusSelector: `[data-token-id="${CSS.escape(tokenId)}"]` });
    app.announce(app.ui.dragToken
      ? L(`${termText(term)} selecionada. Escolha um espaço no texto.`, `${termText(term)} selected. Choose a blank in the text.`)
      : L('Seleção cancelada.', 'Selection canceled.'));
  }

  function placeToken(app, slotId, tokenId) {
    const task = app.state.tasks.dragWords;
    const index = slotIndex(slotId);
    const chosen = findTerm(tokenId);
    if (index < 0 || !chosen || task.complete || isPlaced(task, index)) {
      return;
    }
    app.ui.dragToken = null;

    if (openSlot(index, chosen.id) === null) {
      const expected = key.reveal(DRAG.slots[index], ['drag', slotId], TERM_IDS);
      task.mistakes[slotId] = Number(task.mistakes[slotId] || 0) + 1;
      app.recordConceptError(expected && expected.payload, 1);
      app.recordConceptError(chosen.concept, 1);
      app.saveState();
      app.render({ focusSelector: `[data-slot-id="${slotId}"]` });
      const slot = app.section(page.id).querySelector(`[data-slot-id="${slotId}"]`);
      if (slot) {
        slot.classList.add('is-wrong');
      }
      app.announce(L(`${termText(chosen)} não pertence a este espaço. A palavra voltou ao banco.`, `${termText(chosen)} does not belong in this blank. The word went back to the bank.`));
      return;
    }

    task.placements[slotId] = chosen.id;
    const correctCount = Array.from({ length: SLOT_COUNT }, (_, i) => isPlaced(task, i)).filter(Boolean).length;
    const skippedCount = Array.from({ length: SLOT_COUNT }, (_, i) => isSkipped(task, i)).filter(Boolean).length;
    task.attempts = correctCount;
    if (correctCount + skippedCount === SLOT_COUNT) {
      task.complete = true;
      app.completeActivity('dragWords', correctCount, { correct: correctCount, max: SLOT_COUNT, skipped: skippedCount });
      app.saveState();
      app.render({ focusSelector: '#drag-feedback' });
      app.announce(L(`Atividade concluída: ${correctCount} de ${SLOT_COUNT}. A próxima página foi liberada.`, `Activity complete: ${correctCount} of ${SLOT_COUNT}. The next page is unlocked.`));
    } else {
      app.saveState();
      app.render({ focusSelector: '.mt-token' });
      app.announce(L(`${termText(chosen)}: resposta correta.`, `${termText(chosen)}: correct answer.`));
    }
  }

  // Open blanks (not placed, not skipped) in text order.
  function openIndexes(task) {
    return Array.from({ length: SLOT_COUNT }, (_, i) => i).filter((i) => !isPlaced(task, i) && !isSkipped(task, i));
  }

  function wrongTries(task, index) {
    return Number(task.mistakes[`slot-${index}`] || 0);
  }

  // The blank that "Pular lacuna" would skip: the first open one with at
  // least SKIP_AFTER_TRIES wrong tries. undefined = none yet.
  function skippableIndex(task) {
    return openIndexes(task).find((i) => wrongTries(task, i) >= SKIP_AFTER_TRIES);
  }

  function skipControl(task) {
    const index = skippableIndex(task);
    const ready = index !== undefined;
    // Not ready: show the progress of the blank closest to unlocking.
    const tries = ready ? SKIP_AFTER_TRIES : Math.max(0, ...openIndexes(task).map((i) => wrongTries(task, i)));
    return UI.skipButton({
      action: 'skip-drag-gap', data: '', hintId: 'drag-skip-hint', ready, tries,
      label: ready ? L(`Pular lacuna ${index + 1}`, `Skip blank ${index + 1}`) : L('Pular lacuna', 'Skip blank'),
      aria: ready ? L(`Pular a lacuna ${index + 1} sem responder. Conta como erro.`, `Skip blank ${index + 1} without answering. It counts as a mistake.`) : L('Pular lacuna', 'Skip blank'),
      scope: L('em uma lacuna', 'on one blank')
    });
  }

  // Skipping locks a blank (the first one with enough wrong tries) with its right answer revealed: it
  // counts as wrong (only correct placements score), the concept goes to
  // review, and the page unlocks once every blank is filled or skipped.
  function skipGap(app) {
    const task = app.state.tasks.dragWords;
    if (task.complete) {
      return;
    }
    const index = skippableIndex(task);
    if (index === undefined) {
      return;
    }
    const slotId = `slot-${index}`;
    task.skipped[slotId] = true;
    const expected = skippedTerm(index);
    if (expected) {
      app.recordConceptError(expected.concept, 1);
    }
    const correctCount = Array.from({ length: SLOT_COUNT }, (_, i) => isPlaced(task, i)).filter(Boolean).length;
    const skippedCount = Array.from({ length: SLOT_COUNT }, (_, i) => isSkipped(task, i)).filter(Boolean).length;
    if (correctCount + skippedCount === SLOT_COUNT) {
      task.complete = true;
      task.attempts = correctCount;
      app.completeActivity('dragWords', correctCount, { correct: correctCount, max: SLOT_COUNT, skipped: skippedCount });
    }
    app.saveState();
    app.render({ focusSelector: '#drag-feedback' });
    const answer = skippedTerm(index);
    app.announce(L(`Lacuna ${index + 1} pulada. Conta como erro.${answer ? ` A resposta era ${termText(answer)}.` : ''}`,
      `Blank ${index + 1} skipped. It counts as a mistake.${answer ? ` The answer was ${termText(answer)}.` : ''}`));
  }

  const page = {
    id: 2,
    get short() { return L('Vocabulário', 'Vocabulary'); },
    get title() { return L('As palavras do magnetismo', 'The words of magnetism'); },
    get unlockHint() { return L('Complete as cinco lacunas para liberar a próxima página.', 'Fill in the five blanks to unlock the next page.'); },
    task: 'dragWords',
    render,
    reset(app) {
      app.state.tasks.dragWords = ns.Storage.createDefaultState().tasks.dragWords;
      app.ui.dragToken = null;
    },
    actions: {
      'select-drag-token': (app, trigger) => selectToken(app, trigger.dataset.tokenId),
      'place-drag-token': (app, trigger) => placeToken(app, trigger.dataset.slotId, app.ui.dragToken),
      'skip-drag-gap': (app) => skipGap(app)
    },
    events: {
      dragstart(app, event) {
        const token = event.target.closest('[data-role="drag-token"]');
        if (!token) {
          return;
        }
        app.ui.dragToken = token.dataset.tokenId;
        token.classList.add('is-selected');
        if (event.dataTransfer) {
          event.dataTransfer.effectAllowed = 'move';
          event.dataTransfer.setData('text/plain', token.dataset.tokenId);
        }
      },
      dragover(app, event) {
        const slot = event.target.closest('[data-role="drag-slot"]');
        if (!slot || slot.disabled) {
          return;
        }
        event.preventDefault();
        if (event.dataTransfer) {
          event.dataTransfer.dropEffect = 'move';
        }
        slot.classList.add('is-drag-over');
      },
      dragleave(app, event) {
        const slot = event.target.closest('[data-role="drag-slot"]');
        if (slot) {
          slot.classList.remove('is-drag-over');
        }
      },
      drop(app, event) {
        const slot = event.target.closest('[data-role="drag-slot"]');
        if (!slot) {
          return;
        }
        event.preventDefault();
        const tokenId = (event.dataTransfer && event.dataTransfer.getData('text/plain')) || app.ui.dragToken;
        placeToken(app, slot.dataset.slotId, tokenId);
      }
    }
  };

  (ns.pages = ns.pages || []).push(page);
})(window.H5P = window.H5P || {});
