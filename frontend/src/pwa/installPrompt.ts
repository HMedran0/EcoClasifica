import { useSyncExternalStore } from 'react';

/** `beforeinstallprompt` no está en lib.dom (solo Chromium lo emite). */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

function isInstallPromptEvent(event: Event): event is BeforeInstallPromptEvent {
  return typeof (event as Partial<BeforeInstallPromptEvent>).prompt === 'function';
}

let deferred: BeforeInstallPromptEvent | null = null;
// Tras ofrecer la instalación (acepte o cancele) no se vuelve a ofrecer en esta sesión.
let offered = false;
const listeners = new Set<() => void>();

function emit(): void {
  listeners.forEach((listener) => {
    listener();
  });
}

function onBeforeInstallPrompt(event: Event): void {
  // Sin preventDefault, Chrome mostraría su propio aviso; la portada ofrece el botón.
  event.preventDefault();
  if (offered || !isInstallPromptEvent(event)) return;
  deferred = event;
  emit();
}

function onAppInstalled(): void {
  deferred = null;
  offered = true;
  emit();
}

/**
 * Escucha desde el arranque: Chrome puede emitir `beforeinstallprompt` antes de montar la portada.
 * Devuelve la limpieza (las pruebas la usan para reiniciar el estado).
 */
export function listenForInstallPrompt(): () => void {
  window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
  window.addEventListener('appinstalled', onAppInstalled);
  return () => {
    window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.removeEventListener('appinstalled', onAppInstalled);
    deferred = null;
    offered = false;
    emit();
  };
}

/** Abre el cuadro de instalación del navegador. El evento solo sirve una vez: se descarta al tocar. */
export async function promptInstall(): Promise<void> {
  const event = deferred;
  if (!event) return;
  deferred = null;
  offered = true;
  emit();
  await event.prompt();
  await event.userChoice;
}

function isStandalone(): boolean {
  // jsdom y algunos navegadores antiguos no implementan matchMedia.
  return typeof window.matchMedia === 'function'
    ? window.matchMedia('(display-mode: standalone)').matches
    : false;
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
}

/** Verdadero si el navegador ofreció la instalación y la app no corre ya instalada. */
export function useCanInstall(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => deferred !== null && !isStandalone(),
    () => false,
  );
}
