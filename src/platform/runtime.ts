import { Capacitor } from '@capacitor/core';

const hasWindow = typeof window !== 'undefined';
const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
const maxTouchPoints = typeof navigator !== 'undefined' ? navigator.maxTouchPoints ?? 0 : 0;

const isAppleTouchDevice =
  /iPad|iPhone|iPod/.test(ua) || (ua.includes('Macintosh') && maxTouchPoints > 1);

export const isNativeMobile = Capacitor.isNativePlatform();

export const isStandalonePwa =
  !isNativeMobile &&
  hasWindow &&
  (window.matchMedia?.('(display-mode: standalone)').matches === true ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true);

export const isIosSafari =
  !isNativeMobile &&
  hasWindow &&
  isAppleTouchDevice &&
  /Safari/i.test(ua) &&
  !/(CriOS|FxiOS|EdgiOS|OPiOS|YaBrowser)/i.test(ua);

// Мобильная оболочка и установленная PWA открывают учебный маршрут; браузер и Electron — атлас.
export const preferTrainingHome = isNativeMobile || isStandalonePwa;
