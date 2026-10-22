import { Link } from 'react-router';
import { PRIVACY_PATH } from './paths';

interface Props {
  checked: boolean;
  onChange: (checked: boolean) => void;
}

/** HU-21: autorización previa, expresa e informada. Empieza sin marcar; la decide el usuario. */
export function ConsentCheckbox({ checked, onChange }: Props) {
  return (
    <div className="flex items-start gap-3">
      <input
        id="privacy-consent"
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-1 size-6 shrink-0 accent-bosque"
      />
      <label htmlFor="privacy-consent" className="text-base text-petroleo">
        Autorizo el tratamiento de mis datos según la{' '}
        {/* Pestaña nueva: así no se pierde lo escrito en el formulario. */}
        <Link
          to={PRIVACY_PATH}
          target="_blank"
          rel="noopener"
          className="font-semibold text-bosque underline"
        >
          Política de privacidad
        </Link>
      </label>
    </div>
  );
}
