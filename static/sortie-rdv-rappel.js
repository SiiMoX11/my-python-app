// Rappel de remise des rendez-vous au patient (extension de l'onglet Sortie).
(() => {
  'use strict';
  const message = 'Important : délivrer au patient tous les rendez-vous prévus (consultation avec nous, autres services, bilan et imagerie) et lui rappeler leurs dates et les consignes associées.';
  function update() {
    const root = document.querySelector('#sortie-form [data-list="sortie_rdv"]');
    if (!root) return;
    const list = root.querySelector('[data-rows]');
    if (!list) return;
    const hasAppointments = !!list.querySelector('[data-row]');
    let note = root.querySelector('[data-rdv-reminder]');
    if (!hasAppointments) {
      if (note) note.remove();
      return;
    }
    if (!note) {
      note = document.createElement('p');
      note.dataset.rdvReminder = '1';
      note.setAttribute('role', 'note');
      note.style.cssText = 'color:#b91c1c;background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:12px;margin:12px 0 0;font-weight:600;line-height:1.5;';
      note.textContent = message;
      root.appendChild(note);
    }
  }
  let pending = false;
  const observer = new MutationObserver(() => {
    if (pending) return;
    pending = true;
    queueMicrotask(() => { pending = false; update(); });
  });
  observer.observe(document.body, {childList:true, subtree:true});
  update();
})();
