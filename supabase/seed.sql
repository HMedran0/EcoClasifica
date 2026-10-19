-- EcoClasifica — semilla de materiales y reglas de disposición.
-- Supuesto: sistema de tres contenedores de Colombia (blanco = aprovechables,
-- negro = no aprovechables, verde = orgánicos aprovechables).
-- VERIFICAR con la normativa de San Juan Nepomuceno antes de fijar la semilla definitiva.

insert into materials (code, name_es, icon) values
  ('plastico',    'Plástico',    'plastic'),
  ('papel',       'Papel',       'paper'),
  ('carton',      'Cartón',      'cardboard'),
  ('vidrio',      'Vidrio',      'glass'),
  ('metal',       'Metal',       'metal'),
  ('organico',    'Orgánico',    'organic'),
  ('textil',      'Textil',      'textile'),
  ('electronico', 'Electrónico', 'electronic'),
  ('peligroso',   'Peligroso',   'hazard'),
  ('madera',      'Madera',      'wood'),
  ('mixto',       'Mixto',       'mixed'),
  ('otro',        'Otro',        'other')
on conflict (code) do nothing;

-- Reglas por defecto
insert into disposal_rules
  (material_code, municipality_code, bin_code, bin_name, color_hex, icon, instructions, requires_drop_off)
values
  ('plastico',    'DEFAULT', 'WHITE',    'Contenedor blanco (aprovechables)',   '#F5F5F5', 'bin-white',  'Limpio y seco. Si es un envase, vacíalo y aplástalo.', false),
  ('papel',       'DEFAULT', 'WHITE',    'Contenedor blanco (aprovechables)',   '#F5F5F5', 'bin-white',  'Que esté seco y sin restos de comida.', false),
  ('carton',      'DEFAULT', 'WHITE',    'Contenedor blanco (aprovechables)',   '#F5F5F5', 'bin-white',  'Limpio y seco. Si es una caja, aplánala.', false),
  ('vidrio',      'DEFAULT', 'WHITE',    'Contenedor blanco (aprovechables)',   '#F5F5F5', 'bin-white',  'Limpio y seco. Si está roto, envuélvelo en papel.', false),
  ('metal',       'DEFAULT', 'WHITE',    'Contenedor blanco (aprovechables)',   '#F5F5F5', 'bin-white',  'Limpio y seco. Si es una lata de alimento, aplástala; los aerosoles no se aplastan.', false),
  ('organico',    'DEFAULT', 'GREEN',    'Contenedor verde (orgánicos)',        '#2E7D32', 'bin-green',  'Sin bolsas plásticas ni empaques.', false),
  ('textil',      'DEFAULT', 'WHITE',    'Contenedor blanco (aprovechables)',   '#F5F5F5', 'bin-white',  'Solo si está limpio y seco; considera donarlo o reutilizarlo.', false),
  ('madera',      'DEFAULT', 'BULKY',    'Recolección de voluminosos',          '#6D4C41', 'bulky',      'No va al contenedor doméstico; solicita la recolección de voluminosos.', false),
  ('electronico', 'DEFAULT', 'DROP_OFF', 'Punto limpio',                        '#F9A825', 'drop-off',   'Llévalo a un punto de acopio de residuos electrónicos.', true),
  ('peligroso',   'DEFAULT', 'DROP_OFF', 'Punto limpio',                        '#F9A825', 'drop-off',   'Llévalo a un punto de acopio de residuos peligrosos.', true),
  ('mixto',       'DEFAULT', 'BLACK',    'Contenedor negro (no aprovechables)', '#212121', 'bin-black',  'Bien cerrado en bolsa. Aquí van pañales, toallas higiénicas, papel higiénico usado y residuos sucios.', false),
  ('otro',        'DEFAULT', 'BLACK',    'Contenedor negro (no aprovechables)', '#212121', 'bin-black',  'Si no puedes separarlo, va a no aprovechables.', false)
on conflict (material_code, municipality_code) do nothing;

-- San Juan Nepomuceno (Bolívar). Código DANE 13657: VERIFICAR.
-- Copia las reglas por defecto; editar aquí cuando se confirme la normativa local.
insert into disposal_rules
  (material_code, municipality_code, bin_code, bin_name, color_hex, icon, instructions, requires_drop_off)
select material_code, '13657', bin_code, bin_name, color_hex, icon, instructions, requires_drop_off
from disposal_rules
where municipality_code = 'DEFAULT'
on conflict (material_code, municipality_code) do nothing;
