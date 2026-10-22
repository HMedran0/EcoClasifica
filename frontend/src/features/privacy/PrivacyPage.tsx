import { PRIVACY_DATE, PRIVACY_VERSION } from '@ecoclasifica/shared';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router';

// HU-21: Ley 1581 de 2012 y Decreto 1377 de 2013 (compilado en el Decreto 1074 de 2015).
// El texto lo revisa el director o tutor del proyecto antes del piloto.
const OWNER = 'cipa 0';
const CONTACT = 'cipa0@hotmail.com';
const PHONE = '3218050211';
const CITY = 'San Juan Nepomuceno';

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-xl font-bold text-petroleo">{title}</h2>
      {children}
    </section>
  );
}

const LIST = 'list-disc space-y-1 pl-6';

export function PrivacyPage() {
  const navigate = useNavigate();
  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col gap-5 px-6 py-6 text-base text-bosque">
      <button
        type="button"
        // Se vuelve a donde estaba (portada, /entrar, /autorizacion o la cámara); si se abrió
        // directamente, a la portada.
        onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/'))}
        className="min-h-tactil self-start py-3 text-base font-semibold text-petroleo"
      >
        ← Volver
      </button>
      <h1 className="text-3xl font-extrabold text-petroleo">Política de privacidad</h1>
      <p className="text-sm">
        Versión {PRIVACY_VERSION} · vigente desde el {PRIVACY_DATE}
      </p>
      <p>
        EcoClasifica te ayuda a clasificar residuos y a darles una segunda vida con inteligencia
        artificial (IA). Aquí te contamos qué datos tratamos, para qué y cómo ejercer tus derechos,
        según la Ley 1581 de 2012 y el Decreto 1377 de 2013 (compilado en el Decreto 1074 de 2015).
      </p>

      <Section title="Responsable del tratamiento">
        <p>
          {OWNER}, con domicilio en {CITY}, Colombia. Correo: {CONTACT}. Teléfono: {PHONE}.
        </p>
      </Section>

      <Section title="Qué datos tratamos">
        <ul className={LIST}>
          <li>Tu correo electrónico y, si entras con Google, tu nombre de Google.</li>
          <li>Las fotos de los residuos que escaneas con tu cuenta.</li>
          <li>Los resultados de cada escaneo y las ideas de segunda vida.</li>
          <li>Tus ideas favoritas y los mensajes del chat sobre cada idea.</li>
          <li>
            Un registro de uso de la IA (fecha, tipo de consulta y cantidad usada). Sin sesión, en
            lugar de tu IP guardamos una huella cifrada con HMAC que no permite recuperarla.
          </li>
        </ul>
        <p>
          <strong>Sin sesión</strong>, la foto se envía al servicio de IA para analizarla y no se
          guarda.
        </p>
        <p>
          <strong>No fotografíes personas</strong>: apunta la cámara solo al residuo.
        </p>
      </Section>

      <Section title="Para qué los usamos">
        <ul className={LIST}>
          <li>Clasificar tus residuos y proponerte ideas para reutilizarlos.</li>
          <li>Guardar tu historial, tus favoritos y tus conversaciones para que los retomes.</li>
          <li>Controlar los costos del servicio y evitar abusos (límites diarios de uso).</li>
        </ul>
      </Section>

      <Section title="Quién más trata tus datos (encargados)">
        <p>
          Para funcionar usamos proveedores que tratan los datos por cuenta nuestra. Algunos están
          fuera de Colombia, por lo que hay <strong>transferencia internacional</strong> de datos:
        </p>
        <ul className={LIST}>
          <li>Supabase: base de datos, cuentas y almacenamiento de fotos.</li>
          <li>Railway: servidor de la aplicación.</li>
          <li>Vercel: alojamiento de la página web.</li>
          <li>
            DeepSeek, en China: recibe las fotos y los mensajes del chat para procesarlos con IA.
          </li>
        </ul>
      </Section>

      <Section title="Cuánto tiempo los conservamos">
        <p>
          Tus datos se conservan hasta que los borres. El registro de uso de la IA se borra a los 90
          días.
        </p>
      </Section>

      <Section title="Tus derechos">
        <p>
          Como titular puedes conocer, actualizar, rectificar y suprimir tus datos, y revocar esta
          autorización.
        </p>
        <ul className={LIST}>
          <li>
            Borrar tu historial y tu cuenta es inmediato desde la aplicación, sin pedirlo a nadie.
          </li>
          <li>
            Para lo demás escríbenos a {CONTACT} o llámanos al {PHONE}. Respondemos las consultas en
            un máximo de 10 días hábiles y los reclamos en un máximo de 15 días hábiles.
          </li>
        </ul>
      </Section>

      <Section title="Menores de edad">
        <p>
          Si eres menor de 18 años, solo puedes crear una cuenta con la autorización de tus padres o
          representantes legales.
        </p>
      </Section>

      <Section title="Cambios en esta política">
        <p>
          Si cambiamos esta política, publicaremos una versión nueva y te pediremos de nuevo tu
          autorización al iniciar sesión.
        </p>
      </Section>
    </main>
  );
}
