// Arrastar a janela clicando em qualquer área livre. O renderer só informa a posição do
// mouse na tela; quem move a janela é o main (ver src/main/window-drag.js).
const INTERACTIVE_SELECTOR = 'button, input, .progress__bar';

export function enableWindowDrag(element, api) {
  let isDragging = false;
  const mousePosition = (event) => ({ x: event.screenX, y: event.screenY });

  element.addEventListener('pointerdown', (event) => {
    if (event.button !== 0 || event.target.closest(INTERACTIVE_SELECTOR)) return;
    isDragging = true;
    element.setPointerCapture(event.pointerId);
    api.startWindowDrag(mousePosition(event));
  });

  element.addEventListener('pointermove', (event) => {
    if (isDragging) api.dragWindow(mousePosition(event));
  });

  function stopDragging() {
    if (!isDragging) return;
    isDragging = false;
    api.endWindowDrag();
  }
  element.addEventListener('pointerup', stopDragging);
  element.addEventListener('pointercancel', stopDragging);
}
