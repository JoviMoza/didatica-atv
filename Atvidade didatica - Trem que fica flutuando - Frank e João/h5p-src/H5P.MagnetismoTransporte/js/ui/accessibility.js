(function (H5P) {
  'use strict';

  /* Accessibility services beyond the HTML itself:
   * - Libras through VLibras, the Brazilian government's widget
   *   (https://www.gov.br/governodigital/pt-br/vlibras). It is the only
   *   script loaded from outside the package, and only after the student
   *   clicks "Libras". Its own floating button is hidden (css/components/
   *   accessibility.css): inside the H5P iframe it would sit in the middle
   *   of a very tall page. Our button lives in the header instead.
   * - Text audio description of each video, with "Ouvir" (speech
   *   synthesis of the browser, in the interface language, nothing sent
   *   anywhere). */

  const ns = H5P.MagnetismoTransporte;
  const { escapeHtml } = ns.Util;
  const { I18n } = ns;
  const L = I18n.L;

  const VLIBRAS_ROOT = 'https://vlibras.gov.br/app';
  const VLIBRAS_SCRIPT_ID = 'h5p-mt-vlibras';

  /* ------------------------------- Libras ------------------------------- */

  function waitFor(check, timeout) {
    return new Promise((resolve, reject) => {
      const started = Date.now();
      (function poll() {
        if (check()) {
          resolve();
        } else if (Date.now() - started > timeout) {
          reject(new Error('timeout'));
        } else {
          window.setTimeout(poll, 50);
        }
      })();
    });
  }

  function vlibrasReady() {
    return Boolean(window.VLibrasWidget && typeof window.VLibrasWidget.open === 'function');
  }

  // The VLibras window (#vlibras-app, inside the open shadow root of
  // #vlibras-app-root) is fixed at the vertical middle of the viewport. In
  // H5P the iframe is as tall as the whole page, so that middle can be far
  // from what the student is reading. We move the window next to the text
  // the student clicks (and next to the Libras button when it opens).
  // Plain `top`, without !important: if the student drags the window, the
  // inline position set by VLibras wins and we stop moving it.
  const VLIBRAS_HEIGHT = 440;
  let followInstalled = false;

  function placeVlibras(y) {
    const host = document.getElementById('vlibras-app-root');
    const shadow = host && host.shadowRoot;
    if (!shadow) {
      return false;
    }
    let style = shadow.querySelector('#h5p-mt-vlibras-place');
    if (!style) {
      style = document.createElement('style');
      style.id = 'h5p-mt-vlibras-place';
      shadow.appendChild(style);
    }
    const maxTop = Math.max(8, window.innerHeight - VLIBRAS_HEIGHT - 8);
    const top = Math.round(Math.min(maxTop, Math.max(8, y - 40)));
    style.textContent = `#vlibras-app { top: ${top}px; bottom: auto; translate: none; }`;
    return true;
  }

  function placeVlibrasWhenReady(y) {
    waitFor(() => placeVlibras(y), 15000).catch(() => {});
  }

  function followClicks() {
    if (followInstalled) {
      return;
    }
    followInstalled = true;
    document.addEventListener('click', (event) => {
      const target = event.target;
      if (!target || !target.closest || target.closest('#vlibras-app-root, #vlibras-access-wrapper')) {
        return;
      }
      placeVlibras(target.getBoundingClientRect().top);
    }, true);
  }

  // Loads the VLibras loader once, then opens the avatar. Rejects when the
  // service cannot be reached (offline, blocked by the school network…).
  // `anchorY`: viewport position where the window should appear.
  function openLibras(anchorY) {
    followClicks();
    placeVlibrasWhenReady(Number(anchorY) || 0);
    if (vlibrasReady()) {
      window.VLibrasWidget.open();
      return Promise.resolve();
    }
    let script = document.getElementById(VLIBRAS_SCRIPT_ID);
    if (!script) {
      window.VLibrasWidget = Object.assign({ path: VLIBRAS_ROOT, position: 'r' }, window.VLibrasWidget);
      script = document.createElement('script');
      script.id = VLIBRAS_SCRIPT_ID;
      script.src = `${VLIBRAS_ROOT}/vlibras-plugin.js`;
      script.async = true;
      script.addEventListener('error', () => {
        script.dataset.failed = 'true';
      });
      document.head.appendChild(script);
    }
    return waitFor(() => vlibrasReady() || script.dataset.failed === 'true', 8000)
      .then(() => {
        if (!vlibrasReady()) {
          throw new Error('VLibras indisponível');
        }
        window.VLibrasWidget.open();
      });
  }

  function librasButton() {
    return `
      <button type="button" class="mt-a11y-btn" data-action="open-libras" aria-describedby="h5p-mt-libras-hint">
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M8.5 11V5.5a1.5 1.5 0 0 1 3 0V10m0-.5V4a1.5 1.5 0 0 1 3 0v6m0-4.5a1.5 1.5 0 0 1 3 0V13m-9-2-1.6-1.6a1.6 1.6 0 0 0-2.3 2.3L8 15c1.6 2.9 3.4 5 6.7 5 3 0 5.3-2.4 5.3-5.5V9a1.5 1.5 0 0 0-3 0" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>
        <span>Libras</span>
      </button>
      <span class="mt-sr-only" id="h5p-mt-libras-hint">Abre o VLibras, tradutor do Governo Federal. Depois, clique em um texto para vê-lo em Libras.</span>
    `;
  }

  /* -------------------------- audio description -------------------------- */

  const TIME_LINE = /^(\d{1,2}:\d{2})\s*[—–-]\s*(.+)$/;

  // Editor text: blank lines split paragraphs; lines starting with "m:ss —"
  // become a timeline.
  function descriptionMarkup(text) {
    return String(text || '')
      .split(/\n\s*\n/g)
      .map((block) => block.trim())
      .filter(Boolean)
      .map((block) => {
        const lines = block.split('\n').map((line) => line.trim()).filter(Boolean);
        if (lines.every((line) => TIME_LINE.test(line))) {
          return `<ol class="mt-timeline">${lines.map((line) => {
            const [, time, content] = TIME_LINE.exec(line);
            return `<li><span class="mt-timeline__time">${escapeHtml(time)}</span><span>${escapeHtml(content)}</span></li>`;
          }).join('')}</ol>`;
        }
        return `<p>${lines.map(escapeHtml).join('<br>')}</p>`;
      })
      .join('');
  }

  // Text read aloud: times are read as "aos 2 minutos e 28 segundos"
  // ("at 2 minutes and 28 seconds" in English).
  function spokenTime(minutes, seconds) {
    if (I18n.isEnglish()) {
      const secondsText = `${seconds} second${seconds === 1 ? '' : 's'}`;
      const when = minutes ? `${minutes} minute${minutes === 1 ? '' : 's'}${seconds ? ` and ${secondsText}` : ''}` : secondsText;
      return `At ${when}`;
    }
    const when = minutes ? `${minutes} minuto${minutes === 1 ? '' : 's'}${seconds ? ` e ${seconds} segundos` : ''}` : `${seconds} segundos`;
    return `Aos ${when}`;
  }

  function spokenText(text) {
    return String(text || '')
      .split('\n')
      .map((line) => {
        const match = TIME_LINE.exec(line.trim());
        if (!match) {
          return line;
        }
        const [minutes, seconds] = match[1].split(':').map(Number);
        return `${spokenTime(minutes, seconds)}: ${match[2]}`;
      })
      .join('\n');
  }

  function canSpeak() {
    return typeof window.speechSynthesis !== 'undefined' && typeof window.SpeechSynthesisUtterance !== 'undefined';
  }

  function stopSpeech() {
    if (canSpeak()) {
      window.speechSynthesis.cancel();
    }
  }

  function speak(text, onEnd) {
    if (!canSpeak()) {
      return false;
    }
    stopSpeech();
    const utterance = new window.SpeechSynthesisUtterance(spokenText(text));
    utterance.lang = I18n.get();
    const voicePattern = I18n.isEnglish() ? /^en(-|_)US/i : /^pt(-|_)BR/i;
    const voice = window.speechSynthesis.getVoices().find((candidate) => voicePattern.test(candidate.lang));
    if (voice) {
      utterance.voice = voice;
    }
    utterance.rate = 0.95;
    utterance.onend = onEnd;
    utterance.onerror = onEnd;
    window.speechSynthesis.speak(utterance);
    return true;
  }

  // Button + panel under a video. `open` comes from app.ui, so the panel
  // stays open when the page re-renders (e.g. after loading the player).
  function descriptionPanel({ key, title, text, open }) {
    if (!String(text || '').trim()) {
      return '';
    }
    const id = `h5p-mt-desc-${escapeHtml(key)}`;
    return `
      <div class="mt-vdesc">
        <button type="button" class="mt-btn mt-btn--secondary mt-btn--sm mt-vdesc__toggle" data-action="toggle-description" data-video-key="${escapeHtml(key)}"
          aria-expanded="${open ? 'true' : 'false'}" aria-controls="${id}">
          <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M4 5h16v11H9l-5 4zM8 9h8M8 12h5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
          ${L('Audiodescrição e resumo do vídeo', 'Audio description and video summary')}
        </button>
        <section class="mt-vdesc__panel" id="${id}" aria-label="${L('Audiodescrição e resumo', 'Audio description and summary')}: ${escapeHtml(title)}" ${open ? '' : 'hidden'}>
          <div class="mt-vdesc__head">
            <p class="mt-small mt-muted">${L('O que acontece no vídeo, em texto. Serve para quem não pode ver ou ouvir o vídeo, ou prefere ler.', 'What happens in the video, in text. It is for anyone who cannot see or hear the video, or prefers to read.')}</p>
            ${canSpeak() ? `<button type="button" class="mt-btn mt-btn--ghost mt-btn--sm" data-action="speak-description" data-video-key="${escapeHtml(key)}" aria-pressed="false">${L('🔊 Ouvir', '🔊 Listen')}</button>` : ''}
          </div>
          <div class="mt-prose">${descriptionMarkup(text)}</div>
        </section>
      </div>
    `;
  }

  ns.Accessibility = {
    openLibras,
    librasButton,
    descriptionMarkup,
    descriptionPanel,
    canSpeak,
    speak,
    stopSpeech
  };
})(window.H5P = window.H5P || {});
