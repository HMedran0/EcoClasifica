import { ServiceStatus } from './ServiceStatus';

export function HomePage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 px-6 text-center">
      <img src="/brand/logo.svg" alt="" width={160} height={160} className="size-40" />
      <h1 className="text-4xl font-extrabold tracking-tight">
        <span className="text-hoja">Eco</span>
        <span className="text-petroleo">Clasifica</span>
      </h1>
      <p className="max-w-xs text-base text-bosque">
        Clasifica tus residuos con IA y dales una segunda vida.
      </p>
      <ServiceStatus />
    </main>
  );
}
