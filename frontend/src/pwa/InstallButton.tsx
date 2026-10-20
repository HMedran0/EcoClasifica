import { promptInstall, useCanInstall } from './installPrompt';

/** Botón secundario de la portada: borde y sin relleno para no competir con «Escanear residuo». */
export function InstallButton() {
  const canInstall = useCanInstall();
  if (!canInstall) return null;
  return (
    <button
      type="button"
      onClick={() => {
        // Si el navegador rechaza el cuadro no hay nada que mostrar: el botón ya se ocultó.
        promptInstall().catch(() => undefined);
      }}
      className="flex min-h-tactil w-full max-w-xs items-center justify-center rounded-2xl border-2 border-petroleo px-6 text-base font-semibold text-petroleo"
    >
      Instalar app
    </button>
  );
}
