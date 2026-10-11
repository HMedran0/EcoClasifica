# Modelo de datos

SQL completo en `supabase/migrations/0001_init.sql` (no modificar; cambios = migraciones nuevas numeradas). Semilla de reglas en `supabase/seed.sql`.

## Relaciones

```text
auth.users 1─1 profiles
profiles   1─N scans ─ N─1 materials
scans      1─N scan_ideas            (solo modo upcycle; exactamente 3)
profiles   1─N favorites ─ N─1 scan_ideas (opcional, con copia/snapshot)
scan_ideas 1─N chat_messages ─ N─1 profiles
materials  1─N disposal_rules        (por municipio; 'DEFAULT' como respaldo)
ai_usage   → profiles, scans         (solo lo usa el backend)
```

## Decisiones

- **Favoritos con copia:** `favorites` guarda un snapshot de la idea y `idea_id` es opcional (`ON DELETE SET NULL`). Borrar el historial no borra favoritos.
- **Tres ideas fijas:** `UNIQUE (scan_id, idea_index)` e `idea_index` entre 0 y 2.
- **Reglas en datos:** `disposal_rules` permite regla `DEFAULT` y reglas por municipio sin redesplegar.
- **Solo usuarios autenticados guardan:** los escaneos anónimos no llegan a `scans`.
- **Chat ligado a la idea:** `chat_messages` se borra con la idea.

## Reglas de disposición (semilla)

Supuesto: sistema de tres contenedores de Colombia (blanco = aprovechables, negro = no aprovechables, verde = orgánicos aprovechables). **Validar con la normativa de San Juan Nepomuceno** antes de fijar la semilla definitiva.

| Material                               | Destino                                 | `bin_code`                              |
| -------------------------------------- | --------------------------------------- | --------------------------------------- |
| plastico, papel, carton, vidrio, metal | Contenedor blanco                       | `WHITE`                                 |
| textil                                 | Contenedor blanco si está limpio y seco | `WHITE`                                 |
| organico                               | Contenedor verde                        | `GREEN`                                 |
| madera                                 | Recolección de voluminosos              | `BULKY`                                 |
| electronico, peligroso                 | Punto limpio                            | `DROP_OFF` (`requires_drop_off` = true) |
| mixto, otro                            | Contenedor negro                        | `BLACK`                                 |

Resolución de reglas: buscar `(material, municipio)`; si no existe, `(material, 'DEFAULT')`; si tampoco, `BLACK` y advertencia en el log. Un material fuera del catálogo se trata como `otro`.

## Índices

`scans (user_id, created_at desc)` · `scan_ideas (scan_id)` · `favorites (user_id, created_at desc)` · `chat_messages (idea_id, created_at)` · `ai_usage (user_id, created_at)`.

## Seguridad (RLS)

- RLS activo en todas las tablas. `profiles`, `scans`, `favorites`, `chat_messages`: política `user_id = auth.uid()` (`id = auth.uid()` en `profiles`); `scan_ideas` hereda del escaneo dueño.
- `materials` y `disposal_rules`: lectura pública; escribe solo el rol de servicio.
- `ai_usage`: sin políticas; solo el backend.
- **El backend usa la service role key, que salta RLS.** Cada consulta debe filtrar por `req.user.id` y esto se prueba con pruebas de integración (un usuario no lee ni borra datos de otro).
- Storage: bucket privado `scan-images`, rutas `<user_id>/<scan_id>.jpg`, política solo sobre la carpeta propia.
