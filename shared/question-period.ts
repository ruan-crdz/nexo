import { shiftDays, shiftMonths } from './financial-engine.ts';

const monthNames =
  'janeiro fevereiro marco abril maio junho julho agosto setembro outubro novembro dezembro'.split(' ');
type Period = { start: string; end: string; explicit: boolean } | { error: string };
const clarification =
  'Não consegui determinar esse período com segurança. Diga, por exemplo, “em janeiro de 2026”, “ontem”, “mês passado” ou “nos últimos 7 dias”.';

// Input is normalized to lowercase without accents. Never silently replace an
// explicit but unsupported period with the current month.
export function questionPeriod(text: string, today: string): Period {
  let start = `${today.slice(0, 7)}-01`,
    end = today;
  const names = [...text.matchAll(new RegExp(`\\b(${monthNames.join('|')})\\b`, 'g'))];
  const years = [...text.matchAll(/\b((?:19|20|21)\d{2})\b/g)];
  const last = text.match(/\bultimos?\s+(\d+)\s+dias\b/);
  const remainingNumbers = text
    .replace(/\b(?:19|20|21)\d{2}\b/g, '')
    .replace(/\bultimos?\s+\d+\s+dias\b/, '');
  if (
    /\b\d+\b/.test(remainingNumbers) ||
    /retrasad|proxim|anterior|antes|depois/.test(text) ||
    (years.length && /ano passado/.test(text))
  )
    return { error: clarification };
  const relative = [
    ...text.matchAll(
      /\b(hoje|ontem|mes passado|ultimo mes|este mes|nesse mes|neste mes|deste mes|esse mes|mes atual|no mes atual)\b/g,
    ),
  ];
  if (
    /\b(?:desde|entre|semana|semanas|semestre|trimestre|anteontem|amanha)\b|\d[/-]\d|\b(?:dia|dias)\s+\d/.test(
      text,
    )
  )
    return { error: clarification };
  if (
    names.length > 1 ||
    years.length > 1 ||
    relative.length > 1 ||
    (names.length && (relative.length || last)) ||
    (last && relative.length)
  )
    return { error: clarification };
  if (names.length) {
    const year = years[0]?.[1] ?? String(Number(today.slice(0, 4)) - (/ano passado/.test(text) ? 1 : 0));
    start = `${year}-${String(monthNames.indexOf(names[0][1]) + 1).padStart(2, '0')}-01`;
    end = shiftDays(shiftMonths(start, 1), -1);
  } else if (last) {
    const count = Number(last[1]);
    if (count < 1 || count > 366 || years.length) return { error: clarification };
    start = shiftDays(today, 1 - count);
  } else if (relative.length) {
    if (years.length || /ano passado/.test(text)) return { error: clarification };
    if (relative[0][1] === 'ontem') start = end = shiftDays(today, -1);
    else if (relative[0][1] === 'hoje') start = today;
    else if (/mes passado|ultimo mes/.test(relative[0][1])) {
      start = `${shiftMonths(today, -1).slice(0, 7)}-01`;
      end = shiftDays(`${today.slice(0, 7)}-01`, -1);
    }
  } else if (years.length || /\b(ano passado|este ano|neste ano)\b/.test(text)) {
    const year = years[0]?.[1] ?? String(Number(today.slice(0, 4)) - (/ano passado/.test(text) ? 1 : 0));
    start = `${year}-01-01`;
    end = `${year}-12-31`;
  } else if (/\b(ano|anos|mes|meses|dia|dias|periodo|ultimos?|proximos?|passad[oa]s?)\b/.test(text)) {
    return { error: clarification };
  }
  if (start > today)
    return {
      error:
        'Esse período ainda não começou. Informe um período passado para consultar gastos ou entradas que já aconteceram.',
    };
  return {
    start,
    end: end > today ? today : end,
    explicit: !!(
      names.length ||
      years.length ||
      last ||
      relative.length ||
      /ano passado|este ano|neste ano/.test(text)
    ),
  };
}
