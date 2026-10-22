// Ninguna prueba debe tocar servicios reales aunque `.env` los tenga: vacías cuentan como no
// definidas (`definedVars`) y `loadEnvFile` no sobrescribe variables ya presentes.
for (const key of ['DEEPSEEK_API_KEY', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']) {
  process.env[key] = '';
}
