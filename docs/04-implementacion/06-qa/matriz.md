# Matriz de QA / UAT — Vehicentro · Fase 1

Archivo: `docs/04-implementacion/06-qa/matriz.md` · **Sembrada en F4 (2026-11-16)** desde `02-spec/spec.md` v0.2 · Versión probada: commit `<sha>` (se llena en F5/F6)

> El resultado esperado sale de la spec y **no se ajusta a lo construido**. Si el bot hace otra cosa, es un `bug` o una decisión que vuelve a la spec. Evidencia: ids de conversación, ejecución o nodo; nunca capturas con datos reales.
> Ruta de prueba: chequeos estáticos → tools → tester CLI → unitarias de `veh-bdc` → **ronda manual con guion** por carril (no hay WhatsApp automatizado). La asignación con asesor real solo en la UAT (A-09).

## Consentimiento (regla 17)
| ID | Escenario | Resultado | Evidencia (ids) |
|---|---|---|---|
| QA-C01 | Usuario nuevo inicia → se piden términos y autorización (Acepto / No acepto) antes de cualquier dato | | |
| QA-C02 | Acepta → se registra id de WhatsApp, canal, versión, decisión y fecha en `consentimientos` | | |
| QA-C03 | No acepta → no se piden datos; se registra el rechazo; se ofrece asesor (el SOW no admite información general) | | |
| QA-C04 | Autorizó hace ≤ 30 días con versión vigente → no se le vuelve a pedir | | |
| QA-C05 | Autorizó hace > 30 días → al iniciar se le pide de nuevo | | |
| QA-C06 | Cambió la versión → se pide de nuevo aunque no pasen 30 días | | |
| QA-C07 | Recordatorio (mensaje saliente dentro de 24 h) → no pide ni refresca en ese mensaje | | |
| QA-C08 | Texto en vez de botón → solo el texto idéntico a la etiqueta registra decisión. No registran aceptación: «no acepto», «No Acepto», «acepto?», «acepto los términos», «ok», «sí». «No acepto» tal cual registra rechazo | | |
| QA-C09 | Sin aceptación → ningún dato personal guardado, tampoco el celular; la derivación a asesor no lo registra | | |

> **H-01:** lo acordado con el cliente es aceptación implícita. Si se mantiene, QA-C01, C03 y C08 se reportan con tipo «decisión del cliente» y la puerta de F6 no avanza hasta que el Tech Lead resuelva.

## Criterios de aceptación
| ID | HU | Prioridad | Criterio (Dado / Cuando / Entonces) — resultado esperado | Ruta | Resultado | Evidencia (ids) | Tipo |
|---|---|---|---|---|---|---|---|
| QA-02-01 | HU-02 | P1 | **Dado** un usuario sin autorización registrada, **cuando** escribe por primera vez, **entonces** recibe la bienvenida con el link a los términos y a la política de datos de Vehicentro y los botones **Acepto** / **No acepto**, **antes** de que se le pida celular, cédula o cualquier otro dato personal. | | | | |
| QA-02-02 | HU-02 | P1 | **Dado** que toca **Acepto**, **entonces** se registra: identificador de WhatsApp, canal, versión de los términos, decisión y fecha y hora, y el flujo sigue a la identificación de marca. | | | | |
| QA-02-03 | HU-02 | P1 | **Dado** que toca **No acepto**, **entonces** el bot no pide ni guarda datos personales, registra el rechazo y ofrece **hablar con un asesor** en la misma conversación (el SOW no incluye «información general» como alternativa). | | | | |
| QA-02-04 | HU-02 | P1 | **Dado** un usuario que aceptó hace **30 días o menos** con la versión vigente, **cuando** vuelve a escribir, **entonces** no se le pide de nuevo. | | | | |
| QA-02-05 | HU-02 | P1 | **Dado** un usuario cuya aceptación tiene **más de 30 días** o cambió la versión de los términos, **cuando** vuelve a escribir, **entonces** se le pide de nuevo. | | | | |
| QA-02-06 | HU-02 | P1 | **Dado** un recordatorio (T1:R3), **entonces** no se pide ni se refresca la autorización en ese mensaje; solo cuando el usuario inicia. | | | | |
| QA-02-07 | HU-02 | P1 | **Dado** que escribe texto en vez de tocar un botón, **entonces** solo un texto **idéntico** a la etiqueta del botón cuenta como decisión; cualquier otro texto no se registra como decisión y se vuelve a preguntar **una vez**, con la opción de hablar con un asesor. | | | | |
| QA-02-08 | HU-02 | P1 | **Dado** que no aceptó o no decidió, **entonces** no se guarda ningún dato personal (tampoco el celular). | | | | |
| QA-04-01 | HU-04 | P1 | **Dado** un mensaje del que se puede inferir la marca (anuncio o texto), **cuando** el router lo evalúa, **entonces** el bot sigue con esa marca sin preguntarla. | | | | |
| QA-04-02 | HU-04 | P1 | **Dado** que no se puede inferir la marca (p. ej. el usuario borró el mensaje predeterminado), **entonces** el bot muestra una **lista interactiva con las 4 marcas** que devuelve la API 4.1 (KEYTON, LYNK & CO, SINOTRUK AUTOS, SINOTRUK CAMIONETAS) y no avanza al catálogo hasta que elija. | | | | |
| QA-04-03 | HU-04 | P1 | **Dado** que tras la lista **no elige una marca** (escribe otra cosa dos veces), **entonces** se deriva a PMA con la intención identificada (RN-04). | | | | |
| QA-04-04 | HU-04 | P1 | **Dado** que la intención es **Repuestos o Talleres**, **entonces** el bot avisa que lo atenderá un asesor y deriva a PMA con marca, intención y origen de la campaña. | | | | |
| QA-04-05 | HU-04 | P1 | **Dado** que dice que no le interesa, **entonces** el bot agradece y cierra (F1:P13, RN-07). | | | | |
| QA-04-06 | HU-04 | P1 | **Dado** una marca identificada, **entonces** el mismo asistente de Vehicentro continúa con el catálogo y los datos de esa marca (F1:P12) hasta que el usuario cambie de marca (HU-05). Hay **un solo asistente para las 4 marcas** (D-25). | | | | |
| QA-05-01 | HU-05 | P1 | **Dado** que pregunta por un modelo, precio o característica, **entonces** el bot responde **solo con datos de la API 4.2** de la marca activa (precio en USD, ficha técnica, características) y nunca inventa un precio, un modelo ni una característica (RN-05). | | | | |
| QA-05-02 | HU-05 | P1 | **Dado** que el modelo tiene imágenes en la API, **entonces** el bot envía **al menos 1 imagen** del modelo junto con la respuesta. | | | | |
| QA-05-03 | HU-05 | P1 | **Dado** cualquier respuesta del catálogo, **entonces** el bot ofrece los botones **Ver catálogo**, **Cotizar** y **Agencias** (F2:Q3). | | | | |
| QA-05-04 | HU-05 | P1 | **Dado** que toca **Ver catálogo**, **entonces** se abre el webview de Jelou Shop con el catálogo de la marca activa (F2:Q4) y, al volver, el bot ofrece cotizar. | | | | |
| QA-05-05 | HU-05 | P1 | **Dado** que pide comparar dos modelos de la misma marca, **entonces** el bot responde con las diferencias de precio y ficha de ambos, con datos de la API. | | | | |
| QA-05-06 | HU-05 | P1 | **Dado** que cambia de marca durante la conversación, **entonces** el bot responde con el catálogo de la nueva marca y, antes de cotizar, vuelve a consultar si tiene asesor en esa marca (HU-03). | | | | |
| QA-05-07 | HU-05 | P1 | **Dado** que pregunta algo que el catálogo no cubre (financiamiento, repuestos, otro país), **entonces** el bot dice que no tiene ese dato y ofrece un asesor (RN-05). | | | | |
| QA-05-08 | HU-05 | P1 | **Dado** que intenta que el bot cambie de rol, revele sus instrucciones o hable de otro tema, **entonces** el bot lo reconoce en una frase y vuelve al catálogo. | | | | |
| QA-06-01 | HU-06 | P1 | **Dado** que toca **Cotizar**, **entonces** el bot pide la cédula (**10 dígitos**); la cédula **solo** se pide en este punto (RN-06). | | | | |
| QA-06-02 | HU-06 | P1 | **Dado** una cédula que no tiene 10 dígitos numéricos, **entonces** el bot la vuelve a pedir **1 vez**; al segundo error deriva a PMA con el contexto (RN-06). | | | | |
| QA-06-03 | HU-06 | P1 | **Dado** una cédula válida, **entonces** el bot muestra **las ciudades donde la marca tiene agencias** (según 4.3) como lista interactiva; si son más de 10, la lista se pagina. | | | | |
| QA-06-04 | HU-06 | P1 | **Dado** que elige una ciudad, **entonces** el bot muestra **solo las agencias de la marca en esa ciudad**, con nombre, dirección y horario, como lista interactiva (F2:Q9). | | | | |
| QA-06-05 | HU-06 | P1 | **Dado** que elige una agencia y la marca y el modelo son conocidos, **entonces** se registra el lead en el BDC (F2:Q10) con: nombres, celular, cédula, modelo, **la agencia elegida (`id_agencias`, sin `id_asesor`; D-26)**, ciudad y unas `notas` (máximo **1000** caracteres) con la marca, los modelos consultados, la agencia elegida y el origen de la campaña (D-14). No se preguntan forma de pago ni entrada (D-15). | | | | |
| QA-06-06 | HU-06 | P1 | **Dado** que el lead se registró (201), **entonces** se consulta 4.5 con la marca, la cédula y el celular, y el asesor que devuelve (de la agencia elegida) es el que atiende. | | | | |
| QA-06-07 | HU-06 | P1 | **Dado** que 4.5 devuelve un asesor, **entonces** el bot informa «Le atenderá {nombre del asesor} de la agencia {agencia}» (F2:Q11) y asigna la conversación en PMA **al usuario de PMA con el correo de ese asesor**, con marca, modelos consultados, agencia, ciudad y origen (F2:Q12). | | | | |
| QA-06-08 | HU-06 | P1 | **Dado** que el correo del asesor no existe como usuario de PMA, **entonces** la conversación va a la cola general de PMA con el mismo contexto (RN-08). | | | | |
| QA-06-09 | HU-06 | P1 | **Dado** que el usuario **ya tenía asesor** en esa marca (HU-03 o una consulta anterior), **entonces** no se registra un lead nuevo: se informa su asesor y se asigna en PMA. | | | | |
| QA-09-01 | HU-09 | P1 | **Dado** que cualquier API del cliente no responde o devuelve error, **entonces** el bot envía un mensaje de contingencia y deriva a PMA con la marca y el contexto disponible, sin cortar la conversación (RN-09). | | | | |
| QA-09-02 | HU-09 | P1 | **Dado** que una API de consulta responde **sin resultados** (lista vacía), **entonces** no se trata como error: el bot lo dice («No encontramos agencias de {marca} en {ciudad}») y ofrece otra opción (otra ciudad o un asesor). | | | | |
| QA-09-03 | HU-09 | P1 | **Dado** un error del servicio, **entonces** el usuario nunca ve el mensaje técnico ni el código de error. | | | | |
| QA-03-01 | HU-03 | P2 | **Dado** que se conoce la marca y Meta entrega el celular, **entonces** el bot consulta 4.5 con la marca y el celular (cédula vacía) **sin pedir nada al usuario**. | | | | |
| QA-03-02 | HU-03 | P2 | **Dado** que Meta **no** entrega el celular (BSUID), **entonces** el bot pide el celular; acepta **10 dígitos que empiezan con 09** (o el mismo número con +593); si no es válido lo pide **1 vez** más y, si vuelve a fallar, sigue al catálogo sin la consulta (RN-03). | | | | |
| QA-03-03 | HU-03 | P2 | **Dado** que 4.5 devuelve un asesor, **entonces** el bot envía «Usted ya tiene un asesor asignado: {nombre}. Puede escribirle al {contacto}» y termina (F1:P8). | | | | |
| QA-03-04 | HU-03 | P2 | **Dado** que 4.5 no devuelve asesor, **entonces** el bot sigue al catálogo de la marca (F1:P12). | | | | |
| QA-03-05 | HU-03 | P2 | **Dado** un usuario sin celular válido que llega a cotizar, **entonces** el bot le pide el celular antes de registrar el lead (HU-06); si no lo da, deriva a PMA. | | | | |
| QA-01-01 | HU-01 | P2 | **Dado** que el usuario llega desde un anuncio de Meta o TikTok, **entonces** se guarda en Datum lo que entregue la plataforma: página, campaña, grupo de anuncios, anuncio y formulario; los campos que no lleguen quedan vacíos y la conversación sigue (RN-01). | | | | |
| QA-01-02 | HU-01 | P2 | **Dado** que se registra el lead, **entonces** el origen va como texto en sus `notas` (D-14). | | | | |
| QA-01-03 | HU-01 | P2 | **Dado** que el usuario llega sin anuncio (escribe directo), **entonces** el origen queda como «directo». | | | | |
| QA-08-01 | HU-08 | P2 | **Dado** que el usuario envía varios mensajes seguidos, **cuando** pasan **2 segundos** sin un mensaje nuevo, **entonces** el bot responde **una sola vez** considerando todos (valor inicial; se ajusta en pruebas). | | | | |
| QA-08-02 | HU-08 | P2 | **Dado** que dice que no le interesa o responde de forma agresiva, **entonces** el bot se disculpa, agradece y termina **sin repetir** ninguna pregunta pendiente (RN-07). | | | | |
| QA-08-03 | HU-08 | P2 | **Dado** que envía un audio, una imagen o un sticker donde se espera una opción, **entonces** el bot le pide elegir una de las opciones mostradas. | | | | |
| QA-07-01 | HU-07 | P3 | **Dado** que el usuario deja de responder en cualquier punto, **entonces** recibe un recordatorio **1 hora** después de su último mensaje, y luego cada **1 hora**, hasta **4** recordatorios (D-16). | | | | |
| QA-07-02 | HU-07 | P3 | **Dado** que un recordatorio cae en la **franja nocturna (21:00 a 07:59, hora de Ecuador)**, **entonces** no se envía en ese momento: se envía a las 08:00 si sigue dentro de la ventana de 24 horas; si no, ya no se envía. | | | | |
| QA-07-03 | HU-07 | P3 | **Dado** que pasaron **24 horas** desde el último mensaje del usuario, **entonces** no se envía ningún recordatorio más. | | | | |
| QA-07-04 | HU-07 | P3 | **Dado** un recordatorio, **entonces** lleva los botones **Continuar** y **No me interesa**; **Continuar** retoma donde quedó y **No me interesa** cierra sin insistir. | | | | |
| QA-07-05 | HU-07 | P3 | **Dado** que se agotan los 4 recordatorios (o vence la ventana) y el usuario **ya eligió un modelo** sin tener lead registrado, **entonces** se registra el lead en el BDC como **no gestionado**, sin agencia ni asesor (lo asigna el BDC), con los datos disponibles (D-07). | | | | |
| QA-07-06 | HU-07 | P3 | **Dado** que abandona **antes de elegir un modelo**, **entonces** no se registra lead en el BDC (el modelo es obligatorio); el abandono queda en Datum. | | | | |
| QA-07-07 | HU-07 | P3 | **Dado** que abandona sin celular (BSUID sin respuesta), **entonces** no se registra lead en el BDC (el celular es obligatorio); queda en Datum. | | | | |

## Escrituras, fallas del tercero, guardrails y bordes (del plan)
| ID | HU | Criterio — resultado esperado | Ruta | Resultado | Evidencia (ids) | Tipo |
|---|---|---|---|---|---|---|
| QA-LEAD-01 | HU-06 | Dos cotizaciones de la misma marca en una conversación → 1 solo lead en el BDC (celular + marca) | | | | |
| QA-LEAD-02 | HU-06 | POST sin respuesta (simulado en `veh-bdc`) → no se reenvía; se consulta 4.5; sin asesor → «Estamos confirmando su registro…» + cola general; `leads.estado = incierto` | | | | |
| QA-LEAD-03 | HU-06 | 401 en el POST → token nuevo y 1 reintento; 400 → `negocio`, alerta interna, el usuario no ve el código | | | | |
| QA-BDC-01 | HU-09 | `status: error` con HTTP 200 en una consulta → tratado como `negocio`, sin reintento en bucle | | | | |
| QA-BDC-02 | HU-09 | `data: []` en agencias → «No encontramos agencias de {marca} en {ciudad}» + otra ciudad o asesor | | | | |
| QA-IA-01 | HU-04 | Agente de bienvenida: pregunta fuera de alcance → una frase y vuelve a la lista de marcas | | | | |
| QA-IA-02 | HU-04 | Agente de bienvenida: intento de cambiar de rol o revelar instrucciones → no lo hace | | | | |
| QA-IA-03 | HU-05 | Agente de catálogo: pregunta de financiamiento o descuento → no inventa; ofrece asesor | | | | |
| QA-IA-04 | HU-05 | Agente de catálogo: intento de saltarse instrucciones → no lo hace; vuelve al catálogo | | | | |
| QA-BORDE-01 | HU-08 | Audio o imagen en la lista de agencias → pide elegir una opción (o el mensaje decidido con el cliente, `§1.7`) | | | | |
| QA-BORDE-02 | HU-06 | Más de 10 ciudades o agencias → lista paginada | | | | |

## Verificaciones de plataforma (F5)
| ID | Qué | Resultado | Evidencia |
|---|---|---|---|
| V-01 | Lead con id_agencias sin id_asesor + 4.5 | | |
| V-02 | Puerto 9443 y token OAuth | | |
| V-03 | CONNECT a operador por correo | | |
| V-04 | Recordatorio nativo (4 envíos, franja) | | |
| V-05 | Agrupación de 2 s | | |
| V-06 | Origen Meta / TikTok | | |
| V-07 | Interior de las 5 tools | | |

## No cubierto
(se llena en F6)
