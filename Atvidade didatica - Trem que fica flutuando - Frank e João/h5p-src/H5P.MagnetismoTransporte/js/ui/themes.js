(function (H5P) {
  'use strict';

  /* "Aparência" button in the header: the student picks one of the visual
   * themes. "Padrão" is the original design (no data-mt-theme attribute);
   * the others come from designs/<n>-<id>/tema.css, converted by
   * scripts/gerar-temas.ps1 into css/themes/<id>.css and scoped by
   * data-mt-theme="<id>" on .h5p-mt and .h5p-mt-host. The choice is a
   * preference saved in state.theme, like the language. */

  const ns = H5P.MagnetismoTransporte;
  const { escapeHtml } = ns.Util;
  const L = ns.I18n.L;

  // swatches: background, card/main colour, accent.
  const THEMES = [
    { id: '', name: () => L('Padrão', 'Default', 'Predeterminado'), hint: () => L('Azul e branco, o visual original', 'Blue and white, the original look', 'Azul y blanco, el aspecto original'), swatches: ['#f5f7fb', '#1f3fd1', '#06b6d4'] },
    { id: 'noturno', name: () => L('Noturno', 'Night', 'Nocturno'), hint: () => L('Tela escura, boa para sala escura e projetor', 'Dark screen, good for dark rooms and projectors', 'Pantalla oscura, adecuada para salas oscuras y proyectores'), swatches: ['#070b18', '#7c9bff', '#22d3ee'] },
    { id: 'caderno', name: () => L('Caderno', 'Notebook', 'Cuaderno'), hint: () => L('Papel quadriculado e tinta azul', 'Grid paper and blue ink', 'Papel cuadriculado y tinta azul'), swatches: ['#f6f0e1', '#1d3f9e', '#d6453d'] },
    { id: 'sinalizacao', name: () => L('Sinalização', 'Signage', 'Señalización'), hint: () => L('Preto, branco e amarelo: maior contraste', 'Black, white and yellow: highest contrast', 'Negro, blanco y amarillo: el máximo contraste'), swatches: ['#ffffff', '#111111', '#ffcc00'] }
  ];

  function find(id) {
    return THEMES.find((theme) => theme.id === id) || THEMES[0];
  }

  function isSupported(id) {
    return THEMES.some((theme) => theme.id === id);
  }

  // Sets or clears data-mt-theme on every given element.
  function apply(id, elements) {
    const theme = find(id);
    elements.filter(Boolean).forEach((element) => {
      if (theme.id) {
        element.setAttribute('data-mt-theme', theme.id);
      } else {
        element.removeAttribute('data-mt-theme');
      }
    });
    return theme.id;
  }

  function swatches(theme) {
    return `<span class="mt-theme__swatches" aria-hidden="true">${theme.swatches.map((color) => `<span style="background:${escapeHtml(color)}"></span>`).join('')}</span>`;
  }

  function button(current) {
    return `
      <div class="mt-theme">
        <button type="button" class="mt-a11y-btn mt-theme__toggle" data-action="toggle-theme-menu"
          aria-expanded="false" aria-controls="h5p-mt-theme-menu">
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M12 3a9 9 0 0 0 0 18c1.1 0 1.8-.8 1.8-1.7 0-.5-.2-.9-.5-1.2-.3-.3-.5-.7-.5-1.2 0-.9.8-1.7 1.8-1.7H17a4 4 0 0 0 4-4C21 6.6 17 3 12 3z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><circle cx="7.5" cy="11" r="1.3" fill="currentColor"/><circle cx="10.5" cy="7" r="1.3" fill="currentColor"/><circle cx="15" cy="7.5" r="1.3" fill="currentColor"/></svg>
          <span>${L('Aparência', 'Appearance', 'Apariencia')}</span>
        </button>
        <div class="mt-theme__menu" id="h5p-mt-theme-menu" role="group" aria-label="${L('Aparência da atividade', 'Activity appearance', 'Apariencia de la actividad')}" hidden>
          ${THEMES.map((theme) => `
            <button type="button" class="mt-theme__option" data-action="set-theme" data-theme="${escapeHtml(theme.id)}"
              aria-pressed="${theme.id === find(current).id ? 'true' : 'false'}">
              ${swatches(theme)}
              <span class="mt-theme__text">
                <strong>${escapeHtml(theme.name())}</strong>
                <span>${escapeHtml(theme.hint())}</span>
              </span>
            </button>
          `).join('')}
        </div>
      </div>
    `;
  }

  ns.Themes = {
    THEMES,
    find,
    isSupported,
    apply,
    button
  };
})(window.H5P = window.H5P || {});
