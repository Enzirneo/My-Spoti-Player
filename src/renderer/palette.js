// Tema dinâmico: escolhe as cores do app a partir da capa da música (estilo One UI).
// Parte pura (pickTheme) e parte que usa o DOM (loadTheme), mantidas separadas.

const SAMPLE_SIZE = 24; // a capa é reduzida para 24x24 antes de somar as cores
const MIN_ALPHA = 128;
const GRAY_SATURATION = 0.08; // abaixo disso a capa é tratada como preto e branco
// Pixels coloridos pesam mais na saturação, para uma capa cinza com detalhe azul ficar azulada.
const BASE_WEIGHT = 0.15;

const BACKGROUND = { minSaturation: 0.3, maxSaturation: 0.6, lightness: 26 }; // fundo escuro com a cor da capa
const ACCENT = { minSaturation: 0.35, maxSaturation: 0.75, lightness: 76 }; // onda e barra
// As 3 cores das ondas são a MESMA cor da capa, só em claridades diferentes.
const WAVE_LIGHTNESS = [58, 68, 80];
const WAVE_SATURATION = { min: 0.4, max: 0.85 };
const HUE_BUCKETS = 12; // a capa é dividida em faixas de 30° de matiz para achar a cor dominante

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

/**
 * Recebe pixels RGBA (como getImageData) e devolve { background, accent, colors } ou null.
 * Tudo sai de UMA cor só: o matiz dominante da capa (o que mais aparece, com cor). As outras
 * cores da imagem são ignoradas, para o app nunca misturar tons que não combinam.
 */
export function pickTheme(pixels) {
  // Cada faixa de matiz guarda peso, seno/cosseno (média em círculo: senão vermelho, que fica em
  // 0°/360°, viraria verde) e saturação. Pixel cinza não tem matiz e não entra nas faixas.
  const buckets = Array.from({ length: HUE_BUCKETS }, () => ({
    weight: 0,
    sin: 0,
    cos: 0,
    saturation: 0,
  }));
  let totalWeight = 0;
  let graySaturation = 0; // saturação geral, para decidir se a capa é preto e branco

  for (let index = 0; index < pixels.length; index += 4) {
    if (pixels[index + 3] < MIN_ALPHA) continue;
    const { hue, saturation } = rgbToHsl(
      pixels[index],
      pixels[index + 1],
      pixels[index + 2]
    );
    const weight = BASE_WEIGHT + saturation;
    graySaturation += saturation * weight;
    totalWeight += weight;
    if (saturation < GRAY_SATURATION) continue;
    const bucket = buckets[Math.floor(hue / (360 / HUE_BUCKETS)) % HUE_BUCKETS];
    const radians = (hue * Math.PI) / 180;
    bucket.weight += saturation;
    bucket.sin += Math.sin(radians) * saturation;
    bucket.cos += Math.cos(radians) * saturation;
    bucket.saturation += saturation * saturation;
  }
  if (totalWeight === 0) return null;

  if (graySaturation / totalWeight < GRAY_SATURATION) {
    return {
      background: hsl(0, 0, BACKGROUND.lightness),
      accent: hsl(0, 0, ACCENT.lightness),
      colors: WAVE_LIGHTNESS.map((lightness) => hsl(0, 0, lightness)),
    };
  }

  // Faixa dominante = a de maior peso somado com as vizinhas (um verde que cai na divisa de duas
  // faixas não pode perder para outra cor só por ter sido partido ao meio).
  const near = (index) => [
    buckets[(index + HUE_BUCKETS - 1) % HUE_BUCKETS],
    buckets[index],
    buckets[(index + 1) % HUE_BUCKETS],
  ];
  let best = 0;
  let bestScore = -1;
  for (let index = 0; index < HUE_BUCKETS; index++) {
    const score = near(index).reduce((sum, bucket) => sum + bucket.weight, 0);
    if (score > bestScore) {
      best = index;
      bestScore = score;
    }
  }
  const group = near(best);
  const sin = group.reduce((sum, bucket) => sum + bucket.sin, 0);
  const cos = group.reduce((sum, bucket) => sum + bucket.cos, 0);
  const weight = group.reduce((sum, bucket) => sum + bucket.weight, 0);
  const hue = ((Math.atan2(sin, cos) * 180) / Math.PI + 360) % 360;
  const saturation = group.reduce((sum, bucket) => sum + bucket.saturation, 0) / weight;

  return {
    background: hsl(
      hue,
      clamp(saturation, BACKGROUND.minSaturation, BACKGROUND.maxSaturation),
      BACKGROUND.lightness
    ),
    accent: hsl(
      hue,
      clamp(saturation, ACCENT.minSaturation, ACCENT.maxSaturation),
      ACCENT.lightness
    ),
    colors: WAVE_LIGHTNESS.map((lightness) =>
      hsl(hue, clamp(saturation, WAVE_SATURATION.min, WAVE_SATURATION.max), lightness)
    ),
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
