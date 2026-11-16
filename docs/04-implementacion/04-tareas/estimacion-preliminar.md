# Estimación preliminar en Story Points (aprobada por el Tech Lead, 2026-11-16)

- Fecha: 2026-11-16 (v2) · Base: SOW v1.3 (Brief aprobado el 05/11) + revisión de APIs BDC (`02-apis/revision-apis-bdc.md`).
- Catálogo: `references/story-points.md`. Escalones aplicados uno por cada riesgo que se nombra.
- **Aprobada por el Tech Lead el 2026-11-16.** Los SP se escriben en ClickUp al crear las tareas `T###` en F4.
- v2: el Ecommerce WebView es el **webview que ya existe en Jelou Shop**; no se desarrolla, se usa desde el agente (T008 baja de 8 a 3).

| Tarea | Fila del catálogo | Base | Escalones | SP | Falta | SP a cargar | Horas |
|---|---|---|---|---|---|---|---|
| T001 Preparación: perfil, proyecto, canal de pruebas, s | A · Preparación | 1 | — | 1 | 100 % | **1** | 4 |
| T002 Adaptador BDC: OAuth con token cacheado, status/da | A · Function-adaptador de un tercero nuevo | 5 | — | 5 | 100 % | **5** | 20 |
| T003 Consentimiento: términos y datos, refresco, QA-C01 | A · Consentimiento | 3 | — | 3 | 100 % | **3** | 12 |
| T004 Origen de campaña Meta/TikTok a Datum y notas del  | **sin fila** | 2 | capacidad no verificada (campos de TikTok, Q-9) | 3 | 100 % | **3** | 12 |
| T005 Existe asesor (4.5): celular, BSUID, formato 09…,  | A · Flujo con integración a un tercero conocido | 3 | capacidad no verificada (teléfono con BSUID, H-02) | 5 | 100 % | **5** | 20 |
| T006 AI Routing multimarca: marca, intención, persona p | A · AI Routing | 5 | — | 5 | 100 % | **5** | 20 |
| T007 Agente de catálogo con guardrails (4.2, ficha, com | A · Agente de IA con guardrails | 3 | — | 3 | 100 % | **3** | 12 |
| T008 Usar el webview existente de Jelou Shop desde el agente | A · Flujo con integración a un tercero conocido | 3 | — | 3 | 100 % | **3** | 12 |
| T009 Cotización: cédula, ciudad y agencias (4.3) | A · Flujo con integración a un tercero conocido | 3 | — | 3 | 100 % | **3** | 12 |
| T010 Asesor por agencia (4.4) e ingreso de lead (POST), | A · Flujo con integración a un tercero conocido | 3 | sin ambiente de pruebas (id_asesor solo con el cliente) | 5 | 100 % | **5** | 20 |
| T011 Handoff CONNECT: operador por correo, cola general | A · Handoff | 2 | capacidad no verificada (asignar a operador por correo) | 3 | 100 % | **3** | 12 |
| T012 Recordatorios por abandono (4, ventana 24 h, franj | **sin fila** | 3 | capacidad no verificada (franja sin envíos) | 5 | 100 % | **5** | 20 |
| T013 Agrupación de mensajes y cierre ante interacción n | B · Debounce o anti-ráfaga | 3 | — | 3 | 100 % | **3** | 12 |
| T014 Datum: usuarios, viaje, leads y evidencia de térmi | A · Base Datum y colecciones | 2 | — | 2 | 100 % | **2** | 8 |
| T015 Revisión de costos por nodo y ajuste de modelos | A · Revisión de costos | 2 | — | 2 | 100 % | **2** | 8 |
| QA-01 QA HU-01 Origen | A · QA interna por historia | 2 | — | 2 | 100 % | **2** | 8 |
| QA-02 QA HU-02 Términos | A · QA interna por historia | 2 | — | 2 | 100 % | **2** | 8 |
| QA-03 QA HU-03 Asesor asignado | A · QA interna por historia | 2 | — | 2 | 100 % | **2** | 8 |
| QA-04 QA HU-04 Marca e intención | A · QA interna por historia | 2 | — | 2 | 100 % | **2** | 8 |
| QA-05 QA HU-05 Catálogo | A · QA interna por historia | 2 | — | 2 | 100 % | **2** | 8 |
| QA-06 QA HU-06 Cotización | A · QA interna por historia | 2 | — | 2 | 100 % | **2** | 8 |
| QA-07 QA HU-07 Recordatorios | A · QA interna por historia | 2 | — | 2 | 100 % | **2** | 8 |
| QA-08 QA HU-08 Conversación | A · QA interna por historia | 2 | — | 2 | 100 % | **2** | 8 |
| QA-09 QA HU-09 Contingencia | A · QA interna por historia | 2 | — | 2 | 100 % | **2** | 8 |
| F0-2 Arranque F0 a F2 (lo que falta: spec funcional) | A · Arranque de proyecto | 5 | — | 5 | 50 % | **3** | 12 |
| UAT Ensayo y acompañamiento de la UAT | A · Ensayo y acompañamiento de la UAT | 3 | — | 3 | 100 % | **3** | 12 |
| F7 Auditoría pre-producción | A · Auditoría pre-producción | 3 | — | 3 | 100 % | **3** | 12 |
| F8 Go-live | A · Go-live | 2 | — | 2 | 100 % | **2** | 8 |
| F9 Estabilización | A · Estabilización | 5 | — | 5 | 100 % | **5** | 20 |
| F10 Cierre | A · Cierre | 2 | — | 2 | 100 % | **2** | 8 |

**Total:** 87 SP · 348 h
**Contra el SOW:** 126 h · diferencia +176 % → **avisar antes de construir**
- **sin fila (proponer al catálogo):** T004, T012

## Lectura

- **Construcción (T001–T015): 51 SP · 204 h**, contra 72 h del hito «Construcción» (12 días × 6 h): **+183 %**.
- **Proyecto completo: 87 SP · 348 h**, contra 126 h del cronograma (21 días hábiles × 6 h): **+176 %**. La estabilización (20 h) va fuera del cronograma de desarrollo.
- Con 1 persona y 16 SP por sprint, son ~5,5 sprints contra ~2 sprints del cronograma.
- Lo que más pesa: la QA por historia (18 SP), el adaptador OAuth (5), el router multimarca (5) y los escalones por capacidades sin verificar (BSUID, asignación por correo, franja sin envíos, campos de TikTok, pruebas con asesor).
- Sin fila en el catálogo: T004 (origen de campaña) y T012 (recordatorios con franja). Van a `fricciones` como propuesta.

## Riesgo nuevo por el webview de Shop

- **Dos fuentes de precio:** RN-05 dice que precios y fichas salen de la API del cliente (4.2); el webview muestra lo que tiene cargado Shop. Si no coinciden, el usuario ve dos precios. Confirmar quién mantiene el catálogo de Shop y que use los mismos `id_modelo`.

## Para bajar la diferencia (decide el Tech Lead / PM)

1. Verificar en F3 las capacidades marcadas: cada una confirmada quita su escalón (hasta −5 SP / −40 h).
2. Juntar tareas chicas del mismo flujo (p. ej. T009 + T010) si el Tech Lead lo aprueba.
3. Si el SOW quedó corto, se va al PM y, si cambia el alcance, a F1.
