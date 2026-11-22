import { Capacitor } from '@capacitor/core';

// Мобильная оболочка открывает учебный маршрут; браузер и Electron — атлас.
export const isNativeMobile = Capacitor.isNativePlatform();
