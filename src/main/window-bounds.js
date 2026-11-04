// Decide qual posição/tamanho usar ao abrir a janela.

function isOverlapping(bounds, area) {
  return (
    bounds.x < area.x + area.width &&
    bounds.x + bounds.width > area.x &&
    bounds.y < area.y + area.height &&
    bounds.y + bounds.height > area.y
  );
}

/**
 * Reaproveita o que foi salvo. Se a posição não aparece em nenhum monitor
 * (ex.: monitor desconectado), mantém só o tamanho e deixa o sistema centralizar.
 */
export function restoreBounds(saved, workAreas, defaults) {
  if (!saved) return defaults;

  const { width, height } = saved;
  const isVisible =
    Number.isFinite(saved.x) &&
    Number.isFinite(saved.y) &&
    workAreas.some((area) => isOverlapping(saved, area));
  return isVisible ? saved : { width, height };
}
