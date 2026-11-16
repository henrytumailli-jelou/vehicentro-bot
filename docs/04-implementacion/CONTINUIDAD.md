# Vehicentro · Dónde quedamos (para continuar el trabajo)

Actualizado: 2026-11-16 · Sesiones del 04/11 al 16/11/2026 con `/jelou-impl` (skill `jelou-implementaciones`).
Personas por rol o iniciales (regla 5). El detalle de cada punto está en los archivos enlazados; este documento es el mapa.

## 1. El proyecto en una línea
Bot de WhatsApp para Vehicentro (company **13744**, perfil CLI `dev-vehicentro`), Fase 1: bienvenida y enrutamiento por marca, catálogo y agencias, registro del lead en el BDC del cliente y asignación al teleasesor en PMA. Va por **partner** (Claro).

## 2. Estado actual
- **Fase:** **F1 (SOW)**. La puerta de F0 la aprobó el Tech Lead (D. B.) el 16/11. F1 está prácticamente cumplida: el Brief v1.3 ya está aprobado.
- **Brief/SOW v1.3 aprobado por el cliente:** correo de A. F. del 05/11/2026. **No se emite una versión nueva**: las aclaraciones van en `docs/00-cliente/decisiones.md` y se resuelven en la spec funcional (F2).
- **Brain:** se construye en **DEV Vehicentro** (`01KYX1WCS2GBQXT355BK6ZHVMD`) y después se **promueve a producción EC-02-113-01 Vehicentro** (`01KYQZ99V5PPM2JSMQF4EMH55X`). DEV ya tiene skills con la forma de la Fase 1 (Bienvenida y Enrutamiento, Ventas, Repuestos, Talleres, Derivar a Asesor; también Crédito Directo, que está fuera de alcance).
- **Repo:** `henrytumailli-jelou/vehicentro-bot` (privado). `main` para el bot; `vehicentro-sow-hu` para los docs y el estado.
- **ClickUp:** madre `86e2aact9` (Ai Solution); subtareas F0–F10 creadas. F0 está en curso y el resto en «to do».

## 3. Qué falta para pasar la puerta de F1
1. **Aviso de arranque en #team-deployment** (quedó pendiente de F0; lo hace el implementador).
2. **PM:** que vea la diferencia de esfuerzo (348 h estimadas contra 126 h del cronograma) y ajuste el cronograma.
3. Aprobación de la puerta de F1 (PM). Después, F2 · Spec funcional.

## 4. Decisiones clave (detalle en `docs/00-cliente/decisiones.md`)
| # | Decisión |
|---|---|
| D-07 / D-23 | **Registro del lead y asignación:** primero se consulta 4.5 Existe asesor; si no tiene asesor, se hace el **POST del lead** sin `id_asesor` (lo asigna el BDC) y **se vuelve a consultar 4.5**, que devuelve el asesor con su correo para asignar en PMA. 4.4 queda como respaldo |
| D-24 | D-07 **no necesita aprobación de Comercial** (partner + Brief aprobado) |
| D-12 | **4 marcas** (KEYTON, LYNK & CO, SINOTRUK AUTOS, SINOTRUK CAMIONETAS), verificado con la API |
| D-13 | `id_conexion` = **TESTCLARO** por ahora; los de producción por marca, antes del go-live |
| D-14 | Origen de la campaña **como texto en `notas`** del lead (y en Datum) |
| D-15 | El bot **no pregunta** forma de pago ni entrada |
| D-16 | Recordatorios **cada 1 hora**, máximo 4, dentro de 24 h |
| D-17 | Los horarios del contact center los evalúa el nodo de atención humana, no el bot |
| D-18 | Retención en Datum **indefinida** |
| D-19 / D-20 | APIs 24/7; credenciales OAuth ya entregadas por el cliente |
| D-22 | El Ecommerce WebView es el **webview que ya existe en Jelou Shop**; no se desarrolla |

## 5. APIs del cliente (BDC)
- Revisión completa: `docs/04-implementacion/02-apis/revision-apis-bdc.md` (hallazgos A-01 a A-17). Colección Postman en la misma carpeta (enmascarada).
- OAuth2 client credentials (token de 1 h, sin refresh token); errores con HTTP 200 + `status: "error"`; `data: []` no es un error.
- El lead exige `nombres`, `celular` (`09XXXXXXXX`), `id_modelo` y `notas`; responde 201 sin cuerpo.
- `json_ficha_tecnica` es un texto con JSON adentro; imágenes y videos son URLs separadas por coma.
- Pruebas y producción comparten servidor.

## 6. Pendientes y riesgos abiertos
| Id | Qué | Quién |
|---|---|---|
| H-01 | Consentimiento implícito, sin botones (decisión del cliente) **choca con la regla 17**; bloquea F6. Falta el DM al Tech Lead | Tech Lead |
| H-02 | Con BSUID no hay celular: hay que pedirlo (lo exigen 4.5 y el lead) | Spec F2 |
| V-01 | **Verificar en F5:** que el BDC asigna asesor al recibir el POST (con TESTCLARO) y que 4.5 lo devuelve de inmediato | Implementador |
| C-02 | `id_conexion` de producción por marca | Cliente |
| C-03 | Cargar las credenciales OAuth como secreto en la plataforma (hoy la organización no tiene secretos). **Nunca por chat ni en el repo** | Implementador (`! jelou secret set …`) |
| — | Franja nocturna sin recordatorios: no está definida; la spec propondrá una por defecto (p. ej. 21:00–08:00) | Spec F2 |
| — | Retención indefinida: riesgo frente a la LOPDP, anotado para el Tech Lead | Tech Lead |
| — | Webview de Shop: confirmar que su catálogo y precios coinciden con la API 4.2 (RN-05) | Implementador / cliente |
| — | Probar la asignación con asesor sin mover el reparto real de leads | Cliente |

## 7. Esfuerzo
- Estimación preliminar: **87 SP · 348 h** contra **126 h** del cronograma (+176 %); la construcción sola da 204 h contra 72 h. Detalle y motivos en `docs/04-implementacion/04-tareas/estimacion-preliminar.md`.
- **Aprobada por el Tech Lead (2026-11-16).** Se escribe en ClickUp al crear las T### en F4. El PM debe ver la diferencia contra el cronograma antes de construir.

## 8. Próximos pasos sugeridos
1. Cerrar la puerta de F0 (sección 3) y la de F1 (Brief aprobado + el PM revisa el esfuerzo).
2. **F2 · Spec funcional** sobre el Brief v1.3 + D-12..D-24: reordenar F1 (marca → asesor), flujo del lead (D-23), abandono (antes del modelo = solo Datum; después = lead sin asesor), nombre del perfil de WhatsApp, BSUID, franja nocturna.
3. F3 · Plan técnico en DEV Vehicentro: adaptador BDC (token en caché con TTL), tools del agente, uso del webview de Shop y prueba V-01.

## 9. Dónde está cada cosa
| Archivo | Para qué |
|---|---|
| `.jelou-impl/estado.json` | Estado completo: fase, hallazgos, insumos, decisiones, brains, puntos, historial |
| `docs/00-cliente/decisiones.md` | Todas las decisiones del cliente (D-01..D-24) |
| `docs/04-implementacion/00-prekickoff/BRIEF.md` | Brief de trabajo v1.3 |
| `docs/04-implementacion/01-sow/` | `sow.json` v1.3 (anonimizado en el repo) + paquete v1.3 (simulador, diagramas, lint) |
| `docs/04-implementacion/02-apis/` | Revisión de las APIs + colección Postman |
| `docs/04-implementacion/04-tareas/estimacion-preliminar.md` | Story Points |
| **Fuera del repo** | Brief v1.3 `.docx`/`.pdf` y cronograma `.xlsx`/`.pdf`: en la carpeta local del implementador (`Implementaciones/Vehicentro spec/docs/04-implementacion/01-sow/v1.3/`). Pedírselos a HT si hacen falta |

## 10. Cómo retomar
- `/jelou-impl estado` en el clon del repo (rama `vehicentro-sow-hu`) muestra la fase y los bloqueos.
- Todo comando de Jelou va con `--profile dev-vehicentro`.
- Cerrar cada sesión con `sync` (barrido de datos personales y push a `vehicentro-sow-hu`).
