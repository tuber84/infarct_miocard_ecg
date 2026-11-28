import type { CaseId, Dominance, ExtraLeadId, StandardLeadId } from '../types';

export type GuidelineId = 'ru-stemi-2024' | 'ru-nste-2024';

export interface SourceReference {
  guidelineId: GuidelineId;
  sections: string[];
  /** Что именно подтверждается источником; источник не валидирует весь случай. */
  scope: string;
}

interface ScenarioBase {
  schemaVersion: 1;
  id: string;
  revision: number;
  title: string;
  learningObjectives: string[];
  references: SourceReference[];
  review: {
    status: 'draft' | 'partially-reviewed' | 'reviewed';
    note: string;
  };
}

/** Существующий пример атласа без выдуманных данных пациента и проверки ответа. */
export interface AtlasScenario extends ScenarioBase {
  kind: 'atlas';
  profileId: CaseId;
  assumptions: string[];
}

export interface PatientContext {
  ageYears: number;
  sex: 'female' | 'male';
  complaint: string;
  history: string;
  symptomOnsetMinutesAgo: number | null;
  bloodPressure: { systolic: number; diastolic: number } | null;
  heartRate: number;
}

export interface ScenarioQuestion {
  id: string;
  prompt: string;
  choices: { id: string; text: string }[];
  /** Один или несколько клинически допустимых ответов на вопрос с одним выбором. */
  acceptedChoiceIds: string[];
  explanation: string;
  references: SourceReference[];
}

export interface TrainingAngiographyView {
  system: 'LCA' | 'RCA' | 'BOTH';
  laoDeg: number;
  cranDeg: number;
}

export interface TrainingAnswerEvidence {
  markedLeads?: StandardLeadId[];
  angiography?: TrainingAngiographyView;
}

export type ClinicalStep = {
  id: string;
  title: string;
  question?: ScenarioQuestion;
} & (
  | { kind: 'information'; text: string }
  | { kind: 'ecg'; profileId: CaseId; dominance: Dominance; timeline: number; reperfused: boolean; heartRate: number; showExtraLeads?: boolean; extraLeads?: ExtraLeadId[]; markLeads?: boolean }
  | { kind: 'angiography'; profileId: CaseId; dominance: Dominance; targets: CaseId[] }
  | { kind: 'result'; modality: 'troponin' | 'echo' | 'angiography'; text: string; references: SourceReference[] }
);

/** Контракт будущих клинических задач. Порядок steps задаёт раскрытие данных. */
export interface ClinicalCaseScenario extends ScenarioBase {
  kind: 'clinical-case';
  patient: PatientContext;
  steps: ClinicalStep[];
  debrief: { diagnosis: string; explanation: string; references: SourceReference[] };
}

export type ClinicalScenario = AtlasScenario | ClinicalCaseScenario;
