(function (H5P) {
  'use strict';

  /* ------------------------------------------------------------------ *
   * Magnet lab: four bar magnets, one in each corner of the stage.
   * Angles are in degrees, clockwise, 0° = north pole pointing up.
   * Each magnet is modelled as a pair of magnetic "charges" (N = +1,
   * S = −1) with 1/r² falloff, which is enough to draw textbook field
   * lines and to evaluate the superposition at the centre of the stage.
   * Pure functions only: the page module (pages/03-magnet-lab.js) draws.
   * ------------------------------------------------------------------ */

  const normalizeAngle = H5P.MagnetismoTransporte.Storage.normalizeAngle;
  const I18n = H5P.MagnetismoTransporte.I18n;
  const L = I18n.L;

  const LAB = {
    width: 800,
    height: 520,
    center: { x: 400, y: 260 },
    poleOffset: 40,
    magnetLength: 116,
    magnetWidth: 44,
    step: 15,
    // `name` follows the interface language ("Ímã superior esquerdo" /
    // "top left magnet").
    positions: [
      { x: 140, y: 118, get name() { return L('superior esquerdo', 'top left'); } },
      { x: 660, y: 118, get name() { return L('superior direito', 'top right'); } },
      { x: 140, y: 402, get name() { return L('inferior esquerdo', 'bottom left'); } },
      { x: 660, y: 402, get name() { return L('inferior direito', 'bottom right'); } }
    ]
  };

  // Below this share of the reference field, the centre counts as "Nulo".
  const NULL_PERCENT = 8;

  const DIRECTION_NAMES = {
    'pt-BR': ['para cima', 'para cima e à direita', 'para a direita', 'para baixo e à direita', 'para baixo', 'para baixo e à esquerda', 'para a esquerda', 'para cima e à esquerda'],
    'en-US': ['up', 'up and to the right', 'to the right', 'down and to the right', 'down', 'down and to the left', 'to the left', 'up and to the left']
  };

  function angleToDirection(angle) {
    const names = DIRECTION_NAMES[I18n.get()] || DIRECTION_NAMES['pt-BR'];
    return names[Math.round(normalizeAngle(angle) / 45) % 8];
  }

  function magnetPoles(angles) {
    const poles = [];
    angles.forEach((degrees, index) => {
      const position = LAB.positions[index];
      const radians = degrees * Math.PI / 180;
      const dx = Math.sin(radians);
      const dy = -Math.cos(radians);
      poles.push({ x: position.x + dx * LAB.poleOffset, y: position.y + dy * LAB.poleOffset, q: 1 });
      poles.push({ x: position.x - dx * LAB.poleOffset, y: position.y - dy * LAB.poleOffset, q: -1 });
    });
    return poles;
  }

  function fieldAt(poles, x, y) {
    let bx = 0;
    let by = 0;
    for (let i = 0; i < poles.length; i += 1) {
      const dx = x - poles[i].x;
      const dy = y - poles[i].y;
      const d2 = dx * dx + dy * dy + 36;
      const factor = poles[i].q / (d2 * Math.sqrt(d2));
      bx += dx * factor;
      by += dy * factor;
    }
    return { x: bx, y: by };
  }

  // Integrates field lines (RK2) from a fan of seeds around each north pole
  // until they reach a south pole, leave the stage or hit a null point.
  function traceFieldLines(angles) {
    const poles = magnetPoles(angles);
    const southPoles = poles.filter((pole) => pole.q < 0);
    const lines = [];
    const seeds = 9;
    const step = 5;
    const margin = 24;
    angles.forEach((degrees, index) => {
      const north = poles[index * 2];
      const heading = (degrees - 90) * Math.PI / 180;
      for (let k = 0; k < seeds; k += 1) {
        const spread = -1.45 + (2.9 * k) / (seeds - 1);
        let x = north.x + Math.cos(heading + spread) * 10;
        let y = north.y + Math.sin(heading + spread) * 10;
        const points = [[x, y]];
        for (let s = 0; s < 480; s += 1) {
          const b1 = fieldAt(poles, x, y);
          const m1 = Math.hypot(b1.x, b1.y);
          if (m1 < 1e-11) {
            break;
          }
          const mx = x + (b1.x / m1) * step * 0.5;
          const my = y + (b1.y / m1) * step * 0.5;
          const b2 = fieldAt(poles, mx, my);
          const m2 = Math.hypot(b2.x, b2.y);
          if (m2 < 1e-11) {
            break;
          }
          x += (b2.x / m2) * step;
          y += (b2.y / m2) * step;
          points.push([x, y]);
          if (x < -margin || y < -margin || x > LAB.width + margin || y > LAB.height + margin) {
            break;
          }
          if (southPoles.some((pole) => (x - pole.x) * (x - pole.x) + (y - pole.y) * (y - pole.y) < 81)) {
            break;
          }
        }
        lines.push(points);
      }
    });
    return lines;
  }

  function centerField(angles) {
    return fieldAt(magnetPoles(angles), LAB.center.x, LAB.center.y);
  }

  const REFERENCE_FIELD = (function () {
    const field = centerField([0, 0, 0, 0]);
    return Math.hypot(field.x, field.y) || 1;
  })();

  function angularDistance(a, b) {
    const diff = Math.abs(normalizeAngle(a) - normalizeAngle(b));
    return Math.min(diff, 360 - diff);
  }

  function isAligned(angles) {
    return angles.every((angle) => angularDistance(angle, angles[0]) <= 8);
  }

  function alignmentPercent(angles) {
    let x = 0;
    let y = 0;
    angles.forEach((angle) => {
      x += Math.sin(angle * Math.PI / 180);
      y += Math.cos(angle * Math.PI / 180);
    });
    return Math.round((Math.hypot(x, y) / angles.length) * 100);
  }

  function centerFieldPercent(angles) {
    const field = centerField(angles);
    return Math.round((Math.hypot(field.x, field.y) / REFERENCE_FIELD) * 100);
  }

  H5P.MagnetismoTransporte.Physics = {
    LAB,
    NULL_PERCENT,
    angleToDirection,
    magnetPoles,
    fieldAt,
    traceFieldLines,
    centerField,
    isAligned,
    alignmentPercent,
    centerFieldPercent
  };
})(window.H5P = window.H5P || {});
