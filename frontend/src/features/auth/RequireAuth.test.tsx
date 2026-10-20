import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeSession } from '../../test/supabaseMock';
import { useAuthStore } from './authStore';
import { RequireAuth } from './RequireAuth';

vi.mock('../../lib/supabase', async () => ({
  supabase: (await import('../../test/supabaseMock')).fakeSupabase,
}));

function LoginStub() {
  const { search } = useLocation();
  return <p data-testid="entrar">{new URLSearchParams(search).get('volver')}</p>;
}

function renderAt(entry: string) {
  render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/entrar" element={<LoginStub />} />
        <Route
          path="/historial"
          element={
            <RequireAuth>
              <h1>Mi historial</h1>
            </RequireAuth>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => useAuthStore.setState({ session: null, ready: true }));

describe('RequireAuth', () => {
  it('sin sesión lleva a /entrar con la ruta original (incluida la consulta)', () => {
    renderAt('/historial?pagina=2');
    expect(screen.getByTestId('entrar')).toHaveTextContent('/historial?pagina=2');
    expect(screen.queryByText('Mi historial')).not.toBeInTheDocument();
  });

  it('con sesión muestra el contenido', () => {
    useAuthStore.setState({ session: fakeSession(), ready: true });
    renderAt('/historial');
    expect(screen.getByRole('heading', { name: 'Mi historial' })).toBeInTheDocument();
  });

  it('mientras carga la sesión no redirige', () => {
    useAuthStore.setState({ session: null, ready: false });
    renderAt('/historial');
    expect(screen.getByRole('status')).toHaveTextContent('Cargando tu sesión');
    expect(screen.queryByTestId('entrar')).not.toBeInTheDocument();
  });
});
