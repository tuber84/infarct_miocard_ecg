import React, { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, RotateCcw } from 'lucide-react';
import {
  CHEST_LEADS,
  EXTRA_LEADS,
  LEAD_ANATOMY_LABEL,
  LIMB_LEADS,
} from '../core/content/coronaryCases';
import { getLeadBadge, sampleBeatMv } from '../core/ecg/ecgEngine';
import {
  ExtraLeadId,
  LeadId,
  LeadShiftProfile,
  ManualLeadState,
  StageModifiers,
} from '../core/types';

interface LeadCardsPanelProps {
  leadProfiles: Partial<Record<LeadId, LeadShiftProfile>>;
  stageMods: StageModifiers;
  manualMode: boolean;
  manualStates: Partial<Record<LeadId, ManualLeadState>>;
  recommendedExtraLeads: ExtraLeadId[];
  onToggleLeadManual: (lead: LeadId) => void;
  onResetManual: () => void;
}

function buildMiniLeadPath(
  leadId: LeadId,
  profile: LeadShiftProfile | undefined,
  stageMods: StageModifiers
): string {
  const width = 92;
  const height = 28;
  const baselineY = 17;
  const pxPerMv = 7.2;
  const beatDur = 0.72;
  const samples = 56;
  const pts: string[] = [];

  for (let i = 0; i <= samples; i++) {
    const u = i / samples;
    const t = 0.04 + u * 0.54;
    const mv = sampleBeatMv(t, beatDur, leadId, profile, stageMods, {
      artifacts: false,
      aivr: false,
    });
    const x = (u * width).toFixed(1);
    const y = Math.max(2, Math.min(height - 2, baselineY - mv * pxPerMv)).toFixed(1);
    pts.push(`${i === 0 ? 'M' : 'L'}${x},${y}`);
  }
  return pts.join(' ');
}

interface LeadCardProps {
  lead: LeadId;
  profile: LeadShiftProfile | undefined;
  stageMods: StageModifiers;
  manualMode: boolean;
  manualState: ManualLeadState;
  isRecommendedExtra: boolean;
  onToggleLeadManual: (lead: LeadId) => void;
}

const LeadCard: React.FC<LeadCardProps> = React.memo(({
  lead,
  profile,
  stageMods,
  manualMode,
  manualState,
  isRecommendedExtra,
  onToggleLeadManual,
}) => {
  const badge = getLeadBadge(profile, stageMods, lead);

  const effectiveHighlight = manualMode
    ? manualState
    : badge.tone === 'ste'
      ? 'ste'
      : badge.tone === 'std'
        ? 'std'
        : 'normal';

  const cardBorder =
    effectiveHighlight === 'ste'
      ? 'border-red-500 bg-red-50/75 ring-1 ring-red-400/50'
      : effectiveHighlight === 'std'
        ? 'border-blue-500 bg-blue-50/75 ring-1 ring-blue-400/50'
        : effectiveHighlight === 'tinv' || (!manualMode && badge.tone === 'inv')
          ? 'border-violet-400 bg-violet-50/70 ring-1 ring-violet-300/60'
          : !manualMode && badge.tone === 'hyper'
            ? 'border-amber-400 bg-amber-50/60 ring-1 ring-amber-300/60'
            : isRecommendedExtra
              ? 'border-amber-300 bg-amber-50/30 hover:border-amber-400'
              : 'border-slate-200 bg-white hover:border-slate-300';

  const pathD = useMemo(
    () => buildMiniLeadPath(lead, profile, stageMods),
    [lead, profile, stageMods]
  );

  const strokeColor =
    effectiveHighlight === 'ste'
      ? '#dc2626'
      : effectiveHighlight === 'std'
        ? '#2563eb'
        : effectiveHighlight === 'tinv' || (!manualMode && badge.tone === 'inv')
          ? '#7c3aed'
          : !manualMode && badge.tone === 'hyper'
            ? '#d97706'
            : '#475569';

  return (
    <button
      type="button"
      onClick={() => onToggleLeadManual(lead)}
      title="Клик: ST↑ → ST↓ → T↓ → Сброс"
      className={`group flex flex-col justify-between rounded-lg border px-2 py-1.5 text-left transition-all ${cardBorder}`}
    >
      <div className="flex w-full items-center justify-between gap-1">
        <span className="text-xs font-bold text-slate-900">{lead}</span>
        {manualMode ? (
          manualState !== 'normal' ? (
            <span
              className={`rounded px-1 py-0.5 text-[10px] font-bold leading-none ${
                manualState === 'ste'
                  ? 'bg-red-600 text-white'
                  : manualState === 'std'
                    ? 'bg-blue-600 text-white'
                    : 'bg-violet-600 text-white'
              }`}
            >
              {manualState === 'ste' ? 'ST↑' : manualState === 'std' ? 'ST↓' : 'T↓'}
            </span>
          ) : (
            <span className="text-[10px] text-slate-400">не оценено</span>
          )
        ) : badge.text ? (
          <span
            className={`rounded px-1 py-0.5 text-[9.5px] font-bold leading-none ${
              badge.tone === 'ste'
                ? 'bg-red-600 text-white'
                : badge.tone === 'std'
                  ? 'bg-blue-600 text-white'
                  : badge.tone === 'hyper'
                    ? 'bg-amber-500 text-white'
                    : 'bg-violet-600 text-white'
            }`}
          >
            {badge.text}
          </span>
        ) : (
          <span className="truncate text-[9.5px] text-slate-400">
            {LEAD_ANATOMY_LABEL[lead]}
          </span>
        )}
      </div>

      <svg viewBox="0 0 92 28" className="my-0.5 h-6 w-full overflow-visible">
        <line
          x1="0"
          y1="17"
          x2="92"
          y2="17"
          stroke="#cbd5e1"
          strokeWidth="0.7"
          strokeDasharray="2 2"
        />
        <path d={pathD} fill="none" stroke={strokeColor} strokeWidth="1.5" />
      </svg>

      <div className="flex w-full items-center justify-between text-[9.5px] text-slate-500">
        <span className="truncate">{LEAD_ANATOMY_LABEL[lead]}</span>
      </div>
    </button>
  );
});

const LeadCardsPanelComponent: React.FC<LeadCardsPanelProps> = ({
  leadProfiles,
  stageMods,
  manualMode,
  manualStates,
  recommendedExtraLeads,
  onToggleLeadManual,
  onResetManual,
}) => {
  const [showExtra, setShowExtra] = useState(recommendedExtraLeads.length > 0);

  // Автоматически раскрываем доп. отведения, если текущий кейс рекомендует V4R или V7-V9
  useEffect(() => {
    if (recommendedExtraLeads.length > 0) {
      setShowExtra(true);
    }
  }, [recommendedExtraLeads]);

  const renderLeadCard = (lead: LeadId) => (
    <LeadCard
      key={lead}
      lead={lead}
      profile={leadProfiles[lead]}
      stageMods={stageMods}
      manualMode={manualMode}
      manualState={manualStates[lead] ?? 'normal'}
      isRecommendedExtra={recommendedExtraLeads.includes(lead as ExtraLeadId)}
      onToggleLeadManual={onToggleLeadManual}
    />
  );

  return (
    <div className="flex h-full flex-col rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
        <div>
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700">
            Отведения и карта ЭКГ
          </h2>
          <p className="text-[10.5px] text-slate-500">
            1 = <span className="font-semibold text-red-600">ST↑</span>, 2 ={' '}
            <span className="font-semibold text-blue-600">ST↓</span>, 3 ={' '}
            <span className="font-semibold text-violet-600">T↓</span>, 4 = сброс
          </p>
        </div>
        {manualMode && (
          <button
            type="button"
            onClick={onResetManual}
            className="flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-100"
          >
            <RotateCcw className="h-3 w-3" />
            Сброс
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-2.5">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Конечности
            </div>
            <div className="flex flex-col gap-1.5">{LIMB_LEADS.map(renderLeadCard)}</div>
          </div>
          <div>
            <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Грудные
            </div>
            <div className="flex flex-col gap-1.5">{CHEST_LEADS.map(renderLeadCard)}</div>
          </div>
        </div>

        <div className="mt-2.5 border-t border-slate-100 pt-2">
          <button
            type="button"
            onClick={() => setShowExtra((s) => !s)}
            className="flex w-full items-center justify-between rounded-md bg-slate-50 px-2 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-100"
          >
            <span className="flex items-center gap-1.5">
              Доп. отведения (V3R–V4R, V7–V9)
              {recommendedExtraLeads.length > 0 && (
                <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[9.5px] font-bold text-amber-800">
                  Рекомендованы
                </span>
              )}
            </span>
            {showExtra ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>

          {showExtra && (
            <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-3">
              {EXTRA_LEADS.map(renderLeadCard)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export const LeadCardsPanel = React.memo(LeadCardsPanelComponent);
