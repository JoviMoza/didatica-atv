(function (H5P) {
  'use strict';

  /* Page 1 — "O trem que flutua": opening text, video and how the mission
   * works. Reading page: being here is enough to unlock page 2. */

  const ns = H5P.MagnetismoTransporte;
  const { escapeHtml, plainMarkup } = ns.Util;
  const L = ns.I18n.L;

  function heroArt() {
    return `
      <svg viewBox="0 0 320 200">
        <defs>
          <linearGradient id="mt-hero-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#dbe7ff"/><stop offset="1" stop-color="#f4f8ff"/></linearGradient>
          <linearGradient id="mt-hero-train" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#2446d8"/><stop offset="1" stop-color="#4f7cff"/></linearGradient>
        </defs>
        <rect width="320" height="200" rx="22" fill="url(#mt-hero-sky)"/>
        <g class="mt-hero__float">
          <path d="M48 104h190c26 0 42 12 50 30H48z" fill="url(#mt-hero-train)"/>
          <path d="M70 112h26v14H70zm36 0h26v14h-26zm36 0h26v14h-26zm36 0h26v14h-26z" fill="#e6eeff"/>
          <path d="M232 112h20c10 0 18 6 22 14h-42z" fill="#bcd0ff"/>
        </g>
        <g stroke="#38bdf8" stroke-width="2.5" stroke-linecap="round" opacity=".8">
          <path d="M70 146v8M110 146v8M150 146v8M190 146v8M230 146v8M270 146v8" class="mt-hero__gap"/>
        </g>
        <rect x="30" y="160" width="270" height="14" rx="4" fill="#1e293b"/>
        <g>
          <rect x="40" y="163" width="30" height="8" rx="2" fill="#e2463c"/><rect x="70" y="163" width="30" height="8" rx="2" fill="#3c5a9a"/>
          <rect x="100" y="163" width="30" height="8" rx="2" fill="#e2463c"/><rect x="130" y="163" width="30" height="8" rx="2" fill="#3c5a9a"/>
          <rect x="160" y="163" width="30" height="8" rx="2" fill="#e2463c"/><rect x="190" y="163" width="30" height="8" rx="2" fill="#3c5a9a"/>
          <rect x="220" y="163" width="30" height="8" rx="2" fill="#e2463c"/><rect x="250" y="163" width="40" height="8" rx="2" fill="#3c5a9a"/>
        </g>
      </svg>
    `;
  }

  function render(app, section) {
    const media = app.media();
    section.innerHTML = `
      <div class="mt-hero">
        <div class="mt-hero__copy">
          <span class="mt-hero__eyebrow">${escapeHtml(app.title())}</span>
          <h1 id="h5p-mt-heading-1" tabindex="-1">${escapeHtml(page.title)}</h1>
          <div class="mt-prose">${plainMarkup(app.text('introText'))}</div>
        </div>
        <div class="mt-hero__art" aria-hidden="true">${heroArt()}</div>
      </div>
      ${app.video('intro', media.introVideoUrl, media.introVideoTitle, 0, L('O player só solicita dados ao YouTube depois que você escolhe carregá-lo.', 'The player only requests data from YouTube after you choose to load it.'))}
      <div class="mt-grid mt-grid--2">
        <section class="mt-card" aria-labelledby="mt-goals">
          <h2 id="mt-goals">${L('Ao final, você será capaz de…', 'By the end, you will be able to…')}</h2>
          <ul class="mt-checklist">
            ${L(`
            <li>explicar por que ímãs se atraem e se repelem;</li>
            <li>ler e interpretar linhas de campo magnético;</li>
            <li>relacionar corrente elétrica e magnetismo no eletroímã;</li>
            <li>comparar como diferentes trens Maglev flutuam e andam;</li>
            <li>reconhecer o MagLev-Cobra como desenvolvimento brasileiro.</li>`, `
            <li>explain why magnets attract and repel each other;</li>
            <li>read and interpret magnetic field lines;</li>
            <li>relate electric current and magnetism in the electromagnet;</li>
            <li>compare how different Maglev trains float and move;</li>
            <li>recognize the MagLev-Cobra as a Brazilian development.</li>`)}
          </ul>
        </section>
        <section class="mt-card mt-card--tint" aria-labelledby="mt-howto">
          <h2 id="mt-howto">${L('Como funciona a missão', 'How the mission works')}</h2>
          <ol class="mt-howto">
            ${L(`
            <li><strong>Siga em ordem.</strong> Use o botão <em>Próxima</em>, no fim de cada página.</li>
            <li><strong>Páginas com atividade</strong> liberam a próxima quando você as concluir. <span aria-hidden="true">🔒</span></li>
            <li><strong>Pode voltar</strong> para revisar qualquer página já liberada.</li>
            <li>No fim, a aba <strong>Revisão estendida</strong> reúne explicações e simulações para estudar.</li>`, `
            <li><strong>Go in order.</strong> Use the <em>Next</em> button at the end of each page.</li>
            <li><strong>Pages with an activity</strong> unlock the next one when you finish them. <span aria-hidden="true">🔒</span></li>
            <li><strong>You can go back</strong> to review any page you have already unlocked.</li>
            <li>At the end, the <strong>Extended review</strong> tab gathers explanations and simulations to study.</li>`)}
          </ol>
        </section>
      </div>
      <aside class="mt-callout">
        ${L('<strong>Repare:</strong> o trem não usa nenhum sistema eletrônico visível para se manter no ar. A explicação aparece quando distinguimos repulsão, exclusão de campo e aprisionamento de fluxo.', '<strong>Notice:</strong> the train uses no visible electronic system to stay in the air. The explanation appears when we tell apart repulsion, field expulsion and flux pinning.')}
      </aside>
    `;
  }

  const page = {
    id: 1,
    get short() { return L('Início', 'Start'); },
    get title() { return L('O trem que flutua', 'The floating train'); },
    unlockHint: '',
    render
  };

  (ns.pages = ns.pages || []).push(page);
})(window.H5P = window.H5P || {});
