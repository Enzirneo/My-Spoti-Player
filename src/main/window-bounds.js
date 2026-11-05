// Posição e tamanho da janela nos dois modos: normal (janelinha quadrada) e tag (barra mini).
// Funções puras: recebem as áreas de trabalho dos monitores e devolvem os limites.

function isOverlapping(bounds, area) {
  return (
    bounds.x < area.x + area.width &&
    bounds.x + bounds.width > area.x &&
    bounds.y < area.y + area.height &&
    bounds.y + bounds.height > area.y
  );
}

function isVisibleOnAnyScreen(bounds, workAreas) {
  return (
    Number.isFinite(bounds.x) &&
    Number.isFinite(bounds.y) &&
    workAreas.some((area) => isOverlapping(bounds, area))
  );
}

function centeredIn(workArea, size) {
  return {
    x: Math.round(workArea.x + (workArea.width - size.width) / 2),
    y: Math.round(workArea.y + (workArea.height - size.height) / 2),
    ...size,
  };
}

/**
 * Janela normal: reaproveita o que foi salvo. Se a posição não aparece em nenhum
 * monitor (ex.: monitor desconectado), mantém o tamanho e centraliza.
 */
export function restoreBounds(saved, workAreas, defaultSize, fallbackWorkArea) {
  if (!saved) return centeredIn(fallbackWorkArea, defaultSize);
  if (isVisibleOnAnyScreen(saved, workAreas)) return saved;
  return centeredIn(fallbackWorkArea, { width: saved.width, height: saved.height });
}

/** Tag: tamanho fixo; usa a posição salva ou, sem ela, o topo central do monitor. */
export function restoreTagBounds(
  savedPosition,
  size,
  workAreas,
  fallbackWorkArea,
  topMargin
) {
  if (savedPosition) {
    const bounds = { ...savedPosition, ...size };
    if (isVisibleOnAnyScreen(bounds, workAreas)) return bounds;
  }
  return {
    x: Math.round(fallbackWorkArea.x + (fallbackWorkArea.width - size.width) / 2),
    y: fallbackWorkArea.y + topMargin,
    ...size,
  };
}

/** Arrasto manual: move a janela pelo deslocamento do mouse, mantendo o tamanho. */
export function movedBounds(startBounds, startMouse, mouse) {
  return {
    ...startBounds,
    x: startBounds.x + (mouse.x - startMouse.x),
    y: startBounds.y + (mouse.y - startMouse.y),
  };
}
