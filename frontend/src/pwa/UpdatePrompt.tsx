import { useRegisterSW } from 'virtual:pwa-register/react';

/** registerType 'prompt': el SW nuevo espera hasta que el usuario pulse «Actualizar». */
export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  if (!needRefresh) return null;
  return (
    <div
      role="alert"
      className="fixed inset-x-4 bottom-4 z-20 flex items-center justify-between gap-4 rounded-2xl bg-petroleo px-4 py-3 text-white shadow-lg"
    >
      <p className="text-base">Hay una versión nueva</p>
      <button
        type="button"
        onClick={() => void updateServiceWorker(true)}
        className="min-h-tactil rounded-xl bg-lima px-4 font-bold text-petroleo"
      >
        Actualizar
      </button>
    </div>
  );
}
