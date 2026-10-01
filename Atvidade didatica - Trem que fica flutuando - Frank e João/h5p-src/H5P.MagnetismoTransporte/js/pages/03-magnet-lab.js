(function (H5P) {
  'use strict';

  /* Page 3 — "Laboratório de ímãs" (exploration, no points).
   * Four magnets the student rotates with pointer, buttons or keyboard.
   * Unlocks page 4 after three steps: answer q1, align the magnets,
   * answer q2. The SVG is updated in place while dragging (never via
   * innerHTML), so pointer capture is kept. Physics: js/lab/physics.js. */

  const ns = H5P.MagnetismoTransporte;
  const { escapeHtml } = ns.Util;
  const { I18n } = ns;
  const L = I18n.L;
  const { normalizeAngle, defaultAngles, MAGNET_MIN, MAGNET_MAX } = ns.Storage;
  const Physics = ns.Physics;
  const LAB = Physics.LAB;
  const QUESTIONS = ns.Bank.lab;
  const { UI } = ns;
  const { SKIP_AFTER_TRIES } = ns.Activities;
  const key = ns.AnswerKey.create(ns.Bank.salt);

  function section(app) {
    return app.section(page.id);
  }

  // The magnets sit on a circle and are numbered: "Ímã 1", "Magnet 3",
  // "Imán 3". Numbering survives any change in the number of magnets.
  function magnetName(position) {
    const number = position.index + 1;
    return L(`Ímã ${number}`, `Magnet ${number}`, `Imán ${number}`);
  }

  // Success text of the question when the saved answer is right, else null.
  function openAnswer(app, id) {
    const magnets = app.state.tasks.magnets;
    const answer = magnets.answers[id];
    const opened = magnets.checked[id] && answer ? key.open(QUESTIONS[id].seal, ['lab', id, answer]) : null;
    return opened === null ? null : I18n.payload(opened);
  }

  function questionCorrect(app, id) {
    return openAnswer(app, id) !== null;
  }

  function questionSkipped(app, id) {
    return Boolean(app.state.tasks.magnets.skipped[id]);
  }

  // A step is done when answered right or skipped (skip counts as error).
  function stepDone(app, id) {
    return questionCorrect(app, id) || questionSkipped(app, id);
  }

  function updateCompletion(app) {
    const magnets = app.state.tasks.magnets;
    if (!magnets.done && stepDone(app, 'q1') && magnets.missions.aligned && stepDone(app, 'q2')) {
      magnets.done = true;
    }
  }

  /* ------------------------------ markup ------------------------------ */

  // Magnet counter plus add/remove, grouped with the measurements so the
  // student finds them in the panel instead of hunting for a stray button.
  // Both ends of the range are stated: a disabled button with a label that
  // explains why reads as "finished", never as broken.
  function magnetCountControl(app) {
    const count = app.state.tasks.magnets.count;
    const full = count >= MAGNET_MAX;
    const fewest = count <= MAGNET_MIN;
    return `
      <div class="mt-magnets-count">
        <span class="mt-magnets-count__label">${L('Ímãs na cena', 'Magnets on stage', 'Imanes en la escena')}</span>
        <div class="mt-magnets-count__row">
          <button type="button" class="mt-magnets-count__btn mt-magnets-count__btn--minus"
            data-action="remove-magnet" ${fewest ? 'disabled' : ''}
            aria-label="${L(`Retirar um ímã (faltam ${count - MAGNET_MIN} para o mínimo)`, `Remove one magnet (${count - MAGNET_MIN} more down to the minimum)`, `Quitar un imán (${count - MAGNET_MIN} más hasta el mínimo)`)}">
            <span aria-hidden="true">&minus;</span>
          </button>
          <span class="mt-magnets-count__value" aria-live="polite">
            <strong>${count}</strong>
            <span class="mt-magnets-count__max">/ ${MAGNET_MAX}</span>
          </span>
          <button type="button" class="mt-magnets-count__btn mt-magnets-count__btn--plus"
            data-action="add-magnet" ${full ? 'disabled' : ''}
            aria-label="${full
              ? L(`Limite de ${MAGNET_MAX} ímãs atingido`, `Maximum of ${MAGNET_MAX} magnets reached`, `Límite de ${MAGNET_MAX} imanes alcanzado`)
              : L(`Acrescentar um ímã (restam ${MAGNET_MAX - count})`, `Add one magnet (${MAGNET_MAX - count} left)`, `Añadir un imán (quedan ${MAGNET_MAX - count})`)}">
            <span aria-hidden="true">+</span>
          </button>
        </div>
        <span class="mt-magnets-count__hint">${escapeHtml(
          fewest
            ? L(`Mínimo de ${MAGNET_MIN} ímãs`, `Minimum of ${MAGNET_MIN} magnets`, `Mínimo de ${MAGNET_MIN} imanes`)
            // Not "on the circle": with 4 magnets they sit in the four corners
            // of the stage, which is the arrangement the activity used to have.
            : L('Cada ímã entra em ponto equidistante ao redor do centro.', 'Each magnet is placed equidistantly around the centre.', 'Cada imán se coloca equidistante alrededor del centro.')
        )}</span>
      </div>
    `;
  }

  function labSvg(count) {
    const magnetsMarkup = Physics.positions(count).map((position, index) => {
      const halfL = LAB.magnetLength / 2;
      const halfW = LAB.magnetWidth / 2;
      return `
        <g class="mt-magnet" data-role="magnet" data-magnet="${index}" tabindex="0" role="slider"
           aria-label="${escapeHtml(magnetName(position))}" aria-valuemin="0" aria-valuemax="345"
           transform="translate(${position.x} ${position.y})">
          <circle class="mt-magnet__ring" r="${halfL + 16}"/>
          <path class="mt-magnet__cue" d="M ${halfL + 6} -22 A ${halfL + 16} ${halfL + 16} 0 0 1 ${halfL + 6} 22" />
          <g class="mt-magnet__body" data-role="magnet-body">
            <rect class="mt-magnet__shadow" x="${-halfW + 3}" y="${-halfL + 5}" width="${LAB.magnetWidth}" height="${LAB.magnetLength}" rx="10"/>
            <rect class="mt-magnet__s" x="${-halfW}" y="0" width="${LAB.magnetWidth}" height="${halfL}" rx="10"/>
            <rect class="mt-magnet__n" x="${-halfW}" y="${-halfL}" width="${LAB.magnetWidth}" height="${halfL}" rx="10"/>
            <rect class="mt-magnet__seam" x="${-halfW}" y="-6" width="${LAB.magnetWidth}" height="12"/>
            <rect class="mt-magnet__seam mt-magnet__seam--s" x="${-halfW}" y="0" width="${LAB.magnetWidth}" height="6"/>
            <text class="mt-magnet__label" data-role="label-n" x="0" y="${-halfL / 2}">N</text>
            <text class="mt-magnet__label" data-role="label-s" x="0" y="${halfL / 2}">S</text>
          </g>
        </g>
      `;
    }).join('');
    return `
      <svg class="mt-lab__svg" viewBox="0 0 ${LAB.width} ${LAB.height}" aria-labelledby="mt-lab-title mt-lab-desc" role="group">
        <title id="mt-lab-title">${L(`Simulação com ${count} ímãs em círculo`, `${count} magnets in a circle`, `${count} imanes en círculo`)}</title>
        <desc id="mt-lab-desc" data-role="lab-desc"></desc>
        <defs>
          <pattern id="mt-lab-grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M40 0H0V40" fill="none" class="mt-lab__gridline"/>
          </pattern>
        </defs>
        <rect class="mt-lab__bg" width="${LAB.width}" height="${LAB.height}" rx="18"/>
        <rect width="${LAB.width}" height="${LAB.height}" rx="18" fill="url(#mt-lab-grid)"/>
        <g data-layer="compass" aria-hidden="true"></g>
        <g data-layer="lines" class="mt-lab__lines" aria-hidden="true"></g>
        <g data-layer="probe" aria-hidden="true"></g>
        ${magnetsMarkup}
      </svg>
    `;
  }

  function render(app, target) {
    // "Start with two" was true when the default was MAGNET_DEFAULT 2. The lab
    // ships with 4 (one per corner) and the student can add or remove from 2 to
    // 10, so the copy now says the range instead of a single number.
    const magnets = app.state.tasks.magnets;
    target.innerHTML = `
      ${app.heading(page.id, L('Gire os ímãs e veja, ao vivo, como o campo magnético muda. São 4 ímãs, um em cada canto; use os botões para acrescentar ou retirar, de 2 a 10. Arraste um ímã em círculo, use os botões ↺ ↻ ou selecione-o e use as setas do teclado.', 'Rotate the magnets and watch, live, how the magnetic field changes. There are 4 magnets, one in each corner; use the buttons to add or remove them, from 2 to 10. Drag a magnet in a circle, use the ↺ ↻ buttons, or select it and use the arrow keys.', 'Gira los imanes y observa, en vivo, cómo cambia el campo magnético. Hay 4 imanes, uno en cada esquina; usa los botones para añadir o quitarlos, de 2 a 10. Arrastra un imán en círculo, usa los botones ↺ ↻ o selecciónalo y usa las flechas del teclado.'), L('Exploração', 'Exploration', 'Exploración'))}
      <div class="mt-lab">
        <div class="mt-lab__stage">
          ${labSvg(magnets.count)}
          <div class="mt-lab__legend" aria-hidden="true">
            <span><i class="mt-dot mt-dot--n"></i>${L('Polo N', 'N pole', 'Polo N')}</span>
            <span><i class="mt-dot mt-dot--s"></i>${L('Polo S', 'S pole', 'Polo S')}</span>
            <span><i class="mt-dot mt-dot--line"></i>${L('Linha de campo', 'Field line', 'Línea de campo')}</span>
            <span><i class="mt-dot mt-dot--probe"></i>${L('Campo no centro', 'Field at the center', 'Campo en el centro')}</span>
          </div>
        </div>
        <aside class="mt-lab__panel" aria-label="${L('Medidas e opções', 'Measurements and options', 'Medidas y opciones')}">
          <div class="mt-meter">
            <div class="mt-meter__row"><span>${L('Alinhamento dos ímãs', 'Magnet alignment', 'Alineación de los imanes')}</span><strong data-role="align-value">0%</strong></div>
            <div class="mt-meter__bar"><span data-role="align-bar"></span></div>
          </div>
          <div class="mt-meter">
            <div class="mt-meter__row"><span>${L('Campo no centro', 'Field at the center', 'Campo en el centro')}</span><strong data-role="center-value">—</strong></div>
            <div class="mt-meter__bar mt-meter__bar--probe"><span data-role="center-bar"></span></div>
            <p class="mt-small mt-muted" data-role="center-text"></p>
          </div>
          ${magnetCountControl(app)}
          <fieldset class="mt-toggles">
            <legend>${L('Mostrar', 'Show', 'Mostrar')}</legend>
            <label class="mt-switch"><input type="checkbox" data-role="lab-toggle" value="lines" ${magnets.showLines ? 'checked' : ''}><span>${L('Linhas de campo', 'Field lines', 'Líneas de campo')}</span></label>
            <label class="mt-switch"><input type="checkbox" data-role="lab-toggle" value="compass" ${magnets.showCompass ? 'checked' : ''}><span>${L('Bússolas', 'Compasses', 'Brújulas')}</span></label>
          </fieldset>
          <button type="button" class="mt-btn mt-btn--secondary mt-btn--block" data-action="reset-magnets">↺ ${L('Posição inicial', 'Starting position', 'Posición inicial')}</button>
        </aside>
      </div>
      <div class="mt-lab__controls" role="group" aria-label="${L('Controles de rotação', 'Rotation controls', 'Controles de rotación')}">
        ${Physics.positions(magnets.count).map((position, index) => `
          <div class="mt-rot">
            <span class="mt-rot__name">${escapeHtml(magnetName(position))}</span>
            <div class="mt-rot__row">
              <button type="button" class="mt-icon-btn" data-action="rotate-magnet" data-magnet="${index}" data-delta="-${LAB.step}" aria-label="${L(`Girar ${magnetName(position)} ${LAB.step}° no sentido anti-horário`, `Rotate ${magnetName(position)} ${LAB.step}° counterclockwise`, `Girar ${magnetName(position)} ${LAB.step}° en sentido antihorario`)}">↺</button>
              <span class="mt-rot__angle" data-role="angle-label-${index}"></span>
              <button type="button" class="mt-icon-btn" data-action="rotate-magnet" data-magnet="${index}" data-delta="${LAB.step}" aria-label="${L(`Girar ${magnetName(position)} ${LAB.step}° no sentido horário`, `Rotate ${magnetName(position)} ${LAB.step}° clockwise`, `Girar ${magnetName(position)} ${LAB.step}° en sentido horario`)}">↻</button>
            </div>
          </div>
        `).join('')}
      </div>
      <div data-role="lab-guide"></div>
      <aside class="mt-science">
        <span class="mt-science__icon" aria-hidden="true">🧲</span>
        <div>
          <h2>${L('Ímãs sozinhos não fazem um trem flutuar', 'Magnets alone do not make a train float', 'Los imanes por sí solos no hacen flotar un tren')}</h2>
          <p>${L('Tente equilibrar um ímã sobre outro, com polos iguais frente a frente: ele escorrega para o lado. Só com ímãs permanentes não há equilíbrio estável (Teorema de Earnshaw). Por isso os trens Maglev usam eletroímãs controlados por computador ou supercondutores. Você vai ver como na página 6.', "Try to balance one magnet above another, with like poles facing each other: it slides to the side. With permanent magnets alone there is no stable equilibrium (Earnshaw's theorem). That is why Maglev trains use computer-controlled electromagnets or superconductors. You will see how on page 6.", 'Intenta equilibrar un imán sobre otro, con polos iguales enfrentados: se desliza hacia un lado. Solo con imanes permanentes no hay equilibrio estable (teorema de Earnshaw). Por eso los trenes Maglev usan electroimanes controlados por ordenador o superconductores. Lo verás en la página 6.')}</p>
        </div>
      </aside>
    `;
    renderGuide(app);
    updateScene(app);
  }

  function wrongTries(app, id) {
    return Number(app.state.tasks.magnets.tries[id] || 0);
  }

  // "Pular questão" stays disabled until SKIP_AFTER_TRIES wrong tries on
  // this question; the counter next to it says how many are left.
  function skipControl(app, id) {
    const tries = wrongTries(app, id);
    const ready = tries >= SKIP_AFTER_TRIES;
    return UI.skipButton({
      action: 'skip-lab', data: `data-question="${id}"`, hintId: `lab-skip-hint-${id}`, ready, tries,
      label: L('Pular questão', 'Skip question', 'Omitir pregunta'),
      aria: L('Pular esta pergunta. Conta como erro.', 'Skip this question. It counts as a mistake.', 'Omitir esta pregunta. Cuenta como error.')
    });
  }

  function questionHtml(app, id) {
    const question = QUESTIONS[id];
    const magnets = app.state.tasks.magnets;
    const answer = magnets.answers[id] || '';
    const checked = Boolean(magnets.checked[id]);
    const skipped = questionSkipped(app, id);
    const success = openAnswer(app, id);
    const correct = success !== null;
    const locked = checked || skipped;
    // After a skip the right option is highlighted with its explanation, so
    // the student still learns it. Nothing reveals it before answering.
    const revealed = skipped
      ? key.reveal(question.seal, ['lab', id], question.options.map((option) => option.id)) || { answer: null, payload: '' }
      : { answer: null, payload: '' };
    // The right option lights up only after a correct answer or a skip:
    // after a plain wrong answer the student must keep trying.
    const showCorrect = skipped || (checked && correct);
    const correctId = showCorrect
      ? (correct ? answer : revealed.answer)
      : null;
    const displaySuccess = correct ? success : I18n.payload(revealed.payload);
    return `
      <p class="mt-question">${escapeHtml(I18n.field(question, 'prompt'))}</p>
      <fieldset class="mt-choices" ${locked ? 'disabled' : ''}>
        <legend class="mt-sr-only">${escapeHtml(I18n.field(question, 'prompt'))}</legend>
        ${question.options.map((option) => `
          <label class="mt-choice ${showCorrect && option.id === correctId ? 'is-correct' : ''} ${checked && !correct && !skipped && option.id === answer ? 'is-wrong' : ''}">
            <input type="radio" name="lab-${id}" value="${escapeHtml(option.id)}" ${answer === option.id ? 'checked' : ''} ${locked ? 'disabled' : ''}>
            <span>${escapeHtml(I18n.field(option, 'text'))}</span>
          </label>
        `).join('')}
      </fieldset>
      <div class="mt-card__foot">
        <p id="lab-feedback-${id}" class="mt-feedback ${locked ? (correct ? 'is-success' : 'is-error') : ''}" role="status" tabindex="-1">
          ${skipped ? escapeHtml(`${L('Questão pulada (conta como erro).', 'Question skipped (counts as a mistake).', 'Pregunta omitida (cuenta como error).')} ${displaySuccess}`) : checked ? escapeHtml(correct ? success : I18n.field(question, 'retry')) : ''}
        </p>
        ${!locked ? `<button type="button" class="mt-btn mt-btn--primary" data-action="check-lab" data-question="${id}">${L('Verificar', 'Check', 'Verificar')}</button> ${skipControl(app, id)}` : ''}
        ${checked && !correct ? `<button type="button" class="mt-btn mt-btn--secondary" data-action="retry-lab" data-question="${id}">${L('Tentar novamente', 'Try again', 'Intentar de nuevo')}</button> ${skipControl(app, id)}` : ''}
      </div>
    `;
  }

  function renderGuide(app) {
    const container = section(app).querySelector('[data-role="lab-guide"]');
    if (!container) {
      return;
    }
    const magnets = app.state.tasks.magnets;
    const q1Done = stepDone(app, 'q1');
    const aligned = magnets.missions.aligned;
    const q2Done = stepDone(app, 'q2');
    const stepState = (done, active) => (done ? 'is-done' : active ? 'is-active' : 'is-waiting');

    container.innerHTML = `
      <section class="mt-card mt-guide" aria-labelledby="mt-guide-title">
        <div class="mt-card__head">
          <h2 id="mt-guide-title">${L('Roteiro do laboratório', 'Lab guide', 'Guion del laboratorio')}</h2>
          <span class="mt-chip ${magnets.done ? 'mt-chip--success' : ''}">${[q1Done, aligned, q2Done].filter(Boolean).length} / 3 ${L('etapas', 'steps', 'pasos')}</span>
        </div>
        <ol class="mt-mission-list">
          <li class="mt-mission ${stepState(q1Done, true)}">
            <span class="mt-mission__marker" aria-hidden="true">${q1Done ? '✓' : '1'}</span>
            <div class="mt-mission__body">
              <h3>${L('Observe a posição inicial', 'Look at the starting position', 'Observa la posición inicial')}</h3>
              ${questionHtml(app, 'q1')}
            </div>
          </li>
          <li class="mt-mission ${stepState(aligned, q1Done)}">
            <span class="mt-mission__marker" aria-hidden="true">${aligned ? '✓' : '2'}</span>
            <div class="mt-mission__body">
<h3>${L('Alinhe os ímãs', 'Align the magnets', 'Alinea los imanes')}</h3>
            <p>${aligned
                ? L('Muito bem! Todos os polos N apontaram para o mesmo lado. Continue explorando à vontade.', 'Well done! All the N poles point the same way. Keep exploring as much as you like.', '¡Muy bien! Todos los polos N apuntan hacia el mismo lado. Sigue explorando a tu gusto.')
                : L('Gire os ímãs até que todos os polos N (vermelhos) apontem para o mesmo lado. Qualquer direção vale, desde que seja a mesma.', 'Rotate the magnets until all the N poles (red) point the same way. Any direction works, as long as it is the same one.', 'Gira los imanes hasta que todos los polos N (rojos) apunten hacia el mismo lado. Vale cualquier dirección, siempre que sea la misma.')}</p>
            </div>
          </li>
          <li class="mt-mission ${stepState(q2Done, aligned)}">
            <span class="mt-mission__marker" aria-hidden="true">${q2Done ? '✓' : '3'}</span>
            <div class="mt-mission__body">
              <h3>${L('Explique o que mudou', 'Explain what changed', 'Explica qué cambió')}</h3>
              ${aligned ? questionHtml(app, 'q2') : `<p class="mt-muted">${L('Esta etapa abre depois que os ímãs estiverem alinhados.', 'This step opens once the magnets are aligned.', 'Este paso se abre cuando los imanes están alineados.')}</p>`}
            </div>
          </li>
        </ol>
        <div class="mt-challenge ${magnets.missions.nulled ? 'is-done' : ''}">
          <span class="mt-challenge__icon" aria-hidden="true">${magnets.missions.nulled ? '🏆' : '★'}</span>
          <div>
            <h3>${L('Desafio extra (opcional): zere o campo no centro', 'Bonus challenge (optional): cancel the field at the center', 'Desafío extra (opcional): anula el campo en el centro')}</h3>
            <p>${magnets.missions.nulled
              ? L('Você encontrou uma configuração em que as contribuições dos ímãs se cancelam no centro. É o princípio da superposição: campos são vetores e podem se anular, mesmo com ímãs fortes por perto.', 'You found a setup in which the contributions of the magnets cancel out at the center. This is the superposition principle: fields are vectors and can cancel each other, even with strong magnets nearby.', 'Has encontrado una configuración en la que las contribuciones de los imanes se cancelan en el centro. Es el principio de superposición: los campos son vectores y pueden anularse, incluso con imanes fuertes cerca.')
              : L('Consegue fazer a seta amarela sumir? Dica: experimente fazer todos os polos N apontarem para fora, na direção do círculo.', 'Can you make the yellow arrow disappear? Hint: try making all the N poles point outward, away from the center.', '¿Puedes hacer desaparecer la flecha amarilla? Pista: prueba a orientar todos los polos N hacia fuera, alejándose del centro.')}</p>
          </div>
        </div>
        ${magnets.done ? `<p class="mt-feedback is-success" role="status">${L('✓ Laboratório concluído! A próxima página foi liberada.', '✓ Lab complete! The next page is unlocked.', '✓ ¡Laboratorio completado! La página siguiente está desbloqueada.')}</p>` : ''}
      </section>
    `;
  }

  /* --------------------------- live scene --------------------------- */

  function updateScene(app) {
    const target = section(app);
    if (!target || target.hidden) {
      return;
    }
    const svg = target.querySelector('.mt-lab__svg');
    if (!svg) {
      return;
    }
    const magnets = app.state.tasks.magnets;
    const angles = magnets.angles;
    // Positions of the magnets currently on the stage, shared by the rotation
    // labels, the compass field and the audio description.
    const placed = Physics.positions(magnets.count);

    angles.forEach((angle, index) => {
      const group = svg.querySelector(`[data-magnet="${index}"]`);
      if (!group) {
        return;
      }
      const body = group.querySelector('[data-role="magnet-body"]');
      body.setAttribute('transform', `rotate(${angle.toFixed(1)})`);
      const halfL = LAB.magnetLength / 2;
      group.querySelector('[data-role="label-n"]').setAttribute('transform', `rotate(${(-angle).toFixed(1)} 0 ${-halfL / 2})`);
      group.querySelector('[data-role="label-s"]').setAttribute('transform', `rotate(${(-angle).toFixed(1)} 0 ${halfL / 2})`);
      const rounded = Math.round(normalizeAngle(angle));
      // aria-valuetext: the only thing a screen reader says for the rotation, so
      // it has to be a full sentence in every language. angleToDirection()
      // already speaks the running language; only the frame around it needs
      // translating.
      const direction = Physics.angleToDirection(angle);
      const text = L(
        `polo N apontando ${direction} (${rounded}°)`,
        `N pole pointing ${direction} (${rounded}°)`,
        `polo N orientado ${direction} (${rounded}°)`
      );
      group.setAttribute('aria-valuenow', String(rounded));
      group.setAttribute('aria-valuetext', text);
      const label = target.querySelector(`[data-role="angle-label-${index}"]`);
      if (label) {
        label.textContent = `${rounded}°`;
        label.title = text;
      }
    });

    const linesLayer = svg.querySelector('[data-layer="lines"]');
    if (magnets.showLines) {
      let paths = '';
      let arrows = '';
      Physics.traceFieldLines(angles).forEach((points) => {
        if (points.length < 4) {
          return;
        }
        let d = `M${points[0][0].toFixed(1)} ${points[0][1].toFixed(1)}`;
        for (let i = 2; i < points.length; i += 2) {
          d += `L${points[i][0].toFixed(1)} ${points[i][1].toFixed(1)}`;
        }
        paths += `<path d="${d}"/>`;
        if (points.length > 24) {
          const mid = Math.floor(points.length * 0.42);
          const [x1, y1] = points[mid];
          const [x2, y2] = points[mid + 2];
          const rotation = Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI;
          arrows += `<path class="mt-lab__arrow" d="M5 0L-4 -4.5L-4 4.5Z" transform="translate(${x1.toFixed(1)} ${y1.toFixed(1)}) rotate(${rotation.toFixed(0)})"/>`;
        }
      });
      linesLayer.innerHTML = paths + arrows;
    } else {
      linesLayer.innerHTML = '';
    }

    const compassLayer = svg.querySelector('[data-layer="compass"]');
    if (magnets.showCompass) {
      const poles = Physics.magnetPoles(angles);
      let needles = '';
      for (let y = 40; y < LAB.height; y += 52) {
        for (let x = 40; x < LAB.width; x += 52) {
          if (placed.some((p) => Math.hypot(p.x - x, p.y - y) < 76)) {
            continue;
          }
          const field = Physics.fieldAt(poles, x, y);
          const rotation = Math.atan2(field.y, field.x) * 180 / Math.PI;
          needles += `<g class="mt-needle" transform="translate(${x} ${y}) rotate(${rotation.toFixed(0)})"><circle r="13"/><path class="mt-needle__n" d="M11 0L0 -3.2L0 3.2Z"/><path class="mt-needle__s" d="M-11 0L0 -3.2L0 3.2Z"/></g>`;
        }
      }
      compassLayer.innerHTML = needles;
    } else {
      compassLayer.innerHTML = '';
    }

    const field = Physics.centerField(angles);
    const percent = Physics.centerFieldPercent(angles);
    const isNull = percent < Physics.NULL_PERCENT;
    const probeLayer = svg.querySelector('[data-layer="probe"]');
    const length = Math.min(90, 14 + percent * 0.55);
    const rotation = Math.atan2(field.y, field.x) * 180 / Math.PI;
    probeLayer.innerHTML = isNull
      ? `<g class="mt-probe" transform="translate(${LAB.center.x} ${LAB.center.y})"><circle r="16" class="mt-probe__zero"/><text y="5" class="mt-probe__text">0</text></g>`
      : `<g class="mt-probe" transform="translate(${LAB.center.x} ${LAB.center.y})"><circle r="6"/><g transform="rotate(${rotation.toFixed(1)})"><path class="mt-probe__arrow" d="M0 0H${(length - 12).toFixed(1)}"/><path class="mt-probe__head" d="M${length.toFixed(1)} 0L${(length - 16).toFixed(1)} -9L${(length - 16).toFixed(1)} 9Z"/></g></g>`;

    const alignment = Physics.alignmentPercent(angles);
    target.querySelector('[data-role="align-value"]').textContent = `${alignment}%`;
    target.querySelector('[data-role="align-bar"]').style.width = `${alignment}%`;
    // Qualitative scale: students compare configurations, they do not
    // need the arbitrary units of the model.
    const strength = isNull ? L('Nulo', 'Zero', 'Nulo') : percent < 60 ? L('Fraco', 'Weak', 'Débil') : percent < 180 ? L('Médio', 'Medium', 'Medio') : L('Forte', 'Strong', 'Fuerte');
    target.querySelector('[data-role="center-value"]').textContent = strength;
    target.querySelector('[data-role="center-bar"]').style.width = `${Math.min(100, (percent / 300) * 100)}%`;
    target.querySelector('[data-role="center-text"]').textContent = isNull
      ? L('As contribuições dos ímãs se cancelam no centro.', 'The contributions of the magnets cancel out at the center.', 'Las contribuciones de los imanes se cancelan en el centro.')
      : L(`A seta amarela mostra o campo resultante no centro: aponta ${Physics.angleToDirection(rotation + 90)}.`, `The yellow arrow shows the net field at the center: it points ${Physics.angleToDirection(rotation + 90)}.`, `La flecha amarilla muestra el campo resultante en el centro: apunta ${Physics.angleToDirection(rotation + 90)}.`);

    svg.querySelector('[data-role="lab-desc"]').textContent = angles
      .map((angle, index) => `${magnetName(placed[index])}: ${L('polo N', 'N pole', 'polo N')} ${Physics.angleToDirection(angle)}.`)
      .join(' ') + L(` Alinhamento ${alignment}%. Campo no centro: ${strength}.`, ` Alignment ${alignment}%. Field at the center: ${strength}.`, ` Alineación ${alignment}%. Campo en el centro: ${strength}.`);
  }

  function scheduleScene(app) {
    if (app.ui.sceneFrame) {
      return;
    }
    app.ui.sceneFrame = app.frame(() => {
      app.ui.sceneFrame = null;
      updateScene(app);
    });
  }

  /* ----------------------------- rotation ----------------------------- */

  function afterMagnetChange(app, index) {
    const magnets = app.state.tasks.magnets;
    const angles = magnets.angles;
    let message = `${magnetName(Physics.positions(magnets.count)[index])}: ${L('polo N', 'N pole', 'polo N')} ${Physics.angleToDirection(angles[index])}.`;
    let guideChanged = false;
    if (!magnets.missions.aligned && Physics.isAligned(angles)) {
      magnets.missions.aligned = true;
      guideChanged = true;
      message += L(' Missão cumprida: os ímãs estão alinhados!', ' Mission accomplished: the magnets are aligned!', ' Misión cumplida: los imanes están alineados!');
    }
    if (!magnets.missions.nulled && Physics.centerFieldPercent(angles) < Physics.NULL_PERCENT) {
      magnets.missions.nulled = true;
      guideChanged = true;
      message += L(' Desafio extra cumprido: o campo no centro ficou nulo!', ' Bonus challenge complete: the field at the center is zero!', ' Desafío extra superado: ¡el campo en el centro quedó nulo!');
    }
    updateCompletion(app);
    app.saveState();
    updateScene(app);
    if (guideChanged) {
      renderGuide(app);
      app.updateShell();
      app.resize();
    }
    app.announce(message);
  }

  function rotateMagnet(app, index, delta) {
    if (!Number.isInteger(index) || index < 0 || index >= app.state.tasks.magnets.count || !Number.isFinite(delta)) {
      return;
    }
    const angles = app.state.tasks.magnets.angles;
    angles[index] = normalizeAngle(Math.round((angles[index] + delta) / LAB.step) * LAB.step);
    afterMagnetChange(app, index);
  }

  function svgPoint(svg, event) {
    const matrix = svg.getScreenCTM();
    if (!matrix) {
      return null;
    }
    const point = svg.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    return point.matrixTransform(matrix.inverse());
  }

  function pointerUp(app, event) {
    const drag = app.ui.drag;
    if (!drag || event.pointerId !== drag.pointerId) {
      return;
    }
    drag.element.classList.remove('is-dragging');
    app.ui.drag = null;
    const angles = app.state.tasks.magnets.angles;
    // Snap to 15° so that exact alignments are reachable on touch screens.
    angles[drag.index] = normalizeAngle(Math.round(angles[drag.index] / LAB.step) * LAB.step);
    afterMagnetChange(app, drag.index);
  }

  /* ---------------------------- magnet count ---------------------------- */

  // The magnets are numbered by position, so removing one drops the last
  // index and every angle the student set is kept. Both buttons therefore
  // land on a full re-render: the SVG is built in markup, not patched.
  function focusCountControl(app) {
    return `[data-action="${app.state.tasks.magnets.count <= MAGNET_MIN ? 'add-magnet' : 'remove-magnet'}"]`;
  }

  /* Adds one magnet.
   *
   * The new magnet copies the angle of its neighbour instead of taking the
   * default one: defaultAngles() lies the LAST magnet on its side, which is
   * the situation the first lab question asks about — using it here would put
   * every added magnet lying down and immediately undo an alignment the
   * student had already achieved. Copying keeps "add a magnet" from ever
   * being a punishment; only a deliberate rotation can break the alignment. */
  function addMagnet(app) {
    const magnets = app.state.tasks.magnets;
    if (magnets.count >= MAGNET_MAX) {
      return;
    }
    const previous = magnets.angles.length;
    const added = previous + 1;
    magnets.count = added;
    magnets.angles = defaultAngles(added).map((fallback, index) => {
      if (index < previous) {
        return magnets.angles[index];
      }
      // Same direction as the magnet before it, so the set stays aligned if it
      // was. defaultAngles() is still the fallback when there is no previous.
      return previous ? magnets.angles[previous - 1] : fallback;
    });
    // Guard rather than assume: if the copy did change anything, the mission
    // marker has to go back to pending.
    if (!Physics.isAligned(magnets.angles)) {
      magnets.missions.aligned = false;
    }
    app.saveState();
    app.render({ focusSelector: focusCountControl(app) });
    app.resize();
    app.announce(L(
      `Ímã acrescentado. Agora são ${added} ímãs.`,
      `Magnet added. There are now ${added} magnets.`,
      `Imán añadido. Ahora hay ${added} imanes.`
    ));
  }

  // Removes the last magnet. The remaining ones keep their angles, so a
  // student who added magnets by mistake gets their work back.
  function removeMagnet(app) {
    const magnets = app.state.tasks.magnets;
    if (magnets.count <= MAGNET_MIN) {
      return;
    }
    const removed = magnets.count - 1;
    magnets.count = removed;
    magnets.angles = magnets.angles.slice(0, removed);
    // Alignment is a property of the whole set, so dropping a magnet can
    // break it: the mission marker must go back to pending.
    if (!Physics.isAligned(magnets.angles)) {
      magnets.missions.aligned = false;
    }
    app.saveState();
    app.render({ focusSelector: focusCountControl(app) });
    app.resize();
    app.announce(L(
      `Ímã retirado. Agora são ${removed} ímãs.`,
      `Magnet removed. There are now ${removed} magnets.`,
      `Imán retirado. Ahora hay ${removed} imanes.`
    ));
  }

  /* ----------------------------- questions ----------------------------- */

  function checkAnswer(app, id) {
    if (!QUESTIONS[id]) {
      return;
    }
    const target = section(app);
    const selected = target.querySelector(`input[name="lab-${id}"]:checked`);
    if (!selected) {
      app.announce(L('Escolha uma alternativa antes de verificar.', 'Choose an option before checking.', 'Elige una alternativa antes de verificar.'));
      const first = target.querySelector(`input[name="lab-${id}"]`);
      if (first) {
        first.focus();
      }
      return;
    }
    const magnets = app.state.tasks.magnets;
    magnets.answers[id] = selected.value;
    magnets.checked[id] = true;
    const correct = questionCorrect(app, id);
    if (!correct) {
      magnets.tries[id] = wrongTries(app, id) + 1;
      app.recordConceptError('campo', 1);
    }
    updateCompletion(app);
    app.saveState();
    renderGuide(app);
    app.updateShell();
    app.resize();
    app.frame(() => {
      const feedback = target.querySelector(`#lab-feedback-${id}`);
      if (feedback) {
        feedback.focus();
      }
    });
    app.announce(correct ? L('Resposta correta.', 'Correct answer.', 'Respuesta correcta.') : L('Ainda não. Leia a dica e tente novamente.', 'Not yet. Read the hint and try again.', 'Todavía no. Lee la pista e inténtalo de nuevo.'));
  }

  function retryAnswer(app, id) {
    const magnets = app.state.tasks.magnets;
    delete magnets.checked[id];
    delete magnets.answers[id];
    app.saveState();
    renderGuide(app);
    app.resize();
    const first = section(app).querySelector(`input[name="lab-${id}"]`);
    if (first) {
      first.focus();
    }
  }

  // Skipping locks the question with the right answer revealed: the step
  // counts as done (it was attempted), but the error counts for review.
  function skipAnswer(app, id) {
    if (!QUESTIONS[id] || stepDone(app, id) || wrongTries(app, id) < SKIP_AFTER_TRIES) {
      return;
    }
    const magnets = app.state.tasks.magnets;
    magnets.answers[id] = '';
    magnets.checked[id] = true;
    magnets.skipped[id] = true;
    app.recordConceptError('campo', 1);
    updateCompletion(app);
    app.saveState();
    renderGuide(app);
    app.updateShell();
    app.resize();
    app.frame(() => {
      const feedback = section(app).querySelector(`#lab-feedback-${CSS.escape(id)}`);
      if (feedback) {
        feedback.focus();
      }
    });
    app.announce(L('Questão pulada. Conta como erro.', 'Question skipped. It counts as a mistake.', 'Pregunta omitida. Cuenta como error.'));
  }

  const page = {
    id: 3,
    get short() { return L('Ímãs', 'Magnets', 'Imanes'); },
    get title() { return L('Laboratório de ímãs', 'Magnet lab', 'Laboratorio de imanes'); },
    get unlockHint() { return L('Conclua as três etapas do laboratório para avançar.', 'Finish the three steps of the lab to move on.', 'Completa los tres pasos del laboratorio para avanzar.'); },
    render,
    canLeave: (app) => Boolean(app.state.tasks.magnets.done),
    actions: {
      'rotate-magnet': (app, trigger) => rotateMagnet(app, Number(trigger.dataset.magnet), Number(trigger.dataset.delta)),
      'add-magnet': (app) => addMagnet(app),
      'remove-magnet': (app) => removeMagnet(app),
      'reset-magnets': (app) => {
        const magnets = app.state.tasks.magnets;
        magnets.angles = defaultAngles(magnets.count);
        magnets.missions.aligned = false;
        app.saveState();
        updateScene(app);
        // renderGuide(), not just updateScene(): the SVG must not be rebuilt
        // (it keeps pointer capture mid-drag) but the guide is safe to redraw,
        // and without this the "✓ Alinhe os ímãs" marker would stay lit after
        // the magnets went back to the staggered starting position.
        renderGuide(app);
        app.announce(L(
          'Ímãs de volta à posição inicial: todos com o polo N para cima, menos o último, deitado.',
          'Magnets back to the starting position: all with the N pole up, except the last one, lying on its side.',
          'Imanes de vuelta a la posición inicial: todos con el polo N hacia arriba, menos el último, tumbado.'
        ));
      },
      'check-lab': (app, trigger) => checkAnswer(app, trigger.dataset.question),
      'skip-lab': (app, trigger) => skipAnswer(app, trigger.dataset.question),
      'retry-lab': (app, trigger) => retryAnswer(app, trigger.dataset.question)
    },
    events: {
      change(app, event) {
        const toggle = event.target.closest('[data-role="lab-toggle"]');
        if (!toggle) {
          return;
        }
        const magnets = app.state.tasks.magnets;
        if (toggle.value === 'lines') {
          magnets.showLines = toggle.checked;
        } else {
          magnets.showCompass = toggle.checked;
        }
        app.saveState();
        updateScene(app);
      },
      keydown(app, event) {
        const magnet = event.target.closest && event.target.closest('[data-role="magnet"]');
        if (!magnet) {
          return;
        }
        const deltas = { ArrowRight: LAB.step, ArrowUp: LAB.step, ArrowLeft: -LAB.step, ArrowDown: -LAB.step, PageUp: 90, PageDown: -90 };
        if (Object.prototype.hasOwnProperty.call(deltas, event.key)) {
          event.preventDefault();
          rotateMagnet(app, Number(magnet.dataset.magnet), deltas[event.key]);
        }
      },
      pointerdown(app, event) {
        const magnet = event.target.closest && event.target.closest('[data-role="magnet"]');
        if (!magnet || (event.button !== undefined && event.button > 0)) {
          return;
        }
        const svg = magnet.ownerSVGElement;
        const point = svgPoint(svg, event);
        if (!point) {
          return;
        }
        const index = Number(magnet.dataset.magnet);
        const position = Physics.positions(app.state.tasks.magnets.count)[index];
        event.preventDefault();
        magnet.focus({ preventScroll: true });
        try {
          magnet.setPointerCapture(event.pointerId);
        } catch (error) {
          // Older browsers: the root-level listeners still receive the events.
        }
        magnet.classList.add('is-dragging');
        app.ui.drag = {
          index,
          element: magnet,
          svg,
          pointerId: event.pointerId,
          startAngle: app.state.tasks.magnets.angles[index],
          startPointer: Math.atan2(point.y - position.y, point.x - position.x) * 180 / Math.PI
        };
      },
      pointermove(app, event) {
        const drag = app.ui.drag;
        if (!drag || event.pointerId !== drag.pointerId) {
          return;
        }
        const point = svgPoint(drag.svg, event);
        if (!point) {
          return;
        }
        const position = Physics.positions(app.state.tasks.magnets.count)[drag.index];
        const pointer = Math.atan2(point.y - position.y, point.x - position.x) * 180 / Math.PI;
        app.state.tasks.magnets.angles[drag.index] = normalizeAngle(drag.startAngle + pointer - drag.startPointer);
        scheduleScene(app);
      },
      pointerup: pointerUp,
      pointercancel: pointerUp
    }
  };

  (ns.pages = ns.pages || []).push(page);
})(window.H5P = window.H5P || {});
