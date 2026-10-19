-- 0002 — Instrucciones de disposal_rules válidas para cualquier objeto del material
-- (antes asumían un envase: «Vacíalo, aplástalo y ponle la tapa» no aplica a una bolsa).
-- Cada update filtra por el texto anterior de la semilla: no pisa instrucciones
-- personalizadas de un municipio y la migración es repetible.

update disposal_rules
set instructions = 'Limpio y seco. Si es un envase, vacíalo y aplástalo.'
where material_code = 'plastico' and instructions = 'Vacíalo, aplástalo y ponle la tapa.';

update disposal_rules
set instructions = 'Limpio y seco. Si es una caja, aplánala.'
where material_code = 'carton' and instructions = 'Aplana la caja y mantenla seca.';

update disposal_rules
set instructions = 'Limpio y seco. Si está roto, envuélvelo en papel.'
where material_code = 'vidrio' and instructions = 'Enjuágalo; si está roto, envuélvelo en papel.';

update disposal_rules
set instructions = 'Limpio y seco. Si es una lata de alimento, aplástala; los aerosoles no se aplastan.'
where material_code = 'metal' and instructions = 'Enjuaga y aplasta las latas.';

update disposal_rules
set instructions = 'Sin bolsas plásticas ni empaques.'
where material_code = 'organico' and instructions = 'Sin bolsas plásticas.';

update disposal_rules
set instructions = 'Llévalo a un punto de acopio de residuos electrónicos.'
where material_code = 'electronico' and instructions = 'Lleva el aparato a un punto de acopio de residuos electrónicos.';

update disposal_rules
set instructions = 'Llévalo a un punto de acopio de residuos peligrosos.'
where material_code = 'peligroso' and instructions = 'Pilas, aceites, medicamentos y bombillas van a un punto de acopio.';

update disposal_rules
set instructions = 'Bien cerrado en bolsa. Aquí van pañales, toallas higiénicas, papel higiénico usado y residuos sucios.'
where material_code = 'mixto' and instructions = 'Si no puedes separarlo, va a no aprovechables.';

-- Verificación
select material_code, municipality_code, instructions
from disposal_rules
order by material_code, municipality_code;
