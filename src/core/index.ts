/** Публичный интерфейс ядра. Доступен в Node.js и в оболочках приложения. */
export * from './types';
export * from './ecg/ecgEngine';
export * from './ecg/localizer';
export * from './content/coronaryCases';
export * from './content/clinicalGuidelines';
export * from './scenarios/types';
export * from './scenarios/catalog';
export * from './scenarios/validate';
export * from './scenarios/firstCase';
export * from './scenarios/training';
