'use strict';
// Oberfläche: Reiter im Einstellungsbereich und Lichtreflex auf dem Glas.
(() => {
  const tabs = [...document.querySelectorAll('.inspector .segmented [data-pane]')];
  const panes = [...document.querySelectorAll('.inspector .pane')];
  function showPane(name) {
    tabs.forEach(t => { const on = t.dataset.pane === name; t.classList.toggle('active', on); t.setAttribute('aria-selected', on); });
    panes.forEach(p => { p.hidden = p.dataset.pane !== name; });
  }
  tabs.forEach(t => t.addEventListener('click', () => showPane(t.dataset.pane)));
  window.showInspectorPane = showPane;

  // Der helle Reflex folgt Maus, Finger oder Stift. Ein Frame pro Bewegung, nur auf Glasflächen.
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  let pending = null, frame = 0;
  document.addEventListener('pointermove', e => {
    pending = e; if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      const glass = pending.target instanceof Element ? pending.target.closest('.glass, dialog') : null;
      if (!glass) return;
      const r = glass.getBoundingClientRect();
      glass.style.setProperty('--mx', `${((pending.clientX - r.left) / r.width * 100).toFixed(1)}%`);
      glass.style.setProperty('--my', `${((pending.clientY - r.top) / r.height * 100).toFixed(1)}%`);
    });
  }, { passive: true });
})();
