// Posição e tamanho da janela nos dois modos: cápsula (compacta) e painel expandido.
// Os dois ficam ancorados no topo, centralizados na área de trabalho do monitor.

function centeredAtTop(workArea, size, topMargin) {
  return {
    x: Math.round(workArea.x + (workArea.width - size.width) / 2),
    y: workArea.y + topMargin,
    width: size.width,
    height: size.height,
  };
}

export function capsuleBounds(workArea, size, topMargin) {
  return centeredAtTop(workArea, size, topMargin);
}

/** Painel expandido: tamanho preferido, limitado entre o mínimo e o tamanho da tela. */
export function expandedBounds(workArea, preferredSize, minSize, topMargin) {
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const size = {
    width: clamp(preferredSize.width, minSize.width, workArea.width),
    height: clamp(preferredSize.height, minSize.height, workArea.height - topMargin),
  };
  return centeredAtTop(workArea, size, topMargin);
}
