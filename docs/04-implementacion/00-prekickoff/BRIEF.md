# Brief — Vehicentro · Fase 1: Consulta de catálogo y agencias

Fecha: 2026-11-16 (actualizado a v1.3) · Perfil CLI: `dev-vehicentro` (company 13744) · Repo: `JelouLatam/vehicentro` (`vehicentro-sow-hu`) — **no existe (B-01)**
Tarea ClickUp: https://app.clickup.com/t/86e2aact9 (F0: https://app.clickup.com/t/1dfg0rkjr5x)

## Fuentes
- [x] Brief v1.2 (10/09/2026) y cronograma original — reemplazados por v1.3
- [x] Revisión de flujos con el cliente (Diio, 04/11/2026) → `docs/00-cliente/decisiones.md` D-01..D-11
- [x] **Brief v1.3 aprobado por el cliente** (correo de A. F., 05/11/2026) → `01-sow/v1.3/` y `01-sow/sow.json`
- [x] Cronograma v1.3 (05/11/2026) → `01-sow/v1.3/Cronograma_Vehicentro_051126`
- [x] Documentación de APIs BDC (11/11/2026) → colección Postman y `02-apis/revision-apis-bdc.md`
- [ ] Diseño de preventa `Diseño_Cliente_Vehicentro`: no entregado (el Brief trae el diagrama)

## Objetivo
Migrar desde un proveedor externo a Jelou la atención por WhatsApp de las marcas de Vehicentro (unos 19.000 usuarios al mes que llegan desde pautas en Meta y TikTok). En esta fase el bot enruta por marca e intención, muestra el catálogo y las agencias, registra el lead en el BDC y lo asigna al teleasesor en PMA.

## Canales y brain
- WhatsApp únicamente, solo Ecuador.
- **Construcción en el brain `DEV Vehicentro`** (número de desarrollo); al terminar se **promueve a `EC-02-113-01 Vehicentro`** (número productivo). La forma de promover se define en F3 y F8.

## Alcance v1.3
| # | Caso de uso | Fuente |
|---|---|---|
| 1 | Flujo_1 · Bienvenida: origen de la campaña, aviso de términos, AI Router de marca e intención, asesor ya asignado (por marca y celular); Repuestos y Talleres → PMA | SOW v1.3 F-U1..F-U3 |
| 2 | Flujo_2 · Catálogo: agente de IA sobre la API de modelos, comparación y cambio de marca, **webview existente de Jelou Shop** | F-U4 |
| 3 | Flujo_2 · Cotización: cédula, ciudad, agencia, asesor de la agencia, ingreso del lead y asignación en PMA por correo del asesor | F-U5, F-A1 (D-07) |
| 4 | Transversal · Hasta 4 recordatorios en 24 h sin envíos nocturnos; agotados, lead como no gestionado | F-U6 |
| 5 | Transversal · Agrupación de mensajes y cierre ante interacción negativa | F-U7 |
| 6 | Transversal · Trazabilidad en Datum: usuarios, viaje, leads y evidencia de términos | F-A2 |

## Fuera de alcance
Repuestos y agendamiento en taller (solo se derivan), OCR, campañas HSM, comentarios en redes, geo-fencing, precalificación y buró, crédito directo, biometría y firma, pagos, otros canales y números, Colombia, iframe/SSO en el CRM y actualización de registros existentes del CRM.

## Integraciones (APIs BDC, OAuth2 client credentials)
| API | Uso | Estado del insumo |
|---|---|---|
| 4.1 Marcas | Router | Documentada |
| 4.2 Modelos por marca | Catálogo | Documentada |
| 4.3 Agencias por marca | Cotización | Documentada |
| 4.4 Asesor por agencia | Asignación | Documentada |
| 4.5 Existe asesor (marca, cédula, celular) | Asesor ya asignado | Documentada |
| 5 Ingreso de lead (POST) | Registro del prospecto | Documentada; **faltan los `id_conexion` por marca (C-02)** |
| Credenciales OAuth | Todas | **Pendientes (C-03)**, se cargan con `jelou secret` |

Pruebas y producción comparten servidor; la asignación con asesor solo se prueba con el cliente (A-09).

## Equipo (por rol)
Jelou: Tech Lead (**por confirmar**), PM, Implementador. Cliente: 2 PM de Vehicentro. Partner: PM de Claro. Los nombres están en la tarea madre y no se copian aquí.

## Testers
Por rol, sin teléfonos: pendiente de definir con los PM del cliente.

## Hallazgos para el Tech Lead
- **H-01 · Regla 17:** el SOW deja la aceptación de términos implícita, sin botones. La constitución exige Acepto / No acepto antes de cualquier dato. Bloquea F6; decide el Tech Lead con el cliente.
- **H-02 · BSUID:** el lead y 4.5 exigen el celular; con BSUID hay que pedirlo.
- **H-03 · Errata del SOW por las APIs:** INT-5 no existe, INT-6 es el ingreso de lead, 4.5 exige marca, el lead exige nombres, modelo y notas.

## Preguntas abiertas
| # | Pregunta | Responsable | Fecha |
|---|---|---|---|
| P1 | `id_conexion` de cada marca (A-08) | Cliente | antes de construir el lead |
| P2 | ¿4 marcas u 8? (A-10) | Cliente | antes de F2 |
| P3 | Origen de la campaña: ¿solo en `notas` o el BDC agrega campos? (A-02) | Cliente | antes de F2 |
| P4 | Cómo probar la asignación sin mover el reparto real de 4.4 (A-09) | Cliente | antes de F3 |
| P5 | Límites, disponibilidad, mantenimiento, puerto 9443 / IP (A-14, A-17) | Cliente | antes de F3 |
| P6 | Regla de derivación a PMA sin marca o intención; horario del contact center (Q-4, Q-7) | Cliente | antes de F2 |
| P7 | Intervalos de recordatorios y franja nocturna (Q-5) | Cliente | antes de F2 |
| P8 | Consentimiento implícito vs. regla 17 (H-01) | Tech Lead + Cliente | antes de F2 |
| P9 | ¿Quién mantiene el catálogo de Shop y coincide con la API? | Cliente / Implementador | antes de F3 |

## Mejoras sugeridas — fase 2
Repuestos, taller, campañas HSM y Colombia: ya figuran como etapas posteriores.
