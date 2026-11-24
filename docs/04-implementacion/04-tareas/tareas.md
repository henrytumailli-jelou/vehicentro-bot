# Tareas — Vehicentro · Fase 1

Archivo: `docs/04-implementacion/04-tareas/tareas.md` · Fase 4 · 2026-11-16
Entradas: `02-spec/spec.md` v0.2, `03-plan/plan.md` v0.1 · ClickUp: madre [86e2aact9](https://app.clickup.com/t/86e2aact9) · construcción bajo F5 `1dfg0rkjr62` · QA bajo F6 `1dfg0rkjr63`

Formato: `[ID] [P?] [HU?] [SP:n] Descripción — dónde`. `[C]` = insumo del cliente (ruta crítica, sin SP). Proyecto: `projects/dev-vehicentro/` (brain DEV Vehicentro).

## Fase 1 — Preparación
- [x] T001 [SP:1] Pull de DEV, snapshot del draft, testers en el canal DEV; commit del espejo en `main` después de corregir H-05 — `projects/dev-vehicentro/`
- [ ] [C] Links de términos y política de datos + versión — insumo de HU-02
- [ ] [C] `id_conexion` de producción por marca — antes de F8 (TESTCLARO mientras tanto)
- [ ] [C] Teleasesores como operadores de PMA con el correo del BDC — antes de la UAT

## Fase 2 — Base (bloquea a las historias)
- [x] T014 [P] [SP:2] Datum `veh-fase1`: consentimientos, usuarios, viajes, leads
- [x] T002 [P] [SP:5] Function `veh-bdc`: OAuth en caché, clasificación `ok|vacio|negocio|indisponible|incierto`, rutas 4.1–4.5 y `/lead` con huella celular+marca; secretos `BDC_CLIENT_ID`/`BDC_CLIENT_SECRET` (los carga una persona); V-02 — `functions/veh-bdc`
- [ ] T011 [HU-06][HU-09] [SP:3] «Derivar a Asesor»: `CONNECT` al operador por correo, cola general, 4 salidas, contexto, contingencia; V-03 — `projects/dev-vehicentro/workflows/derivar-a-asesor.whatsapp.json`
- [x] T003 [HU-02] [SP:3] Consentimiento P0 (Acepto / No acepto), registro y refresco 30 días — `projects/dev-vehicentro/workflows/bienvenida-y-enrutamiento.whatsapp.json` (H-01 pendiente)

**Punto de control:** `veh-bdc` responde con token; Datum listo; el handoff asigna a un operador de prueba.

## Fase 3 — Flujo_1 (P1/P2)
- [x] T006 [HU-04] [SP:5] Agente de bienvenida: marca e intención, lista de 4 marcas, Repuestos/Talleres/crédito → PMA, sin rutas a Repuestos, Talleres ni Crédito Directo, guardrails, un solo asistente (D-25) — `bienvenida-y-enrutamiento.whatsapp.json` + tool «Consultar marcas»
- [x] T005 [HU-03] [SP:5] Celular con BSUID (09…, 1 reintento) y 4.5 después de la marca; **corrige H-05** — `bienvenida-y-enrutamiento.whatsapp.json` + tool «Verificar cliente Vehicentro»
- [x] T004 [P] [HU-01] [SP:3] Origen de la campaña a Datum y a `notas`; V-06 — `bienvenida-y-enrutamiento.whatsapp.json` + tool «Verificador Campañas»

## Fase 4 — Flujo_2 (P1) 🎯 MVP
- [x] T007 [HU-05] [SP:3] Agente de catálogo con guardrails, comparación y cambio de marca — `projects/dev-vehicentro/workflows/ventas.whatsapp.json` + tool «Consultar modelos»
- [x] T008 [P] [HU-05] [SP:3] Catálogo visual en el chat (primero carrusel propio D-27, reemplazado por T026) — tool «Enviar carrusel modelos» (8425, se retira al cerrar F5)
- [x] T026 [HU-05] [SP:3] **(nueva, D-30)** Catálogo del BDC cargado en Jelou Shop (`scripts/shop-catalogo/`) y carrusel del Shop en Ventas (`search_and_send_products_webview`, MCP); aviso `SUCCESS` del Shop → cotizar (H-07). Falta: KEYTON con 1 tarjeta (V-08)
- [ ] T027 [P] [HU-05] [SP:3] **(nueva, D-30)** Function de sincronización BDC → Shop con cron diario (D-35) (upsert por SKU, mismas reglas del script) — `functions/veh-shop-sync`
- [ ] T009 [HU-06] [SP:3] Cédula, celular si falta, ciudades y agencias (listas paginadas) — `ventas.whatsapp.json`
- [ ] T010 [HU-06] [SP:5] Asesor por 4.4 + lead (POST; `id_agencias`/`id_asesor` solo en producción) + Datum `leads` + idempotencia celular+marca + resultado incierto (4.5) (D-28) — `ventas.whatsapp.json` + `veh-bdc /lead`

## Fase 5 — Transversal (P2/P3)
- [ ] T013 [P] [HU-08] [SP:3] Agrupación de 2 s y cierre ante interacción negativa; V-05 — configuración del bot + prompts
- [ ] T012 [HU-07] [SP:5] Recordatorios: 1 h, máximo 4, 24 h, franja 21:00–07:59, lead no gestionado; V-04 — recordatorio nativo o Function con cron

## Fase final — Pulido
- [ ] T015 [P] [SP:2] Revisión de costos por nodo (`jelou-cost-workflows`)

## QA y UAT (bajo F6)
- [ ] T016–T024 [SP:2 c/u] QA por historia: HU-02, HU-01, HU-03, HU-04, HU-05, HU-06, HU-07, HU-08, HU-09 → `06-qa/matriz.md`
- [ ] T025 [SP:3] Ensayo y acompañamiento de la UAT

## Dependencias y carriles
- Preparación → Base (T014, T002 en paralelo; luego T011 y T003) → Flujo_1 → Flujo_2 → Transversal → Pulido → QA.
- Carril A (Function y datos): T014, T002. Carril B (workflows): T011, T003, T006, T005, T004, T007, T008, T009, T010, T013, T012. Un solo implementador: los carriles ordenan, no paralelizan personas.
- **Ruta crítica:** cargar los secretos OAuth (paso humano, antes de T002) · links de términos (T003) · V-01 (T010) · teleasesores en PMA (UAT) · `id_conexion` de producción (F8).

## Story Points
| Bloque | SP | Horas |
|---|---|---|
| Preparación (T001) | 1 | 4 |
| Base (T014, T002, T011, T003) | 13 | 52 |
| Flujo_1 (T006, T005, T004) | 13 | 52 |
| Flujo_2 (T007, T008, T009, T010) | 14 | 56 |
| Catálogo en Shop (T026, T027 — D-30, **agregadas el 18/11, por aprobar TL**) | 6 | 24 |
| Transversal (T013, T012) | 8 | 32 |
| Pulido (T015) | 2 | 8 |
| **Construcción** | **57** | **228** |
| QA por historia (T016–T024) | 18 | 72 |
| UAT (T025) | 3 | 12 |
| F7 Auditoría · F8 Go-live · F10 Cierre (en sus subtareas) | 7 | 28 |
| **Hasta el go-live y cierre** | **85** | **340** |
| F9 Estabilización (fuera del cronograma de desarrollo) | 5 | 20 |
| **Total** | **90** | **360** |

Horas del SOW: 126 (21 días × 6 h) · F0 a F8 sin estabilización: 340 h · **Diferencia: +170 %** (antes de D-30: 316 h, +151 %). Avisada y aprobada: estimación aprobada por el Tech Lead (D. B.) y vista por la PM (J. C.) el 2026-11-16. La diferencia con la estimación aprobada (87 SP) son los 3 SP del arranque F0–F2, ya terminado. T008 se mantiene en 3 SP con otra descripción (carrusel en vez de webview, misma fila del catálogo).

## Espejo ClickUp
| ID | ClickUp | Responsable | SP estimado | SP real | Sprint | Estado |
|---|---|---|---|---|---|---|
| T001 | 1dfg0rkn7ck | Jelou (H. T.) | 1 | | | hecho (espejo en main 55efa7b) |
| T002 | 1dfg0rkn7cm | Jelou (H. T.) | 5 | | | hecho (D-28 en 0aef523) |
| T003 | 1dfg0rkn7cn | Jelou (H. T.) | 3 | | | hecho (link definitivo D-31, 24/11) |
| T004 | 1dfg0rkn7cp | Jelou (H. T.) | 3 | | | hecho; V-06 abierto (anuncio real) |
| T005 | 1dfg0rkn7cq | Jelou (H. T.) | 5 | | | hecho |
| T006 | 1dfg0rkn7cr | Jelou (H. T.) | 5 | | | hecho; H-08 abierto |
| T007 | 1dfg0rkn7ct | Jelou (H. T.) | 3 | | | hecho |
| T008 | 1dfg0rkn7cu | Jelou (H. T.) | 3 | | | hecho (reemplazado por T026) |
| T026 | por crear | Jelou | 3 | | | hecho salvo KEYTON (V-08) |
| T027 | por crear | Jelou | 3 | | | to do |
| T009 | 1dfg0rkn7cv | Jelou (H. T.) | 3 | | | to do |
| T010 | 1dfg0rkn7cw | Jelou (H. T.) | 5 | | | to do |
| T011 | 1dfg0rkn7cx | Jelou (H. T.) | 3 | | | en curso (D-29 provisional; falta V-03) |
| T012 | 1dfg0rkn7cy | Jelou (H. T.) | 5 | | | to do |
| T013 | 1dfg0rkn7cz | Jelou (H. T.) | 3 | | | to do |
| T014 | 1dfg0rkn7d0 | Jelou (H. T.) | 2 | | | hecho |
| T015 | 1dfg0rkn7d1 | Jelou (H. T.) | 2 | | | to do |
| [C] términos | 1dfg0rkn7d2 | Cliente | — | — | — | complete (D-31, 24/11) |
| [C] id_conexion | 1dfg0rkn7d3 | Cliente | — | — | — | waiting on client |
| [C] teleasesores PMA | 1dfg0rkn7d4 | Cliente | — | — | — | waiting on client |
| T016–T024 | 1dfg0rkn7d5 … 1dfg0rkn7dd | Jelou (H. T.) | 2 c/u | | | to do |
| T025 | 1dfg0rkn7de | Jelou (H. T.) | 3 | | | to do |
| F7 / F8 / F9 / F10 | 1dfg0rkjr64 / 65 / 66 / 67 | Jelou (H. T.) | 3 / 2 / 5 / 2 | | | to do |
