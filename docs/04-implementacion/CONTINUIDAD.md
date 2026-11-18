# Vehicentro · Dónde quedamos (para continuar el trabajo)

Actualizado: 2026-11-18 · Personas por rol o iniciales (regla 5). El detalle de cada punto está en los archivos enlazados; este documento es el mapa.

## 1. El proyecto en una línea
Bot de WhatsApp para Vehicentro (company **13744** «EC-02-113-01 Vehicentro»), Fase 1: bienvenida y enrutamiento por marca, catálogo (Jelou Shop) y agencias, registro del lead en el BDC del cliente y asignación al teleasesor en PMA. Va por **partner** (Claro).

## 2. Dónde se ve y se prueba
| Qué | Dónde |
|---|---|
| Company | **EC-02-113-01 Vehicentro** (13744). Ojo: el **proyecto de producción se llama igual** que la company y **no se toca hasta F8** |
| Proyecto de construcción | **DEV Vehicentro** (`01KYX1WCS2GBQXT355BK6ZHVMD`) → skills «Bienvenida y Enrutamiento» (default), «Ventas», «Derivar a Asesor» |
| Probar | Por WhatsApp en el canal **DEV Vehicentro** (el número de prueba tiene que estar agregado como tester), o el tester del CLI sobre el borrador |
| Function | `veh-bdc` (Functions de la organización) |
| Datos | Databases v2 `veh-fase1`: `consentimientos`, `usuarios`, `viajes`, `leads` |
| Catálogo | Jelou Shop de la company: 10 productos `VEH-*` |
| CLI | Perfil con la company 13744 (en la máquina de quien retoma: `vehicentro`; antes `dev-vehicentro`). Todo comando con `--profile` |

## 3. Estado actual
- **Fase: F5 (construcción).** Puertas F0–F4 aprobadas el 16/11 (TL D. B.; PM J. C.). F3 reabierta por D-30 (ratifica el TL en la puerta de F5).
- **Hecho:** T001–T008, T014 y T026 (Flujo 1 completo; agente de catálogo; carrusel del Shop y elección de modelo verificados por WhatsApp el 17/11).
- **Siguiente:** T009 (cédula, ciudad, agencia) y T010 (4.4 + lead), T011 (CONNECT real, reemplaza D-29), T013, T012, T027, T015.
- **Repo:** `main` = espejo de DEV + `functions/veh-bdc` + `scripts/shop-catalogo`; `vehicentro-sow-hu` = docs y estado.

## 4. Decisiones vigentes (detalle en `docs/00-cliente/decisiones.md`)
| # | Decisión |
|---|---|
| D-12 | 4 marcas: KEYTON, LYNK & CO, SINOTRUK AUTOS, SINOTRUK CAMIONETAS |
| D-13 | `id_conexion` = TESTCLARO hasta tener los de producción por marca |
| D-14 / D-15 | Origen en `notas` del lead y en Datum; no se pregunta forma de pago ni entrada |
| D-16 | Recordatorios cada 1 h, máximo 4, dentro de 24 h |
| D-17 / D-18 | Horario del contact center lo maneja PMA; retención indefinida (riesgo LOPDP, para el TL) |
| D-25 | Un solo asistente para las 4 marcas |
| **D-28** | Asesor por **4.4 antes del lead**; `id_agencias`/`id_asesor` solo en producción. Reemplaza D-23 y D-26 |
| D-29 | «Derivar a Asesor» provisional (mensaje fijo) hasta V-03; **bloquea la puerta de F5** |
| **D-30** | Catálogo en **Jelou Shop** cargado desde 4.2 y carrusel del Shop (MCP). Reemplaza D-27 |

## 5. Pendientes y riesgos abiertos
| Id | Qué | Quién |
|---|---|---|
| H-01 | Consentimiento implícito del SOW vs. botones construidos (regla 17); bloquea F6 | TL con el cliente |
| H-08 | Menú de intención armado por la IA (no determinista) | TL |
| C-05 | Links de términos y política + versión (hoy provisionales) | Cliente |
| C-06 / V-03 | Teleasesores en PMA con el correo del BDC; operador de prueba para el CONNECT | Cliente / implementador |
| A-09 | Cómo probar 4.4 sin mover el reparto real de leads | Cliente |
| C-02 | `id_conexion` de producción por marca (antes de F8) | Cliente |
| V-06 | Origen desde un anuncio real de Meta; TikTok sin documentación | Cliente / implementador |
| V-08 | Carrusel de KEYTON (1 tarjeta) | Implementador |
| — | Forma de promover DEV → producción (F8) sin definir | TL |
| — | El avance del 17/11 al TL anunciaba D-27 (ya revertida por D-30) | Avisar al TL |
| — | Esfuerzo 90 SP / 360 h contra 126 h del cronograma; go-live del 08/12 en riesgo | PM |

## 6. Dónde está cada cosa
| Archivo | Para qué |
|---|---|
| `.jelou-impl/estado.json` | Estado completo: fase, hallazgos, insumos, decisiones, puntos, historial |
| `docs/00-cliente/decisiones.md` | Decisiones D-01..D-30 |
| `docs/04-implementacion/00-prekickoff/BRIEF.md` | Brief de trabajo v1.3 |
| `docs/04-implementacion/01-sow/` | `sow.json` v1.3 (anonimizado) + paquete v1.3 |
| `docs/04-implementacion/02-apis/` | Revisión de las APIs + colección Postman |
| `docs/04-implementacion/02-spec/spec.md` | Spec funcional v0.4 |
| `docs/04-implementacion/03-plan/plan.md` | Plan técnico v0.2 |
| `docs/04-implementacion/04-tareas/tareas.md` | Tareas T001–T027 con SP y espejo de ClickUp |
| `docs/04-implementacion/05-construccion/construccion.md` | Diseño de construcción, pruebas y bitácora |
| `docs/04-implementacion/06-qa/matriz.md` | Matriz de QA (72 criterios) |

## 7. Cómo retomar
- Login: `! jelou login --profile vehicentro` (company 13744) y `jelou update` (se trabaja con 4.29.0).
- `main` en un worktree aparte para el bot; esta rama para los docs.
- Cerrar cada sesión con el barrido de datos personales y push a `vehicentro-sow-hu`.
