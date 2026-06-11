// ============================================================================
// CÓMIC — LIBRO CON VOLTEO REALISTA (turn.js + jQuery)
// ============================================================================
// Flipbook de páginas reales usando turn.js (plugin de jQuery). Ambas librerías
// son scripts clásicos (no módulos ES), así que se cargan bajo demanda con
// loadScript: primero jQuery (define el global window.jQuery), después turn.js
// (que se engancha a ese jQuery). Una vez listas, se inicializa el libro a dos
// páginas con arrastre de esquinas, gradientes y sombra de lomo.
//
// Estructura del libro (8 páginas):
//   1) portada      -> comic-cover.png   (tapa dura, clase "hard")
//   2..7) contenido -> comic-page1.png … comic-page6.png
//   8) contraportada -> comic-cover2.png (tapa dura, clase "hard")
// Las tapas llevan la clase "hard" para que turn.js las voltee como cubiertas
// rígidas en vez de hojas de papel.

import { openOverlay, loadScript } from './overlay.js';

// Portada y contraportada (tapas duras) del cómic.
const COMIC_COVER = './assets/comic-cover.png';
const COMIC_BACK_COVER = './assets/comic-cover2.png';

// Páginas del cómic, en orden.
const COMIC_PAGES = [
  './assets/comic-page1.png',
  './assets/comic-page2.png',
  './assets/comic-page3.png',
  './assets/comic-page4.png',
  './assets/comic-page5.png',
  './assets/comic-page6.png',
];

// Tamaño de cada página (proporción 3:4). El libro a doble página mide
// 2 × PAGE_W de ancho. El overlay se dimensiona para dejar margen alrededor.
const PAGE_W = 380;
const PAGE_H = 506;
const BOOK_W = PAGE_W * 2;

export function openComic() {
  // Referencias que necesita la limpieza al cerrar (se rellenan al inicializar).
  let onKey = null;
  let $flip = null;

  const { body } = openOverlay({
    onClose: () => {
      if (onKey) window.removeEventListener('keydown', onKey);
      if ($flip) {
        try { $flip.turn('destroy'); } catch (e) { /* ya destruido */ }
      }
    },
  });
  body.classList.add('iv-comic');

  // Estructura: el libro (turn.js lo dimensiona) + controles.
  body.innerHTML = `
    <div class="comic-stage">
      <div class="comic-flipbook">
        <div class="comic-page hard"><img src="${COMIC_COVER}" draggable="false" alt="portada"></div>
        ${COMIC_PAGES.map(
          (src) =>
            `<div class="comic-page"><img src="${src}" draggable="false" alt=""></div>`
        ).join('')}
        <div class="comic-page hard"><img src="${COMIC_BACK_COVER}" draggable="false" alt="contraportada"></div>
      </div>
    </div>
    <div class="comic-controls">
      <button class="comic-btn" data-action="prev">◀ ANTERIOR</button>
      <span class="comic-counter"></span>
      <button class="comic-btn" data-action="next">SIGUIENTE ▶</button>
    </div>`;

  const flipEl = body.querySelector('.comic-flipbook');
  const counter = body.querySelector('.comic-counter');
  const prevBtn = body.querySelector('[data-action="prev"]');
  const nextBtn = body.querySelector('[data-action="next"]');

  // Carga jQuery y, después, el plugin turn.js (depende del global jQuery).
  loadScript('./interactions/jquery.js')
    .then(() => loadScript('./interactions/turn.js'))
    .then(() => {
      const $ = window.jQuery;
      $flip = $(flipEl);

      $flip.turn({
        width: BOOK_W,
        height: PAGE_H,
        autoCenter: true,
        display: 'double',
        gradients: true,
        acceleration: true,
        elevation: 50,
        duration: 800,
      });

      const total = $flip.turn('pages');

      function update() {
        const page = $flip.turn('page');
        counter.textContent = `${page} / ${total}`;
        prevBtn.disabled = page <= 1;
        nextBtn.disabled = page >= total;
      }

      $flip.bind('turned', update);

      nextBtn.addEventListener('click', () => $flip.turn('next'));
      prevBtn.addEventListener('click', () => $flip.turn('previous'));

      // Flechas del teclado para pasar página (capturadas en este overlay).
      onKey = (e) => {
        if (e.key === 'ArrowRight') $flip.turn('next');
        else if (e.key === 'ArrowLeft') $flip.turn('previous');
      };
      window.addEventListener('keydown', onKey);

      update();
    })
    .catch(() => {
      counter.textContent = 'Error al cargar el cómic';
    });
}
