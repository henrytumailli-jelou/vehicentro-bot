# Plan técnico — Vehicentro · Fase 1

Archivo: `docs/04-implementacion/03-plan/plan.md` · Fase 3 · **v0.2 (aprobado v0.1 el 16/11; enmiendas D-28 y D-30 en F5)**
Entrada: `02-spec/spec.md` v0.4 · `01-sow/sow.json` v1.3 · `docs/00-cliente/decisiones.md` D-01..D-30 · Fecha: 2026-11-18

## Resumen
Se ajusta lo que ya existe en el brain **DEV Vehicentro** (cambio mínimo) para cumplir la spec: el workflow de entrada «Bienvenida y Enrutamiento» incorpora el consentimiento (P0) y el orden marca → asesor; «Ventas» pasa a ser el Flujo_2 (catálogo con el **carrusel del Shop**, D-30; cotización, asesor por 4.4, registro del lead y asignación en PMA, D-28); «Derivar a Asesor» concentra los handoff. Todas las llamadas al BDC pasan por **una Function-adaptador** (`veh-bdc`) que maneja el OAuth, clasifica las respuestas y protege el registro del lead contra duplicados. Datum guarda consentimiento, viaje y leads. Al terminar, se promueve a **EC-02-113-01 Vehicentro** (F8).

## Contexto técnico
| Campo | Valor |
|---|---|
| Company / perfil CLI | `13744` / `dev-vehicentro` |
| Tipo de proyecto | `nuevo` en el SOW, pero **hay construcción previa en DEV**: se trata como actualización (ver «Proyecto existente») |
| Proyecto(s) | Construcción: **DEV Vehicentro** `01KYX1WCS2GBQXT355BK6ZHVMD` · Producción: **EC-02-113-01 Vehicentro** `01KYQZ99V5PPM2JSMQF4EMH55X` (no se toca hasta F8) |
| Tipo de solución | Determinista para consentimiento, validaciones, cotización, lead, recordatorios y derivación; IA solo en el router (marca e intención) y en el agente de catálogo |
| Canales | WhatsApp · canal «DEV Vehicentro» (solo pruebas) → canal «EC-02-113-01 Vehicentro» en el go-live |
| Enrutamiento | Agente de bienvenida (`AI_TASK`) ya construido + nodos `SKILL` hacia los workflows. AI Routing nativo no se activa (cambio mínimo; cumple lo que el SOW llama «AI Router») |
| Modelos | Ver «Costos» |
| Datos | Datum, base nueva `veh-fase1` (4 colecciones) |
| Integraciones | APIs BDC 4.1–4.5 y POST de lead, vía Function `veh-bdc` |
| Handoff | `CONNECT` en «Derivar a Asesor»: asignación directa al operador por correo; cola general de respaldo |
| WhatsApp Flows | no |
| Webviews / Sites | Página de producto de Jelou Shop (se abre desde el carrusel); no se desarrolla un webview propio (D-22, D-30) |
| KYC / Pagos / Firma / Voz | no |
| Catálogo | Jelou Shop cargado desde la API 4.2 (`scripts/shop-catalogo/`, luego Function horaria) y mostrado con `search_and_send_products_webview` (`presentation: "carousel"`) por MCP (D-30). Precio y ficha escritos: `veh-bdc` en vivo |
| Apps de marketplace | Jelou Shop (MCP conectado al agente de Ventas) |

## Revisión de la constitución
| # | Regla | ¿Aplica? | ¿Cumple el diseño? | Nota |
|---|---|---|---|---|
| 1 | El SOW manda | sí | sí | D-30 vuelve al catálogo de Jelou Shop que pide el SOW (D-27 queda reemplazada) |
| 3 | `--profile` explícito | sí | sí | `dev-vehicentro` en todo comando |
| 4 | Credenciales fuera del chat y de los workflows | sí | sí | Client ID y Secret como secretos de la Function `veh-bdc`; los carga una persona |
| 5 | Cero datos personales en repo/ClickUp/Slack | sí | sí | Barrido del `sync`; el espejo de DEV se revisa en F5 |
| 7 | Cambio mínimo | sí | sí | Se reutiliza lo construido; producción no se toca hasta F8 |
| 8 | Fail-closed | sí | sí | Respuesta incierta del BDC = no se da por registrado; se verifica con 4.5 |
| 9 | Sin `{{` literal en prompts | sí | sí | Se revisa en F5 |
| 10 | Mobile-first | no | — | Sin webview |
| 11 | Opciones en mensaje interactivo | sí | sí | Consentimiento, marcas, ciudades, agencias, botones del catálogo y recordatorios |
| 12 | Lo determinista fuera de la IA | sí | sí | Cédula, celular, ciudades, agencias, lead y recordatorios son nodos nativos o la Function |
| 17 | Consentimiento antes de datos, refresco 30 días | sí | **pendiente H-01** | El diseño trae Acepto / No acepto (P0). Lo acordado con el cliente es implícito: decide el Tech Lead con el cliente; bloquea F6 si se mantiene implícito |

## Consentimiento (regla 17)
| Campo | Valor |
|---|---|
| Ley aplicable | LOPDP (Ecuador) |
| Links | términos y política de datos: **insumo del cliente** (S-08) · versión `v1` |
| Dónde se pide | «Bienvenida y Enrutamiento», justo después de guardar el origen y **antes** del agente de bienvenida |
| Dónde se guarda | Datum `consentimientos`: id de WhatsApp, canal, versión, decisión, fecha |
| Refresco | `hoy - fecha > 30 días` o versión distinta → se pide de nuevo; solo cuando escribe el usuario (no en recordatorios) |
| Si rechaza | Sin datos personales; se registra el rechazo y se ofrece asesor en la misma conversación (`SKILL` → «Derivar a Asesor», sin celular ni cédula) |
| Qué se guarda en cada estado | **sin decidir:** nada personal · **rechazó:** id de WhatsApp, versión, fecha · **aceptó:** lo que pide la spec |
| Texto en vez del botón | Solo el texto idéntico a la etiqueta cuenta (`§1.7`); otro texto repite 1 vez con botón de asesor |

## Ambiente de construcción y publicación
| Campo | Valor |
|---|---|
| Canal de construcción y pruebas | «DEV Vehicentro» (WhatsApp Cloud, número de desarrollo) |
| ¿Algún canal de DEV sirve a usuarios reales? | **No** (confirmado por el implementador, 2026-11-16) |
| Publicar sin confirmar en F5 y F6 | **Sí, en DEV**, después de cada cambio que pase `jelou workflow validate` y `scripts/chequeo_push.py` — **lo autoriza el Tech Lead en esta puerta** |
| Ruta de prueba por WhatsApp | **Manual**: una ronda por carril con guion (no hay `wacli`) |
| Testers | por rol; los números los agrega la persona en la plataforma |

## Company compartida
| Qué | Decisión |
|---|---|
| Prefijo de recursos nuevos | `veh-` (Function `veh-bdc`, base `veh-fase1`) |
| No se tocan | Proyectos **EC-02-113-01 Vehicentro** (hasta F8), **EC Vehicentro Cobranzas** y **CO Vehicentro**, con sus canales |
| Recursos de toda la organización | Las 5 tools («Consultar marcas», «Consultar modelos», «Enviar carrusel modelos», «Verificador Campañas», «Verificar cliente») son de la organización. **Producción no las usa** (revisado el 16/11), así que se pueden ajustar sin afectarla |
| Zona horaria | America/Guayaquil |

## Proyecto existente (DEV Vehicentro)
| Qué se revisó | Con qué | Hallazgo |
|---|---|---|
| Workflows | `jelou pull` (2026-11-16) | 7 skills: Bienvenida y Enrutamiento (entrada, `AI_TASK` + 4 `SKILL` + `CONNECT`), Ventas (`AI_TASK`, 3 `HTTP` al BDC y a la API de mensajes), Repuestos, Talleres, Crédito Directo (cada uno con su `AI_TASK` y `CONNECT`), Derivar a Asesor, y uno deprecado vacío |
| Tools de la organización | `jelou tool list/show` | 5 tools que llaman al BDC **sin autenticación** (anteriores al OAuth) |
| Apps, Datum, secretos | `jelou context` | Jelou Shop instalada con solo el producto de ejemplo; 0 bases; 0 secretos |
| Producción | `jelou pull` de EC-02-113-01 (solo lectura) | No usa las 5 tools ni llama al BDC; tiene colas de PMA por segmento (Livianos, Pesados/Maquinaria, Eléctricos/Híbridos) |
| Qué se conserva | | Bienvenida y Enrutamiento, Ventas, Derivar a Asesor, las 5 tools (ajustadas) |
| Qué se cambia | | Consentimiento P0; orden marca → asesor; las llamadas al BDC pasan a `veh-bdc`; Repuestos, Talleres y **Crédito Directo** dejan de recibir tráfico del router (se deriva a PMA, OOS-1/2/6); sus workflows no se borran |
| Qué se agrega | | Function `veh-bdc`; base Datum `veh-fase1`; cotización y lead; recordatorios; agrupación de mensajes |
| Radio de impacto | | Solo DEV. Ningún cambio llega a producción antes de F8 |

## Topología
- **Entrada:** «Bienvenida y Enrutamiento» (default) → origen → P0 → agente de bienvenida (marca e intención) → celular (si BSUID) → 4.5 → `SKILL` «Ventas» o «Derivar a Asesor».
- **Hijos:** «Ventas» (Flujo_2), «Derivar a Asesor» (todos los handoff). Repuestos, Talleres y Crédito Directo quedan sin entrada.
- **Transversal:** recordatorios por inactividad y agrupación de mensajes (configuración del bot).

## Experiencia por paso
| Paso | HU | Ejecución | Experiencia | Disparo | Recurso Jelou |
|---|---|---|---|---|---|
| `F1:P1` Entrada | HU-01 | Determinista | Conversación | Inicio del workflow | Bienvenida y Enrutamiento |
| `F1:P2` Origen | HU-01 | Determinista | — | Tool «Verificador Campañas» + nodo Datum | Datum `viajes` |
| `P0` Consentimiento | HU-02 | Determinista | Mensaje con 2 botones | Nodo de mensaje | Datum `consentimientos` |
| `F1:P3` Bienvenida | HU-02 | Determinista | Conversación | Va dentro de P0 | — |
| `F1:P9` Marca e intención | HU-04 | IA | Conversación | `AI_TASK` de bienvenida + tool «Consultar marcas» | Agente de bienvenida |
| `F1:P10–P11` Pedir marca | HU-04 | Determinista | Lista interactiva (4 marcas) | Nodo de mensaje | — |
| `F1:P4–P5` Celular (BSUID) | HU-03 | Determinista | Pregunta + validación | Nodos de mensaje y condición | — |
| `F1:P6–P7` ¿Tiene asesor? | HU-03 | Determinista | — | Tool «Verificar cliente» → `veh-bdc` 4.5 | Function |
| `F1:P8` Asesor asignado | HU-03 | Determinista | Mensaje | Nodo de mensaje | — |
| `F1:P12` Contexto de marca | HU-04 | Determinista | — | `SKILL` → Ventas | — |
| `F1:P13` Sin interés | HU-04/08 | IA (detecta) + determinista (cierre) | Mensaje | Agente de bienvenida | — |
| `F1:P20` Derivación | HU-04/09 | Determinista | Handoff | `SKILL` → Derivar a Asesor | `CONNECT` |
| `F2:Q1–Q3` Catálogo y comparación | HU-05 | IA | Conversación + **carrusel** + botones | `AI_TASK` de Ventas con tools «Consultar modelos», «Consultar marcas» y MCP de Jelou Shop | Agente de catálogo |
| `F2:Q4` Ver catálogo | HU-05 | IA (llama la tool) | **Carrusel del Shop** (D-30) | `search_and_send_products_webview` (`presentation: "carousel"`) | Jelou Shop |
| `F2:Q5–Q6` Cédula | HU-06 | Determinista | Pregunta + validación (10 dígitos) | Nodos | — |
| `F2:Q7` Ciudad | HU-06 | Determinista | Lista interactiva (paginada > 10) | `veh-bdc` 4.3 + nodo de lista | — |
| `F2:Q8–Q9` Agencia | HU-06 | Determinista | Lista con dirección y horario | `veh-bdc` 4.3 + nodo de lista | — |
| `F2:Q10` Lead + asesor | HU-06 | Determinista | — | `veh-bdc` `/lead` (4.4 → POST; 4.5 solo si incierto, D-28) | Function + Datum `leads` |
| `F2:Q11` Quién lo atiende | HU-06 | Determinista | Mensaje | Nodo de mensaje | — |
| `F2:Q12` Asignación en PMA | HU-06 | Determinista | Handoff | `SKILL` → Derivar a Asesor (operador por correo) | `CONNECT` |
| `F2:Q20` Contingencia | HU-09 | Determinista | Mensaje + handoff | Rama de error de cada llamada | `CONNECT` |
| `T1:R1–R8` Recordatorios | HU-07 | Determinista | Mensaje con 2 botones | Recordatorio por inactividad (ver «Por verificar», V-04) | `veh-bdc` `/lead` (no gestionado) |

## Canales y dirección
| Agente | Canal | Dirección | Plantillas | Nota |
|---|---|---|---|---|
| F1, F2 | WhatsApp | Entrante | no | — |
| T1 | WhatsApp | Saliente **dentro de la ventana de 24 h** | no (Q-6: la plantilla fuera de 24 h no entra) | La regla 17 no se refresca en el recordatorio |

## Datos y validaciones
Base Datum `veh-fase1`. Retención indefinida (D-18). Los booleanos se crean como no obligatorios (`§1.7`).
| Colección | Campos | Fuente de verdad | Quién escribe |
|---|---|---|---|
| `consentimientos` | id_whatsapp, canal, version, decision (acepto/no_acepto), fecha | Jelou | Bienvenida |
| `usuarios` | id_whatsapp, celular, cedula, marca_origen, marca_interes, nombre_perfil | Jelou (después de aceptar) | Bienvenida, Ventas |
| `viajes` | id_whatsapp, origen (página, campaña, grupo, anuncio, formulario, plataforma), flujo, paso, abandono_en, derivado_a, fecha | Jelou | Todos |
| `leads` | id_whatsapp, celular, marca, id_modelo, modelos_consultados, id_agencia, ciudad, estado (registrado, no_gestionado, incierto, derivado), asesor_correo, clave_lead, fecha | **BDC**; copia en Jelou | `veh-bdc` vía Ventas y recordatorios |

| Validación | Dónde | Cómo | Si no cumple |
|---|---|---|---|
| Celular: 10 dígitos que empiezan con 09, o +593 + 9 dígitos (se normaliza a 09…) | Bienvenida, antes de 4.5 | Nodo `CODE`/condición | 1 reintento; luego sigue sin consulta (RN-03) |
| Cédula: 10 dígitos numéricos | Ventas, antes de ciudad | Nodo `CODE`/condición | 1 reintento; luego PMA (RN-06) |
| `notas` ≤ 1000 caracteres | `veh-bdc` | Recorte en la Function | — |
| `data: []` | `veh-bdc` | Se clasifica `vacio`, no `error` | Mensaje de «no encontramos…» con otra opción |

## Valores por definir del SOW
| Valor | Supuesto | Quién confirma | Qué cambia si es distinto |
|---|---|---|---|
| Franja sin recordatorios | 21:00–07:59 (S-03) | Cliente en la UAT | Una constante de la configuración |
| Intervalos de recordatorios | 1 h, máximo 4 (D-16) | Cliente en la UAT | Una constante |
| Horario de asesores / fuera de horario | Lo maneja PMA (D-17) | — | — |
| Retención de datos | Indefinida (D-18) | Tech Lead (riesgo LOPDP) | Política de borrado en Datum |
| Persona por marca | Un solo asistente (D-25) | Cliente | Prompt del agente |
| Disponibilidad de las APIs | 24/7 (D-19) | — | — |

## Insumos del cliente
| Servicio | Qué falta | Quién | Fecha | Si no llega | HU | Estado |
|---|---|---|---|---|---|---|
| BDC (OAuth) | Client ID y Secret cargados como secretos de `veh-bdc` | Cliente (entregó) + implementador (carga) | antes de F5 | esperar | todas | entregado, **sin cargar** |
| BDC lead | `id_conexion` de producción por marca | Cliente | antes de F8 (excepción de F1) | `TESTCLARO` hasta entonces | HU-06, HU-07 | pendiente |
| Términos | Link de términos y política de datos, versión | Cliente | antes de F5 (paso P0) | esperar (P0 se construye con un link marcado como provisional) | HU-02 | pendiente |
| PMA | Teleasesores como usuarios de PMA con el mismo correo del BDC | Cliente / Jelou | antes de la UAT | la asignación cae en la cola general | HU-06 | pendiente |

## Decisiones confirmadas

> **Enmienda 2026-11-17 — D-30 (F3 reabierta desde F5).** El catálogo vuelve a **Jelou Shop**, como pide el SOW (Ecommerce WebView / catálogo de Shop). Cambia lo que este plan decía con D-27:
> - **Catálogo:** los 10 modelos de la API 4.2 se cargan en el Shop de la company con `scripts/shop-catalogo/` (rama `main`): SKU `VEH-<id_modelo>`, categoría = marca, precio USD, descripción y fotos del BDC. Upsert por SKU: repetirlo actualiza, no duplica.
> - **Ventas (`F2:Q4`):** la tool «Enviar carrusel modelos» se reemplaza por el **carrusel del Shop**: tool `search_and_send_products_webview` de la app Jelou Shop (MCP) con `presentation: "carousel"` (corregido el 17/11: la nativa `search_products` solo devuelve datos). `F2:Q1–Q3` no cambian: precio y ficha escritos siguen saliendo de `veh-bdc` en vivo (RN-05).
> - **Sincronización:** Function con un job cada hora que repite la carga (tarea nueva, después). Hasta entonces, el script se corre a mano cuando el cliente cambie su catálogo. Riesgo mientras tanto: el carrusel puede mostrar un precio viejo; la respuesta escrita usa el BDC.
> - **Recurso de toda la company:** el catálogo del Shop lo comparte con el brain de producción, que hoy no lo usa (16/11). El «Sample Product» se desactivó (reversible).
> - **Por verificar (V-08):** que el carrusel del Shop llega por WhatsApp, también con una sola tarjeta (KEYTON tiene un solo modelo; la API de mensajes rechaza carruseles de 1 tarjeta, `jelou-conversational-ui` §7c).
> - Pide la ratificación del Tech Lead en la puerta de F5.

| Familia | Opciones presentadas | Elegida | Quién | Fecha |
|---|---|---|---|---|
| Catálogo | Cargar Shop desde la API · el cliente carga Shop · carrusel en el chat | ~~Carrusel en el chat (D-27)~~ → **Cargar Shop desde la API** (D-30, enmienda del 17/11) | Implementador | 2026-11-16 |
| Construcción | Reutilizar y ajustar · construir de nuevo | **Reutilizar y ajustar** | Implementador | 2026-11-16 |
| Enrutamiento | AI Routing nativo · agente de bienvenida existente | **Agente de bienvenida existente** (cambio mínimo) | Plan; lo confirma el Tech Lead en la puerta | 2026-11-16 |
| Recordatorios | Recordatorio por inactividad de Jelou · Function con cron | **Recordatorio de Jelou**, si V-04 lo confirma; si no, Function con cron | Plan (el SOW nombra la herramienta de Jelou) | 2026-11-16 |
| Pruebas por WhatsApp | Automatizada · manual | **Manual** | Implementador | 2026-11-16 |

## Pasos que solo hace una persona
| Paso | Quién | Fase |
|---|---|---|
| Cargar Client ID y Secret del BDC como secretos de `veh-bdc` (`! jelou functions secrets set …`) | Implementador (con lo que entregó el cliente) | F5 |
| Entregar los links de términos y política | Cliente | F5 |
| Crear los teleasesores como operadores de PMA | Cliente / Jelou | antes de la UAT |
| Agregar los números de prueba en el canal de DEV | Implementador | F5 |
| Publicar en producción (promoción de DEV) | Implementador con aprobación | F8 |

## Condiciones del cliente para producción
Ninguna además del SOW (no se pidieron pruebas de seguridad ni matriz de riesgos).

## Supuestos de plataforma
| Supuesto | Fuente | Prueba mínima en F5 | Si es falso |
|---|---|---|---|
| Texto igual a la etiqueta cuenta como el botón | `§1.7` | — | — |
| Audio o imagen sobre un nodo de opciones puede cancelar la ejecución | `§1.7` | Enviar un audio en P0 y en la lista de agencias | Mensaje decidido con el cliente |
| Las tools no admiten nodos conversacionales | `§1.7` | — | La derivación va en «Derivar a Asesor» |
| `CONNECT` asigna a **un operador por su correo** | por verificar (**V-03**) | Workflow de 2 nodos que asigna a un operador de prueba por correo | Asignar por equipo y dejar el correo en la nota del handoff |
| Existe un recordatorio por inactividad nativo con máximo de envíos y franja horaria | por verificar (**V-04**) | Configurarlo en DEV con 1 min y ver los envíos | Function con cron que lee `viajes` y envía dentro de 24 h |
| La espera para agrupar mensajes (2 s) es configurable en el bot | por verificar (**V-05**) | Enviar 3 mensajes seguidos | Agrupación en el workflow de entrada |
| La Function alcanza el puerto 9443 del BDC | por verificar (**V-02**) | Pedir el token desde `veh-bdc` | Pedir al cliente abrir la IP de salida |
| Meta entrega el origen del anuncio en el mensaje de entrada; TikTok, por confirmar | por verificar (**V-06**, Q-9) | Mensaje desde un anuncio de prueba | Origen «directo» |

## Escrituras a terceros
| Operación | Huella de duplicado | Clave de idempotencia | Resultado incierto | Reintento |
|---|---|---|---|---|
| Lead en el BDC (`POST botwa/{id_conexion}`) | **celular + marca** | `clave_lead` en la memoria de la sesión y en Datum `leads`; si ya existe con estado `registrado`, no se envía de nuevo | No se reintenta el POST; se consulta 4.5. Con asesor → sigue; sin asesor → «Estamos confirmando su registro…» + cola general; `leads.estado = incierto` | Ninguno del POST. Solo 401 → token nuevo y 1 reintento (no llegó a registrarse) |
| Lead no gestionado (recordatorios) | **celular + marca** | La misma | Igual; sin mensaje al usuario | Igual |

## Recursos con costo o de toda la organización
| Recurso | Costo | Alcance | Quién lo paga |
|---|---|---|---|
| Base Datum `veh-fase1` | según el plan de la company | proyecto | Cliente (plan de Jelou) |
| Function `veh-bdc` | ejecuciones | organización | Cliente (plan de Jelou) |
| Secretos de `veh-bdc` | — | Function | — |
| Tools de la organización (5) | — | organización | — |

## Por verificar en F5
| Id | Qué | Cómo | Si no coincide |
|---|---|---|---|
| V-01 | El BDC acepta el lead con `id_agencias` sin `id_asesor` (TESTCLARO), asigna asesor de esa agencia y 4.5 lo devuelve | POST de prueba + 4.5 | Respaldo con 4.4 antes del POST (D-26) |
| V-02 | Salida al puerto 9443 y token OAuth desde la Function | `veh-bdc /health` | Pedir apertura al cliente |
| V-03 | `CONNECT` a un operador por correo | Workflow de 2 nodos | Asignación por equipo + correo en la nota |
| V-04 | Recordatorio por inactividad nativo (4 envíos, franja) | Configuración en DEV | Function con cron |
| V-05 | Agrupación de mensajes de 2 s | 3 mensajes seguidos | Agrupación en el workflow |
| V-06 | Origen del anuncio (Meta / TikTok) | Anuncio de prueba | Origen «directo» |
| V-07 | Interior de las 5 tools (`jelou tool pull`) para pasar sus llamadas a `veh-bdc` | `jelou tool pull` | Tool nueva versionada |

## Parámetros por recurso
| Recurso | Parámetros | Ramas | Prueba sin intervención |
|---|---|---|---|
| `veh-bdc` | URL base del BDC (configuración), `TESTCLARO`, tiempo máximo 10 s por llamada, token en caché con vencimiento a los 55 min | `ok`, `vacio`, `negocio`, `indisponible`, `incierto` | Pruebas unitarias de la Function + llamadas reales de lectura |
| Recordatorio | intervalo 60 min, máximo 4, franja 21:00–07:59, ventana 24 h | enviado / respondido / agotado | Intervalo de 1 min en DEV |
| `CONNECT` | correo del operador; cola general de respaldo | asignado / sin operador / fuera de horario / error (las 4 salidas, AP-13) | Operador de prueba |

## HU → dónde vive
| HU | Workflow / tool | Function | Datos | Skill que lo construye |
|---|---|---|---|---|
| HU-02 | Bienvenida y Enrutamiento | — | `consentimientos` | `jelou-build-workflows` |
| HU-01 | Bienvenida + tool «Verificador Campañas» | — | `viajes` | `jelou-build-workflows` |
| HU-04 | Bienvenida (`AI_TASK`) + tool «Consultar marcas» | `veh-bdc` 4.1 | `usuarios` | `jelou-build-workflows` |
| HU-03 | Bienvenida + tool «Verificar cliente» | `veh-bdc` 4.5 | `usuarios` | `jelou-build-workflows` |
| HU-05 | Ventas (`AI_TASK`) + tool «Consultar modelos» + MCP Jelou Shop | `veh-bdc` 4.2; Function de sincronización del Shop (T027) | `viajes` | `jelou-build-workflows`, `jelou-shop`, `jelou-functions` |
| HU-06 | Ventas → Derivar a Asesor | `veh-bdc` 4.3, 4.4, `/lead` | `leads`, `usuarios` | `jelou-build-workflows`, `jelou-functions` |
| HU-09 | Ramas de error en Bienvenida y Ventas → Derivar a Asesor | `veh-bdc` (clasificación) | `viajes` | `jelou-build-workflows` |
| HU-08 | Configuración del bot + prompts | — | — | `jelou-build-workflows` |
| HU-07 | Recordatorio por inactividad (o Function con cron) | `veh-bdc` `/lead` | `leads`, `viajes` | `jelou-build-workflows` / `jelou-functions` |

## Integraciones
Contrato confirmado: documentación del cliente del 11/11/2026 (`02-apis/`). La Function `veh-bdc` responde siempre `{ok, tipo, data}` con `tipo` ∈ `ok | vacio | negocio | indisponible | incierto`.
| Ruta de `veh-bdc` | API del BDC | Contrato | Secret | Estado |
|---|---|---|---|---|
| `GET /marcas` | 4.1 | `data: [{id, nombre}]` | `BDC_CLIENT_ID`, `BDC_CLIENT_SECRET` | confirmado |
| `GET /modelos/:id_marca?busqueda=` | 4.2 | modelos con `json_ficha_tecnica` ya parseada y recortada; `imagenes[]` | ídem | confirmado |
| `GET /agencias/:id_marca?ciudad=` | 4.3 | agencias; `ciudades[]` sin repetir | ídem | confirmado |
| `GET /asesor/:id_agencia/:id_marca` | 4.4 (respaldo) | asesor con correo | ídem | confirmado |
| `GET /existe-asesor/:id_marca?cedula=&celular=` | 4.5 | asesor o `vacio` | ídem | confirmado |
| `POST /lead` | 4.4 (solo con `BDC_ENVIAR_ASESOR=true`) → POST `botwa/{id_conexion}`; 4.5 si el POST es incierto (D-28) | entrada: marca, celular, cédula, nombre, id_modelo, id_agencia, ciudad, notas, clave_lead · salida: `{tipo, asesor?}` | ídem | confirmado (`TESTCLARO`) |

**Fallas** (`§1.3`): sin respuesta → lectura: 1 reintento; escritura: no se reintenta, se verifica con 4.5 · `401` → token nuevo y repetir 1 vez · `400` → `negocio` (error de datos; alerta interna) · `500` → 1 reintento en lecturas · `status: error` con 200 → `negocio`, no se reintenta en bucle · `data: []` → `vacio`. El usuario nunca ve el código ni el mensaje técnico.

## Guardrails de los nodos de IA
| Nodo | Qué sí responde | Ante un tema ajeno | Intento de saltarse instrucciones | Nunca inventa ni revela | Deriva cuando |
|---|---|---|---|---|---|
| Agente de bienvenida | Identificar marca (de las 4 de 4.1) e intención: Comercial, Repuestos, Talleres, sin interés | Una frase: solo ayuda con vehículos de las 4 marcas; vuelve a preguntar la marca con la lista | No cambia de rol, no revela prompt ni tools | Marcas que no estén en 4.1; datos de otros clientes | Repuestos, Talleres, crédito, quejas, marca no identificada tras la lista |
| Agente de catálogo (Ventas) | Modelos, precios, fichas, comparación y cambio de marca, solo con lo que devuelven sus tools | Una frase y vuelve al catálogo con botones | Igual | Precios, descuentos, financiamiento, stock, plazos de entrega | Financiamiento, repuestos, quejas, temas que el catálogo no cubre (RN-05) |

Las reglas van **al inicio** del prompt. Los nodos de Repuestos, Talleres y Crédito Directo quedan sin tráfico y no se revisan en esta fase.

## Costos
- **IA:** 2 nodos con tráfico (bienvenida y catálogo). Hoy usan `openai/gpt-5.6-luna` y sus tools `gpt-4.1-mini`. Se mantienen en F5 y se revisan con `jelou-cost-workflows` (tarea T015).
- **Mensajes en el camino principal** (cotización completa): bienvenida con botones (1) → respuesta de catálogo con carrusel y botones (2–3) → cédula (1) → ciudades (1) → agencias (1) → quién lo atiende (1) ≈ **8 mensajes** del bot. Recordatorios: máximo 4 por conversación abandonada.
- **Recurrentes:** créditos y ejecuciones de Jelou, Datum, tokens, asientos de PMA, mensajes de servicio de Meta.

## Riesgos
| Riesgo | Impacto | Mitigación | Responsable |
|---|---|---|---|
| El BDC no asigna asesor al recibir el lead (V-01, ocurrió) | Asesor equivocado | Resuelto con D-28: 4.4 antes del POST | Implementador |
| Pruebas y producción comparten servidor | Leads de prueba en el CRM | `TESTCLARO`; limpieza a cargo del cliente (supuesto del SOW) | Cliente |
| Consentimiento implícito (H-01) | F6 no pasa | Decisión del Tech Lead con el cliente | Tech Lead |
| El avance del 17/11 enviado al TL anunciaba D-27 (carrusel en vez del webview); D-30 lo revirtió | El cliente recibe un mensaje contradictorio | Avisar al TL que D-27 ya no aplica y que se cumple el SOW | Implementador |
| El catálogo del Shop queda viejo frente al BDC hasta tener la sincronización horaria | Precio distinto en el carrusel y en la respuesta escrita (RN-05) | T027; mientras tanto, correr el script cuando el cliente cambie el catálogo | Implementador |
| Tools de la organización cambiadas | Otro proyecto las use en el futuro | Versionar las tools; producción no las usa hoy | Implementador |
| Esfuerzo (348 h) frente al cronograma (126 h) | Retraso | Aprobado por TL y PM | PM |

## Registro de complejidad
| Violación | Por qué hace falta | Alternativa descartada |
|---|---|---|
| ~~Regla 1: Ecommerce WebView reemplazado por carrusel en el chat (D-27)~~ | Cerrada con D-30 (17/11): se carga el Shop desde la API (+3 SP T026, +3 SP T027 sincronización) | — |
| Regla 17 (H-01) | Pendiente de la decisión del Tech Lead con el cliente | — |
