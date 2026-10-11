# Primer prompt para Claude Code

Pasos previos (en tu máquina):

```bash
cd ecoclasifica
git init -b main
git add . && git commit -m "chore: initial scaffold"
git remote add origin <URL-del-repositorio> && git push -u origin main
npm install
cp .env.example .env     # completa DEEPSEEK_API_KEY y SUPABASE_*
claude                   # abre Claude Code en la raíz
```

Pega este prompt en la primera sesión (fase F0):

```text
/status

Vamos a cerrar la fase F0. Objetivo: validar que la IA ve una foto y devuelve JSON válido.

1. Verifica en la documentación oficial de DeepSeek el nombre exacto del modelo con visión,
   si acepta imágenes en Base64 (image_url con data URI) y el formato del mensaje.
   Resume el hallazgo en máximo 8 líneas.
2. Ajusta backend/src/services/ai/deepseek.provider.ts y .env.example según lo encontrado
   (si el modelo no acepta imágenes, propón alternativas sin cambiar la interfaz AiProvider).
3. Con 3 fotos de prueba que te dé, ejecuta: npm run spike:ai -- <foto> classify
   y npm run spike:ai -- <foto> upcycle. Muestra solo el JSON, los tokens y la latencia.
4. Ajusta prompts.ts si el JSON no cumple los esquemas de shared.
5. Ejecuta /phase-check y luego /handoff.

Reglas: no leas docs/ completo; no llames a DeepSeek desde pruebas; mantén la sesión
enfocada en F0. No empieces F1.
```

Siguientes sesiones, una por historia:

```text
/status
/story HU-05
```

Orden recomendado: HU-05 → HU-06 → HU-07 (F1), luego frontend (HU-01 → HU-02 → HU-03), HU-09 → HU-10 → HU-11 (F3) y por último cuentas e historial (F4).
