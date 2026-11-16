# Revisión de las APIs BDC contra el SOW v1.3

- Fuente: «Documentación APIs BDC Vehicentro – Asistente WhatsApp» (11/11/2026) y la colección Postman de esta carpeta.
- Revisado: 2026-11-12 · Fase 0 (Brief v1.3 aprobado).
- Sin datos personales. **El PDF original trae nombres, celulares, correos y cédulas reales en sus ejemplos: no se sube al repo** (regla 5); la colección Postman sí, porque está enmascarada.

## Qué entregó el cliente

| API | Ruta | SOW v1.3 la llamaba | Estado |
|---|---|---|---|
| Token OAuth2 (client credentials, 1 h) | `POST /oauth/token` | Q-1 «POR DEFINIR» | Documentada; faltan credenciales |
| 4.1 Marcas | `GET botwa_marcas` | INT-2 | OK |
| 4.2 Modelos por marca | `GET botwa_modelos/{id_marca}` | INT-3 | OK |
| 4.3 Agencias por marca | `GET botwa_agencias/{id_marca}` | INT-4 | OK |
| 4.4 Asesor asignado por agencia | `GET botwa_asesores/{id_agencia}/{id_marca}` | El SOW decía que INT-5 lo reemplazaba | **Vuelve** y es la que da el asesor |
| 4.5 Existe asesor | `GET botwa_existe_asesor/{id_marca}/{cedula}/{celular}` | INT-1 | OK, pero **exige marca** |
| 5 Ingreso de lead | `POST botwa/{id_conexion}` | INT-6 («registro del origen») | **Es otra cosa**: es el registro del prospecto |

URL base única para pruebas y producción, en el **puerto 9443**.

## Hallazgos (cambian el SOW o el diseño)

| # | Hallazgo | Impacto | Acción |
|---|---|---|---|
| A-01 | **No existe el «servicio de prospectos que devuelve el correo del teleasesor» (INT-5).** El asesor sale de 4.5 (si ya tiene) o de 4.4 (reparto equitativo), ambas con `email_usuario`; el `POST` de lead responde 201 **sin cuerpo**. | Cierra C-01 y Q-3 por cambio de diseño. D-07, RN-08, C-5, Q10 y R6 se redactan de nuevo: primero el asesor (4.5/4.4), después el lead. | Errata del SOW (v1.3.1, sin cambio de alcance) |
| A-02 | **INT-6 no registra el origen de la campaña: es el ingreso de lead.** El body no tiene campos de origen (página, campaña, anuncio). | F-U1/RN-01 solo se puede guardar en Datum y, como texto, en `notas`. El paso P2 al inicio de F1 desaparece. | Confirmar con el cliente si basta con `notas` + Datum, o si el BDC agrega campos. Cierra Q-2 |
| A-03 | **4.5 Existe asesor necesita `id_marca`.** El SOW valida el asesor (P6) **antes** de identificar la marca (P9). | Reordenar F1: marca → existe asesor. Un mismo cliente puede tener asesor en una marca y no en otra. | Ajustar el flujo en la spec (F2) |
| A-04 | **El lead exige `nombres` (obligatorio).** El SOW nunca pide el nombre. | Agregar el paso: nombre del perfil de WhatsApp o preguntarlo. Cuenta como dato personal: después del consentimiento. | Agregar a F2 y a HU-06 |
| A-05 | **El lead exige `celular` en formato `09XXXXXXXX`.** WhatsApp entrega `593…`; con BSUID no hay número. | Normalizar el número; con BSUID, pedirlo (H-02 sigue abierto). | En el adaptador |
| A-06 | **El lead exige `id_modelo` y `notas` (máx. 1000).** | Sin modelo elegido no hay lead: un abandono antes del modelo no se puede registrar. `notas` es un resumen de la conversación: lo arma un nodo de IA (costo) o una plantilla. | RN-08: «abandono antes del modelo = solo Datum». Decidir cómo se arma `notas` |
| A-07 | **Abandono después del modelo y sin agencia:** el lead entra sin `id_asesor` y «lo asigna el BDC». | Resuelve el caso de abandono de D-07: se envía sin asesor y no hay asignación en PMA. | Dejarlo en RN-08 y HU-07 |
| A-08 | **`id_conexion` va por marca** y está en `[COMPLETAR]` para las 4 marcas; pruebas = `TESTCLARO`. | Sin esos ids no se puede salir a producción. | Nuevo insumo del cliente |
| A-09 | **El servidor de pruebas es el de producción.** `id_agencias` e `id_asesor` «no se envían en pruebas, solo en pruebas con el cliente». | La asignación con asesor no se puede probar en la QA interna; solo en la UAT. ¿Llamar a 4.4 en pruebas consume un turno del reparto? | Preguntar al cliente. Riesgo en el plan |
| A-10 | **El documento dice 4 marcas** (KEYTON, LYNK & CO, SINOTRUK AUTOS, SINOTRUK CAMIONETAS); el SOW dice 8. | Cambia la lista de marcas, las personas por marca y el AI Router. | Confirmar si el ejemplo está recortado |
| A-11 | **Los errores llegan con HTTP 200** (`status: "error"`) y `data: []` no es un error. | Los nodos ramifican por `status`, no por el código HTTP; «vacío» es una rama propia (AP-11). | En el adaptador |
| A-12 | **OAuth con token de 1 h, sin refresh token.** | Token en caché con TTL (memoria v2) y renovación ante 401, una vez. Credenciales con `jelou secret`, nunca en el chat. | Adaptador (T002) |
| A-13 | **`json_ficha_tecnica` es un texto con JSON adentro**; `imagenes` y `videos` son URLs separadas por coma. | Parsear y recortar antes de pasarlo al agente (tokens). Enviar la multimedia como mensajes, no como texto. | Tool de catálogo |
| A-14 | **Puerto 9443.** | Verificar que la salida HTTP de Jelou lo alcanza y si el cliente filtra por IP. | Prueba mínima en F5 |
| A-15 | **No hay endpoint de catálogo para Jelou Shop.** El webview de Shop se alimentaría de `botwa_modelos`. | Hay que sincronizar la API con Shop (importar y refrescar) o hacer un webview propio. | Decidir en F3 |
| A-16 | **4.3 devuelve las agencias por marca, no por ciudad.** | El bot filtra por `ciudad_agencia`. Mejor ofrecer las ciudades como lista (regla 11) que pedirlas en texto; la lista de WhatsApp tiene un máximo de 10 filas. | Diseño de Q7–Q9 |
| A-17 | **Faltan datos operativos**: límites de uso, tiempos de respuesta, disponibilidad 24/7 y ventanas de mantenimiento. | Contingencia (RN-09) sin parámetros. | Pedirlos al cliente |

## Lo que queda cerrado

- Q-1: esquema de autenticación y URL (faltan solo las credenciales, que se cargan con `jelou secret`).
- Q-2 y Q-3: sustituidas por A-01 y A-02.
- C-01: se cierra; lo reemplazan A-08 (ids de conexión) y A-09 (pruebas con asesor).

## Preguntas para el cliente

1. ¿Los `id_conexion` de cada marca? (A-08)
2. ¿Son 4 marcas u 8? (A-10)
3. ¿El origen de la campaña va solo en `notas`, o el BDC agrega campos? (A-02)
4. ¿Llamar a 4.4 en pruebas mueve el reparto de leads? ¿Cómo probamos la asignación sin afectar a asesores reales? (A-09)
5. Límites de uso, tiempos de respuesta, disponibilidad y ventanas de mantenimiento. (A-17)
6. ¿Hay filtro por IP? ¿El puerto 9443 está abierto para Jelou? (A-14)
