import { Resvg, initWasm } from '@resvg/resvg-wasm';
import { financeChartAssets } from './finance-chart-assets.ts';
import { formatMoney } from '../../../shared/financial-engine.ts';

export type FinanceChartItem = {
  label: string;
  value: number;
  tone?: 'income' | 'expense' | 'neutral' | 'warning';
  maxValue?: number;
};

const width = 1200;
const colors = {
  cream: '#f4f7f6',
  paper: '#ffffff',
  sand: '#e7eeea',
  ink: '#192b25',
  muted: '#56645e',
  line: '#dce5df',
  terra: '#a94729',
  moss: '#24664f',
  limeSoft: '#edf2dd',
  warning: '#825419',
};
const toneColor = {
  income: colors.moss,
  expense: colors.terra,
  neutral: colors.ink,
  warning: colors.warning,
};
let rendererReady: Promise<{ regular: Uint8Array; bold: Uint8Array }> | null = null;

async function decompressAsset(value: string) {
  const compressed = Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
  const stream = new Response(compressed).body!.pipeThrough(new DecompressionStream('gzip'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function xml(value: string) {
  return value.replace(/[&<>\"']/g, (character) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '\"': '&quot;',
      "'": '&apos;',
    };
    return entities[character];
  });
}

export async function financeChartPng(input: {
  title: string;
  subtitle: string;
  items: FinanceChartItem[];
  footer?: string;
}) {
  rendererReady ??= (async () => {
    const [wasm, regular, bold] = await Promise.all([
      decompressAsset(financeChartAssets.wasm),
      decompressAsset(financeChartAssets.manropeRegular),
      decompressAsset(financeChartAssets.manropeBold),
    ]);
    await initWasm(wasm);
    return { regular, bold };
  })();
  const fonts = await rendererReady;

  const items = input.items.slice(0, 6);
  const height = 230 + Math.max(items.length, 1) * 145 + 76;
  const chartX = 72;
  const chartWidth = width - chartX * 2;
  const maximum = Math.max(...items.map((item) => Math.abs(item.maxValue ?? item.value)), 1);
  const rows = items
    .map((item, index) => {
      const top = 220 + index * 145;
      const scale = Math.max(item.maxValue ?? maximum, 1);
      const barWidth = item.value === 0 ? 0 : Math.max(8, (Math.abs(item.value) / scale) * chartWidth);
      const ticks = [0.25, 0.5, 0.75]
        .map((fraction) => {
          const x = chartX + chartWidth * fraction;
          return `<line x1="${x}" y1="${top + 56}" x2="${x}" y2="${top + 96}" stroke="${colors.line}" stroke-width="2"/>`;
        })
        .join('');
      return `<g>
        <text x="${chartX}" y="${top + 22}" font-family="Manrope" font-size="25" font-weight="700" fill="${colors.ink}">${xml(item.label.slice(0, 48))}</text>
        <text x="${width - chartX}" y="${top + 22}" text-anchor="end" font-family="Manrope" font-size="25" font-weight="700" fill="${colors.ink}">${xml(formatMoney(Math.abs(item.value)))}</text>
        <rect x="${chartX}" y="${top + 56}" width="${chartWidth}" height="40" rx="12" fill="${colors.sand}"/>
        ${ticks}
        <rect x="${chartX}" y="${top + 56}" width="${barWidth}" height="40" rx="12" fill="${toneColor[item.tone ?? 'neutral']}"/>
      </g>`;
    })
    .join('');

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <rect width="${width}" height="${height}" fill="${colors.cream}"/>
    <rect x="0" y="0" width="${width}" height="180" fill="${colors.moss}"/>
    <rect x="${chartX}" y="36" width="118" height="6" rx="3" fill="${colors.limeSoft}"/>
    <text x="${chartX}" y="78" font-family="Manrope" font-size="18" font-weight="700" letter-spacing="1.2" fill="${colors.limeSoft}">NEXO</text>
    <text x="${chartX}" y="126" font-family="Manrope" font-size="38" font-weight="700" fill="${colors.paper}">${xml(input.title.slice(0, 48))}</text>
    <text x="${chartX}" y="158" font-family="Manrope" font-size="20" font-weight="400" fill="${colors.limeSoft}">${xml(input.subtitle.slice(0, 72))}</text>
    ${rows || `<text x="${chartX}" y="260" font-family="Manrope" font-size="24" fill="${colors.muted}">Sem dados para mostrar ainda.</text>`}
    <line x1="${chartX}" y1="${height - 64}" x2="${width - chartX}" y2="${height - 64}" stroke="${colors.line}" stroke-width="2"/>
    <text x="${chartX}" y="${height - 34}" font-family="Manrope" font-size="17" font-weight="600" fill="${colors.muted}">${xml((input.footer ?? 'VALORES CALCULADOS PELO NEXO').slice(0, 80))}</text>
  </svg>`;

  const renderer = new Resvg(svg, {
    font: {
      fontBuffers: [fonts.regular, fonts.bold],
      defaultFontFamily: 'Manrope',
      loadSystemFonts: false,
    },
  });
  const rendered = renderer.render();
  try {
    return rendered.asPng();
  } finally {
    rendered.free();
    renderer.free();
  }
}
