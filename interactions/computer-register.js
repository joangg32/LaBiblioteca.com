// ============================================================================
// ORDENADOR 1 — LISTA DE REGISTRO / LIBRO DE VISITAS
// ============================================================================
// Al pulsar se abre un formulario (tipografía de 8 px, estética pixel) que el
// usuario rellena con su nombre y un comentario. Al enviar, el comentario se
// guarda y se muestra la LISTA de toda la gente que ha dejado su mensaje junto
// con la FECHA (que se pone automática en el momento de enviar).
//
// Persistencia: localStorage, así los mensajes siguen ahí al recargar la página.

import { openMockup } from './overlay.js';

const STORAGE_KEY = 'labiblioteca-registro';

// Marco (monitor CRT) y zona de pantalla (coords normalizadas 0..1 de la
// imagen). Ajusta SCREEN a ojo si el contenido no encaja perfecto.
const FRAME = './assets/monitor-1.png';
const SCREEN = { x: 0.067, y: 0.165, w: 0.771, h: 0.635 };

// Lee la lista guardada (o [] si no hay nada / está corrupta).
function loadEntries() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

// Guarda la lista.
function saveEntries(list) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

// Fecha automática legible en español: "06/06/2026, 14:32".
function nowStamp() {
  return new Date().toLocaleString('es-ES', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

// Escapa texto del usuario para inyectarlo en HTML sin riesgo.
function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

// Acción al pulsar el ordenador 1: abre el mockup con el libro de visitas
// (formulario + lista), todo dentro de la pantalla del monitor.
export function openRegister() {
  const { body } = openMockup({
    frame: FRAME,
    screen: SCREEN,
    screenBehind: true,     // el contenido va DETRÁS del PNG (se ve por la pantalla).
    closeOnBackdrop: false, // que no se cierre por error mientras se escribe.
  });
  // El contenido vive en una clase propia para aplicar la tipografía de 8 px.
  body.classList.add('iv-register');

  // ---- Vista FORMULARIO ----
  function renderForm() {
    body.innerHTML = `
      <p class="reg-intro">Deja tu huella en la biblioteca.<br>Tu mensaje quedará registrado con la fecha de hoy.</p>
      <form class="reg-form" autocomplete="off">
        <label class="reg-label">NOMBRE
          <input class="reg-input" name="nombre" maxlength="24" required>
        </label>
        <label class="reg-label">MENSAJE
          <textarea class="reg-input reg-textarea" name="mensaje" maxlength="140" rows="3" required></textarea>
        </label>
        <div class="reg-actions">
          <button type="submit" class="reg-btn">ENVIAR ▸</button>
          <button type="button" class="reg-btn reg-btn-ghost" data-action="ver">VER LISTA</button>
        </div>
      </form>`;

    const form = body.querySelector('.reg-form');
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const nombre = form.nombre.value.trim();
      const mensaje = form.mensaje.value.trim();
      if (!nombre || !mensaje) return;
      const list = loadEntries();
      list.unshift({ nombre, mensaje, fecha: nowStamp() }); // el más nuevo arriba.
      saveEntries(list);
      renderList();
    });
    body.querySelector('[data-action="ver"]').addEventListener('click', renderList);
  }

  // ---- Vista LISTA ----
  function renderList() {
    const list = loadEntries();
    const rows = list.length
      ? list.map((e) => `
          <li class="reg-item">
            <div class="reg-item-head">
              <span class="reg-item-name">${escapeHtml(e.nombre)}</span>
              <span class="reg-item-date">${escapeHtml(e.fecha)}</span>
            </div>
            <p class="reg-item-msg">${escapeHtml(e.mensaje)}</p>
          </li>`).join('')
      : '<li class="reg-empty">Aún no hay mensajes. Sé el primero.</li>';

    body.innerHTML = `
      <p class="reg-intro">${list.length} ${list.length === 1 ? 'visitante ha' : 'visitantes han'} dejado su mensaje.</p>
      <ul class="reg-list">${rows}</ul>
      <div class="reg-actions">
        <button type="button" class="reg-btn" data-action="nuevo">＋ NUEVO MENSAJE</button>
      </div>`;

    body.querySelector('[data-action="nuevo"]').addEventListener('click', renderForm);
  }

  renderForm();
}
