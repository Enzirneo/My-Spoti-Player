// Tema dinâmico: escolhe as cores do app a partir da capa da música (estilo One UI).
// Parte pura (pickTheme) e parte que usa o DOM (loadTheme), mantidas separadas.

const SAMPLE_SIZE = 24; // a capa é reduzida para 24x24 antes de somar as cores
const MIN_ALPHA = 128;
const GRAY_SATURATION = 0.08; // abaixo disso a capa é tratada como preto e branco
// Pixels coloridos pesam mais na saturação, para uma capa cinza com detalhe azul ficar azulada.
const BASE_WEIGHT = 0.15;

const BACKGROUND = { maxSaturation: 0.6, lightness: 26 }; // fundo escuro, mas com a cor da capa
const WAVE_COLOR_COUNT = 3;
const HUE_BUCKETS = 12; // a capa é dividida em faixas de 30° de matiz
const MIN_HUE_GAP = 50; // cores de onda escolhidas precisam ser bem diferentes entre si
const WAVE_LIGHTNESS = [62, 74, 50]; // claridades usadas quando faltam matizes
const ACCENT = { minSaturation: 0.35, maxSaturation: 0.75, lightness: 76 }; // onda e barra

function rgbToHsl(red, green, blue) {
  const [r, g, b] = [red / 255, green / 255, blue / 255];
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const lightness = (max + min) / 2;
  if (max === min) return { hue: 0, saturation: 0, lightness };

  const delta = max - min;
  const saturation = delta / (1 - Math.abs(2 * lightness - 1));
  let hue;
  if (max === r) hue = ((g - b) / delta) % 6;
  else if (max === g) hue = (b - r) / delta + 2;
  else hue = (r - g) / delta + 4;
  return { hue: (hue * 60 + 360) % 360, saturation, lightness };
}

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const hsl = (hue, saturation, lightness) =>
  `hsl(${Math.round(hue)}, ${Math.round(saturation * 100)}%, ${lightness}%)`;

const hueDistance = (a, b) => Math.min(Math.abs(a - b), 360 - Math.abs(a - b));

/** Escolhe até 3 cores de matizes diferentes (as mais presentes na capa) para as ondas. */
function pickWaveColors(buckets, fallbackHue, fallbackSaturation) {
  const ranked = buckets
    .filter((bucket) => bucket.weight > 0)
    .sort((first, second) => second.weight - first.weight);
  const chosen = [];
  for (const bucket of ranked) {
    const hue = bucket.sumHue / bucket.weight;
    if (chosen.every((other) => hueDistance(other.hue, hue) >= MIN_HUE_GAP)) {
      chosen.push({ hue, saturation: bucket.sumSaturation / bucket.weight });
    }
    if (chosen.length === WAVE_COLOR_COUNT) break;
  }
  // Faltou matiz (capa de uma cor ou cinza): completa com variações de claridade.
  while (chosen.length < WAVE_COLOR_COUNT) {
    chosen.push({ hue: fallbackHue, saturation: fallbackSaturation, lighter: true });
  }
  return chosen.map((color, index) =>
    hsl(
      color.hue,
      color.saturation < GRAY_SATURATION ? 0 : clamp(color.saturation, 0.4, 0.85),
      WAVE_LIGHTNESS[color.lighter ? index : 0] + (color.lighter ? 0 : index * 6)
    )
  );
}

/** Recebe pixels RGBA (como getImageData) e devolve { background, accent } ou null. */
export function pickTheme(pixels) {
  // O matiz é uma média em círculo (seno/cosseno), senão vermelho (0/360) vira verde, e só conta
  // quem tem cor: um pixel cinza não tem matiz e não pode puxar a média para o vermelho.
  let sumSin = 0;
  let sumCos = 0;
  let sumSaturation = 0;
  let totalWeight = 0;
  const buckets = Array.from({ length: HUE_BUCKETS }, () => ({
    weight: 0,
    sumHue: 0,
    sumSaturation: 0,
  }));

  for (let index = 0; index < pixels.length; index += 4) {
    if (pixels[index + 3] < MIN_ALPHA) continue;
    const { hue, saturation } = rgbToHsl(
      pixels[index],
      pixels[index + 1],
      pixels[index + 2]
    );
    const weight = BASE_WEIGHT + saturation;
    const radians = (hue * Math.PI) / 180;
    sumSin += Math.sin(radians) * saturation;
    sumCos += Math.cos(radians) * saturation;
    sumSaturation += saturation * weight;
    totalWeight += weight;
    if (saturation >= GRAY_SATURATION) {
      const bucket = buckets[Math.floor(hue / (360 / HUE_BUCKETS)) % HUE_BUCKETS];
      bucket.weight += saturation;
      bucket.sumHue += hue * saturation;
      bucket.sumSaturation += saturation * saturation;
    }
  }
  if (totalWeight === 0) return null;

  const hue = ((Math.atan2(sumSin, sumCos) * 180) / Math.PI + 360) % 360;
  const saturation = sumSaturation / totalWeight;
  if (saturation < GRAY_SATURATION) {
    return {
      background: hsl(0, 0, BACKGROUND.lightness),
      accent: hsl(0, 0, ACCENT.lightness),
      colors: pickWaveColors([], 0, 0),
    };
  }
  return {
    background: hsl(
      hue,
      Math.min(saturation, BACKGROUND.maxSaturation),
      BACKGROUND.lightness
    ),
    accent: hsl(
      hue,
      clamp(saturation, ACCENT.minSaturation, ACCENT.maxSaturation),
      ACCENT.lightness
    ),
    colors: pickWaveColors(buckets, hue, saturation),
  };
}

/** Lê a capa (precisa de CORS liberado) e devolve o tema, ou null se não der para ler. */
export function loadTheme(image) {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = SAMPLE_SIZE;
    canvas.height = SAMPLE_SIZE;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    context.drawImage(image, 0, 0, SAMPLE_SIZE, SAMPLE_SIZE);
    return pickTheme(context.getImageData(0, 0, SAMPLE_SIZE, SAMPLE_SIZE).data);
  } catch (error) {
    // Canvas "sujo" (sem CORS): o app segue com o tema neutro.
    console.error('Não foi possível ler as cores da capa:', error.message);
    return null;
  }
}
