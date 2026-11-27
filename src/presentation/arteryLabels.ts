import type { ArterySegment } from './segmentedHeart';

/** Анатомические подписи отделены от названий учебных случаев. */
export const ARTERY_LABELS: Record<ArterySegment, { shortRu: string; ru: string; en: string }> = {
  LMCA: { shortRu: 'Ствол ЛКА (LMCA)', ru: 'Ствол левой коронарной артерии', en: 'Left main coronary artery' },
  LAD_prox: { shortRu: 'ПМЖВ прокс. (LAD)', ru: 'Проксимальный сегмент ПМЖВ', en: 'Proximal LAD' },
  LAD_mid: { shortRu: 'ПМЖВ сред. (LAD)', ru: 'Средний сегмент ПМЖВ', en: 'Mid LAD' },
  LAD_dist: { shortRu: 'ПМЖВ дист. (LAD)', ru: 'Дистальный сегмент ПМЖВ', en: 'Distal LAD' },
  D1: { shortRu: 'ДВ1 (D1)', ru: 'Первая диагональная ветвь ПМЖВ', en: 'First diagonal branch' },
  D2: { shortRu: 'ДВ2 (D2)', ru: 'Вторая диагональная ветвь ПМЖВ', en: 'Second diagonal branch' },
  LCx: { shortRu: 'ОВ (LCx)', ru: 'Огибающая ветвь левой коронарной артерии', en: 'Left circumflex artery' },
  OM1: { shortRu: 'ВТК1 (OM1)', ru: 'Первая ветвь тупого края', en: 'First obtuse marginal branch' },
  RCA_prox: { shortRu: 'ПКА прокс. (RCA)', ru: 'Проксимальный сегмент ПКА', en: 'Proximal RCA' },
  RCA_mid: { shortRu: 'ПКА сред. (RCA)', ru: 'Средний сегмент ПКА', en: 'Mid RCA' },
  RCA_dist: { shortRu: 'ПКА дист. (RCA)', ru: 'Дистальный сегмент ПКА', en: 'Distal RCA' },
  PDA: { shortRu: 'ЗМЖВ (PDA)', ru: 'Задняя межжелудочковая ветвь', en: 'Posterior descending artery' },
  PLB: { shortRu: 'ЗБВ (PLB)', ru: 'Заднебоковая ветвь', en: 'Posterolateral branch' },
};
