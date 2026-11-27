import type { Dominance } from '../core/types';
import type { ArterySegment } from './segmentedHeart';

export type LabelNotation = 'anatomy' | 'syntax';

export interface ArteryLabelDef {
  shortRu: string;
  ru: string;
  en: string;
  syntaxRight: string;
  syntaxLeft: string;
}

/** Анатомические подписи и сегменты SYNTAX отделены от названий учебных случаев. */
export const ARTERY_LABELS: Record<ArterySegment, ArteryLabelDef> = {
  LMCA: { shortRu: 'Ствол ЛКА (LMCA)', ru: 'Ствол левой коронарной артерии', en: 'Left main coronary artery', syntaxRight: '5', syntaxLeft: '5' },
  LAD_prox: { shortRu: 'ПМЖВ прокс. (LAD)', ru: 'Проксимальный сегмент ПМЖВ', en: 'Proximal LAD', syntaxRight: '6', syntaxLeft: '6' },
  LAD_mid: { shortRu: 'ПМЖВ сред. (LAD)', ru: 'Средний сегмент ПМЖВ', en: 'Mid LAD', syntaxRight: '7', syntaxLeft: '7' },
  LAD_dist: { shortRu: 'ПМЖВ дист. (LAD)', ru: 'Дистальный сегмент ПМЖВ', en: 'Distal LAD', syntaxRight: '8', syntaxLeft: '8' },
  D1: { shortRu: 'ДВ1 (D1)', ru: 'Первая диагональная ветвь ПМЖВ', en: 'First diagonal branch', syntaxRight: '9', syntaxLeft: '9' },
  D2: { shortRu: 'ДВ2 (D2)', ru: 'Вторая диагональная ветвь ПМЖВ', en: 'Second diagonal branch', syntaxRight: '10', syntaxLeft: '10' },
  LCx: { shortRu: 'ОВ (LCx)', ru: 'Огибающая ветвь левой коронарной артерии', en: 'Left circumflex artery', syntaxRight: '11/13', syntaxLeft: '11/13' },
  OM1: { shortRu: 'ВТК1 (OM1)', ru: 'Первая ветвь тупого края', en: 'First obtuse marginal branch', syntaxRight: '12a', syntaxLeft: '12a' },
  RCA_prox: { shortRu: 'ПКА прокс. (RCA)', ru: 'Проксимальный сегмент ПКА', en: 'Proximal RCA', syntaxRight: '1', syntaxLeft: '1' },
  RCA_mid: { shortRu: 'ПКА сред. (RCA)', ru: 'Средний сегмент ПКА', en: 'Mid RCA', syntaxRight: '2', syntaxLeft: '2' },
  RCA_dist: { shortRu: 'ПКА дист. (RCA)', ru: 'Дистальный сегмент ПКА', en: 'Distal RCA', syntaxRight: '3', syntaxLeft: '3' },
  PDA: { shortRu: 'ЗМЖВ (PDA)', ru: 'Задняя межжелудочковая ветвь', en: 'Posterior descending artery', syntaxRight: '4', syntaxLeft: '15' },
  PLB: { shortRu: 'ЗБВ (PLB)', ru: 'Заднебоковая ветвь', en: 'Posterolateral branch', syntaxRight: '16', syntaxLeft: '14' },
};

export function getSyntaxSegmentCode(segment: ArterySegment, dominance: Dominance): string {
  const def = ARTERY_LABELS[segment];
  return dominance === 'left' ? def.syntaxLeft : def.syntaxRight;
}

export function formatArteryLabel(
  segment: ArterySegment,
  dominance: Dominance,
  notation: LabelNotation
): string {
  const def = ARTERY_LABELS[segment];
  if (notation === 'anatomy') return def.shortRu;
  const code = getSyntaxSegmentCode(segment, dominance);
  const shortBase = def.shortRu.replace(/\s*\([^)]*\)/g, '').trim();
  return `SYNTAX ${code} · ${shortBase}`;
}
