import { isNativeMobile } from './runtime';

export function registerPwaServiceWorker(): void {
  if (typeof window === 'undefined' || import.meta.env.DEV || isNativeMobile) {
    return;
  }

  const isSupportedOrigin =
    window.location.protocol === 'https:' ||
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1';

  if (!isSupportedOrigin || !('serviceWorker' in navigator)) {
    return;
  }

  const register = () => {
    navigator.serviceWorker.register('./sw.js', { scope: './' }).catch(() => {
      // Регистрация не должна блокировать работу приложения при ограничениях браузера.
    });
  };

  if (document.readyState === 'complete') {
    register();
  } else {
    window.addEventListener('load', register, { once: true });
  }
}
