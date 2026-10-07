import { formatMoney } from '../../../shared/financial-engine.ts';

export type FinanceChartItem = {
  label: string;
  value: number;
  tone?: 'income' | 'expense' | 'neutral' | 'warning';
  maxValue?: number;
};

const glyphs: Record<string, number[]> = {
  ' ': [0, 0, 0, 0, 0],
  A: [2, 5, 7, 5, 5],
  B: [6, 5, 6, 5, 6],
  C: [3, 4, 4, 4, 3],
  D: [6, 5, 5, 5, 6],
  E: [7, 4, 6, 4, 7],
  F: [7, 4, 6, 4, 4],
  G: [3, 4, 5, 5, 3],
  H: [5, 5, 7, 5, 5],
  I: [7, 2, 2, 2, 7],
  J: [1, 1, 1, 5, 2],
  K: [5, 5, 6, 5, 5],
  L: [4, 4, 4, 4, 7],
  M: [5, 7, 7, 5, 5],
  N: [5, 7, 7, 7, 5],
  O: [2, 5, 5, 5, 2],
  P: [6, 5, 6, 4, 4],
  Q: [2, 5, 5, 3, 1],
  R: [6, 5, 6, 5, 5],
  S: [3, 4, 2, 1, 6],
  T: [7, 2, 2, 2, 2],
  U: [5, 5, 5, 5, 7],
  V: [5, 5, 5, 5, 2],
  W: [5, 5, 7, 7, 5],
  X: [5, 5, 2, 5, 5],
  Y: [5, 5, 2, 2, 2],
  Z: [7, 1, 2, 4, 7],
  '0': [7, 5, 5, 5, 7],
  '1': [2, 6, 2, 2, 7],
  '2': [6, 1, 2, 4, 7],
  '3': [6, 1, 2, 1, 6],
  '4': [5, 5, 7, 1, 1],
  '5': [7, 4, 6, 1, 6],
  '6': [3, 4, 7, 5, 7],
  '7': [7, 1, 2, 2, 2],
  '8': [7, 5, 7, 5, 7],
  '9': [7, 5, 7, 1, 6],
  $: [2, 7, 6, 3, 6],
  ',': [0, 0, 0, 2, 4],
  '.': [0, 0, 0, 0, 2],
  '/': [1, 1, 2, 4, 4],
  '-': [0, 0, 7, 0, 0],
  '+': [0, 2, 7, 2, 0],
  ':': [0, 2, 0, 2, 0],
  '=': [0, 7, 0, 7, 0],
};

const colors = {
  background: [244, 247, 245, 255],
  header: [24, 67, 57, 255],
  ink: [28, 48, 43, 255],
  muted: [90, 108, 100, 255],
  grid: [218, 227, 222, 255],
  track: [230, 236, 232, 255],
  income: [42, 143, 98, 255],
  expense: [212, 103, 79, 255],
  neutral: [51, 130, 151, 255],
  warning: [211, 150, 48, 255],
} as const;

type Rgba = readonly [number, number, number, number];

function normalizedText(text: string) {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\u00a0/g, ' ')
    .toUpperCase();
}

function textWidth(text: string, scale: number) {
  return Math.max(0, text.length * 4 - 1) * scale;
}

function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function concatenate(parts: Uint8Array[]) {
  const result = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}

function pngChunk(name: string, data: Uint8Array) {
  const type = new TextEncoder().encode(name);
  const content = concatenate([type, data]);
  const chunk = new Uint8Array(12 + data.length);
  const view = new DataView(chunk.buffer);
  view.setUint32(0, data.length);
  chunk.set(content, 4);
  view.setUint32(8 + data.length, crc32(content));
  return chunk;
}

function fill(pixels: Uint8Array, width: number, x: number, y: number, w: number, h: number, color: Rgba) {
  const left = Math.max(0, Math.floor(x));
  const top = Math.max(0, Math.floor(y));
  const right = Math.min(width, Math.ceil(x + w));
  const bottom = Math.min(pixels.length / (width * 4), Math.ceil(y + h));
  for (let row = top; row < bottom; row++)
    for (let column = left; column < right; column++) {
      const offset = (row * width + column) * 4;
      pixels.set(color, offset);
    }
}

function drawText(
  pixels: Uint8Array,
  width: number,
  text: string,
  x: number,
  y: number,
  scale: number,
  color: Rgba,
) {
  let cursor = x;
  for (const character of normalizedText(text)) {
    const glyph = glyphs[character] ?? glyphs[' '];
    for (let row = 0; row < glyph.length; row++)
      for (let column = 0; column < 3; column++)
        if (glyph[row] & (1 << (2 - column)))
          fill(pixels, width, cursor + column * scale, y + row * scale, scale, scale, color);
    cursor += scale * 4;
  }
}

async function encodePng(width: number, height: number, pixels: Uint8Array) {
  const stride = width * 4;
  const scanlines = new Uint8Array(height * (stride + 1));
  for (let row = 0; row < height; row++)
    scanlines.set(pixels.subarray(row * stride, (row + 1) * stride), row * (stride + 1) + 1);
  const compressed = new Uint8Array(
    await new Response(
      new Blob([scanlines]).stream().pipeThrough(new CompressionStream('deflate')),
    ).arrayBuffer(),
  );
  const header = new Uint8Array(13);
  const view = new DataView(header.buffer);
  view.setUint32(0, width);
  view.setUint32(4, height);
  header[8] = 8;
  header[9] = 6;
  return concatenate([
    new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', header),
    pngChunk('IDAT', compressed),
    pngChunk('IEND', new Uint8Array()),
  ]);
}

export async function financeChartPng(input: {
  title: string;
  subtitle: string;
  items: FinanceChartItem[];
  footer?: string;
}) {
  const items = input.items.slice(0, 6);
  const width = 1200;
  const height = 230 + Math.max(items.length, 1) * 145 + 76;
  const pixels = new Uint8Array(width * height * 4);
  for (let offset = 0; offset < pixels.length; offset += 4) pixels.set(colors.background, offset);
  fill(pixels, width, 0, 0, width, 190, colors.header);
  drawText(pixels, width, input.title, 72, 54, 8, [255, 255, 255, 255]);
  drawText(pixels, width, input.subtitle, 76, 132, 4, [211, 231, 220, 255]);

  const maximum = Math.max(...items.map((item) => Math.abs(item.maxValue ?? item.value)), 1);
  const tones = {
    income: colors.income,
    expense: colors.expense,
    neutral: colors.neutral,
    warning: colors.warning,
  };
  for (const [index, item] of items.entries()) {
    const top = 218 + index * 145;
    drawText(pixels, width, item.label, 76, top, 5, colors.ink);
    const amount = formatMoney(Math.abs(item.value));
    drawText(pixels, width, amount, width - 76 - textWidth(amount, 5), top, 5, colors.muted);
    const trackX = 76;
    const trackY = top + 47;
    const trackWidth = width - 152;
    const trackHeight = 48;
    fill(pixels, width, trackX, trackY, trackWidth, trackHeight, colors.track);
    for (const fraction of [0.25, 0.5, 0.75])
      fill(pixels, width, trackX + trackWidth * fraction, trackY, 2, trackHeight, colors.grid);
    const scale = Math.max(item.maxValue ?? maximum, 1);
    const barWidth = item.value === 0 ? 0 : Math.max(8, (Math.abs(item.value) / scale) * trackWidth);
    fill(pixels, width, trackX, trackY, barWidth, trackHeight, tones[item.tone ?? 'neutral']);
  }
  const footer = normalizedText(input.footer ?? 'VALORES CALCULADOS PELO NEXO');
  const footerY = height - 52;
  fill(pixels, width, 0, footerY - 17, width, 1, colors.grid);
  drawText(pixels, width, footer, 76, footerY, 3, colors.muted);
  return encodePng(width, height, pixels);
}
