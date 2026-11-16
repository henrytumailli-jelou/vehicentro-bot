# Spec funcional — Vehicentro · Fase 1

Archivo: `docs/04-implementacion/02-spec/spec.md` · Fase 2 · **Borrador v0.1**
SOW de origen: `01-sow/sow.json` v1.3 (aprobado por el cliente el 05/11/2026) + `docs/00-cliente/decisiones.md` D-12..D-24 · Fecha: 2026-11-16

> Qué ve y necesita la persona, no cómo se construye (eso va en F3). Los ids de historia,
> regla e integración son los del SOW. Los pasos se escriben `<flujo>:<paso>` (F1 = Flujo_1,
> F2 = Flujo_2, T1 = transversal). **Las decisiones D-12..D-24 ajustan el texto del SOW sin
> cambiar el alcance**: no hay versión nueva del SOW (decisión del implementador; F1 aprobada
> por la PM con esa excepción).

## Resumen del recorrido

```
Anuncio Meta/TikTok → F1:P1 entrada → origen guardado (F1:P2)
 → P0 consentimiento (regla 17) → F1:P9 marca e intención (AI Router; F1:P10–P11 si no se infiere)
   ├─ Repuestos / Talleres / sin marca tras preguntar → PMA (F1:P20)
   ├─ Sin interés → cierre (F1:P13)
   └─ Comercial → F1:P4–P5 celular (si llega BSUID) → F1:P6–P7 ¿ya tiene asesor en esa marca? (4.5)
        ├─ Sí → datos del asesor y fin (F1:P8)
        └─ No → F1:P12 persona de la marca → Flujo_2
Flujo_2: F2:Q1–Q3 catálogo y comparación (4.2) · F2:Q4 webview de Shop
 → F2:Q5–Q6 cédula → F2:Q7 ciudad → F2:Q8–Q9 agencia (4.3)
 → F2:Q10 registro del lead (POST) y consulta del asesor asignado (4.5) → F2:Q11 quién lo atiende → F2:Q12 asignación en PMA
Transversal T1: recordatorios por abandono (R1–R8), agrupación de mensajes, cierre ante interacción negativa
Contingencia: F2:Q20 ante cualquier API que no responde → PMA
```

**Cambio de orden frente al simulador del SOW:** el SOW consulta el asesor (F1:P6) antes de conocer la marca (F1:P9). La API 4.5 exige la marca, así que **primero se identifica la marca y después se consulta el asesor** (revisión de APIs, A-03).

---

## Historias de usuario

### HU-02 — Términos y autorización de datos (Prioridad: P1) · obligatoria (regla 17)

**Flujo:** todos · **Pasos:** P0 (agregado por la constitución) + F1:P3 · **Ejecución:** determinista · **Canal:** WhatsApp

El SOW (RN-02) acordó con el cliente una aceptación **implícita** («al continuar acepta…», sin botones). La constitución (regla 17) exige **Acepto / No acepto** antes de cualquier dato personal. Esta spec escribe la HU según la regla 17; la diferencia con lo acordado es el hallazgo **H-01**, que decide el Tech Lead con el cliente (ver «Cambios frente al SOW por la constitución»). Si el Tech Lead y el cliente mantienen la versión implícita, se reporta en QA con tipo «decisión del cliente» y la puerta de F6 no avanza hasta que el Tech Lead resuelva.

**Criterios de aceptación:**
1. **Dado** un usuario sin autorización registrada, **cuando** escribe por primera vez, **entonces** recibe la bienvenida con el link a los términos y a la política de datos de Vehicentro y los botones **Acepto** / **No acepto**, **antes** de que se le pida celular, cédula o cualquier otro dato personal.
2. **Dado** que toca **Acepto**, **entonces** se registra: identificador de WhatsApp, canal, versión de los términos, decisión y fecha y hora, y el flujo sigue a la identificación de marca.
3. **Dado** que toca **No acepto**, **entonces** el bot no pide ni guarda datos personales, registra el rechazo y ofrece **hablar con un asesor** en la misma conversación (el SOW no incluye «información general» como alternativa).
4. **Dado** un usuario que aceptó hace **30 días o menos** con la versión vigente, **cuando** vuelve a escribir, **entonces** no se le pide de nuevo.
5. **Dado** un usuario cuya aceptación tiene **más de 30 días** o cambió la versión de los términos, **cuando** vuelve a escribir, **entonces** se le pide de nuevo.
6. **Dado** un recordatorio (T1:R3), **entonces** no se pide ni se refresca la autorización en ese mensaje; solo cuando el usuario inicia.
7. **Dado** que escribe texto en vez de tocar un botón, **entonces** solo un texto **idéntico** a la etiqueta del botón cuenta como decisión; cualquier otro texto no se registra como decisión y se vuelve a preguntar **una vez**, con la opción de hablar con un asesor.
8. **Dado** que no aceptó o no decidió, **entonces** no se guarda ningún dato personal (tampoco el celular).

**Datos del cliente:** link de términos y de política de datos, versión vigente. Ley: LOPDP (Ecuador). Son un insumo del cliente (dependencias del SOW), no una marca.

---

### HU-04 — Marca e intención (Prioridad: P1) 🎯 MVP

**Flujo:** Flujo_1 · **Pasos:** F1:P9, F1:P10, F1:P11, F1:P12, F1:P13, F1:P20 · **Ejecución:** IA (AI Router) + determinista (lista de marcas) · **Integración:** INT-2 (4.1 Marcas)

El prospecto escribe libremente (o con el mensaje predeterminado del anuncio) y el bot entiende de qué marca habla y qué quiere.

**Prueba independiente:** un usuario escribe «quiero info de la camioneta Sinotruk» y el bot responde con la persona de SINOTRUK CAMIONETAS; otro escribe «hola» y el bot le muestra la lista de marcas.

**Criterios de aceptación:**
1. **Dado** un mensaje del que se puede inferir la marca (anuncio o texto), **cuando** el router lo evalúa, **entonces** el bot sigue con esa marca sin preguntarla.
2. **Dado** que no se puede inferir la marca (p. ej. el usuario borró el mensaje predeterminado), **entonces** el bot muestra una **lista interactiva con las 4 marcas** que devuelve la API 4.1 (KEYTON, LYNK & CO, SINOTRUK AUTOS, SINOTRUK CAMIONETAS) y no avanza al catálogo hasta que elija.
3. **Dado** que tras la lista **no elige una marca** (escribe otra cosa dos veces), **entonces** se deriva a PMA con la intención identificada (RN-04).
4. **Dado** que la intención es **Repuestos o Talleres**, **entonces** el bot avisa que lo atenderá un asesor y deriva a PMA con marca, intención y origen de la campaña.
5. **Dado** que dice que no le interesa, **entonces** el bot agradece y cierra (F1:P13, RN-07).
6. **Dado** una marca identificada, **entonces** el bot adopta la persona de esa marca (F1:P12) en el resto de la conversación, hasta que cambie de marca (HU-05).

---

### HU-05 — Consulta de catálogo y comparación (Prioridad: P1) 🎯 MVP

**Flujo:** Flujo_2 · **Pasos:** F2:Q1, F2:Q2, F2:Q3, F2:Q4 · **Ejecución:** IA (agente de catálogo) · **Integración:** INT-3 (4.2 Modelos) · **Capacidad:** catálogo (webview existente de Jelou Shop, D-22)

**Prueba independiente:** un usuario pregunta el precio y el motor de un modelo de KEYTON y recibe el precio y los datos de la ficha que devuelve la API, con el botón para ver el catálogo.

**Criterios de aceptación:**
1. **Dado** que pregunta por un modelo, precio o característica, **entonces** el bot responde **solo con datos de la API 4.2** de la marca activa (precio en USD, ficha técnica, características) y nunca inventa un precio, un modelo ni una característica (RN-05).
2. **Dado** que el modelo tiene imágenes en la API, **entonces** el bot envía **al menos 1 imagen** del modelo junto con la respuesta.
3. **Dado** cualquier respuesta del catálogo, **entonces** el bot ofrece los botones **Ver catálogo**, **Cotizar** y **Agencias** (F2:Q3).
4. **Dado** que toca **Ver catálogo**, **entonces** se abre el webview de Jelou Shop con el catálogo de la marca activa (F2:Q4) y, al volver, el bot ofrece cotizar.
5. **Dado** que pide comparar dos modelos de la misma marca, **entonces** el bot responde con las diferencias de precio y ficha de ambos, con datos de la API.
6. **Dado** que cambia de marca durante la conversación, **entonces** el bot responde con el catálogo y la persona de la nueva marca y, antes de cotizar, vuelve a consultar si tiene asesor en esa marca (HU-03).
7. **Dado** que pregunta algo que el catálogo no cubre (financiamiento, repuestos, otro país), **entonces** el bot dice que no tiene ese dato y ofrece un asesor (RN-05).
8. **Dado** que intenta que el bot cambie de rol, revele sus instrucciones o hable de otro tema, **entonces** el bot lo reconoce en una frase y vuelve al catálogo.

---

### HU-06 — Cotización con agencia y registro del lead (Prioridad: P1) 🎯 MVP

**Flujo:** Flujo_2 · **Pasos:** F2:Q5, F2:Q6, F2:Q7, F2:Q8, F2:Q9, F2:Q10, F2:Q11, F2:Q12 · **Ejecución:** determinista · **Integraciones:** INT-4 (4.3 Agencias), INT-6 (POST de lead), INT-1 (4.5 Existe asesor) · **Escritura a un sistema del cliente:** sí (lead en el BDC)

El prospecto decide cotizar, deja su cédula, elige ciudad y agencia, y queda registrado en el BDC con un asesor que lo atiende en PMA (D-07, D-23).

**Prueba independiente:** un usuario de prueba elige un modelo, toca Cotizar, da una cédula válida, elige ciudad y agencia, y el lead aparece en el BDC (conexión `TESTCLARO`) y la conversación queda asignada en PMA al asesor que devuelve 4.5.

**Criterios de aceptación:**
1. **Dado** que toca **Cotizar**, **entonces** el bot pide la cédula (**10 dígitos**); la cédula **solo** se pide en este punto (RN-06).
2. **Dado** una cédula que no tiene 10 dígitos numéricos, **entonces** el bot la vuelve a pedir **1 vez**; al segundo error deriva a PMA con el contexto (RN-06).
3. **Dado** una cédula válida, **entonces** el bot muestra **las ciudades donde la marca tiene agencias** (según 4.3) como lista interactiva; si son más de 10, la lista se pagina.
4. **Dado** que elige una ciudad, **entonces** el bot muestra **solo las agencias de la marca en esa ciudad**, con nombre, dirección y horario, como lista interactiva (F2:Q9).
5. **Dado** que elige una agencia y la marca y el modelo son conocidos, **entonces** se registra el lead en el BDC (F2:Q10) con: nombres, celular, cédula, modelo, ciudad y unas `notas` (máximo **1000** caracteres) con la marca, los modelos consultados, la agencia elegida y el origen de la campaña (D-14). No se preguntan forma de pago ni entrada (D-15).
6. **Dado** que el lead se registró (201), **entonces** se consulta 4.5 con la marca, la cédula y el celular, y el asesor que devuelve es el que atiende.
7. **Dado** que 4.5 devuelve un asesor, **entonces** el bot informa «Le atenderá {nombre del asesor} de la agencia {agencia}» (F2:Q11) y asigna la conversación en PMA **al usuario de PMA con el correo de ese asesor**, con marca, modelos consultados, agencia, ciudad y origen (F2:Q12).
8. **Dado** que el correo del asesor no existe como usuario de PMA, **entonces** la conversación va a la cola general de PMA con el mismo contexto (RN-08).
9. **Dado** que el usuario **ya tenía asesor** en esa marca (HU-03 o una consulta anterior), **entonces** no se registra un lead nuevo: se informa su asesor y se asigna en PMA.

**La misma solicitud (escritura al BDC):** un lead se identifica por **celular + marca**. Dentro de una conversación, el bot registra **como máximo 1 lead por marca**; si el usuario vuelve a cotizar la misma marca (aunque cambie de modelo o de agencia), no se registra otro: se le informa el asesor ya asignado. Una marca distinta es un lead distinto.

**Resultado incierto** (el registro no responde o responde un error que no es 400): el bot **no reintenta el registro**; consulta 4.5. Si 4.5 ya devuelve un asesor, sigue como en el criterio 7. Si no, dice «Estamos confirmando su registro; un asesor continuará con usted por este chat» y deriva a la cola general de PMA. Nunca pide al usuario que vuelva a intentarlo.

---

### HU-09 — Contingencia de servicios (Prioridad: P1)

**Flujo:** Flujo_1 y Flujo_2 · **Pasos:** F1:P7 (rama «servicio no responde»), F1:P20, F2:Q2, F2:Q8, F2:Q10 (ramas de error), F2:Q20 · **Ejecución:** determinista

**Criterios de aceptación:**
1. **Dado** que cualquier API del cliente no responde o devuelve error, **entonces** el bot envía un mensaje de contingencia y deriva a PMA con la marca y el contexto disponible, sin cortar la conversación (RN-09).
2. **Dado** que una API de consulta responde **sin resultados** (lista vacía), **entonces** no se trata como error: el bot lo dice («No encontramos agencias de {marca} en {ciudad}») y ofrece otra opción (otra ciudad o un asesor).
3. **Dado** un error del servicio, **entonces** el usuario nunca ve el mensaje técnico ni el código de error.

---

### HU-03 — Asesor ya asignado (Prioridad: P2)

**Flujo:** Flujo_1 · **Pasos:** F1:P4, F1:P5, F1:P6, F1:P7, F1:P8 · **Ejecución:** determinista · **Integración:** INT-1 (4.5 Existe asesor)

**Prueba independiente:** con un celular que ya tiene asesor en una marca, el bot entrega el nombre y el contacto del asesor y termina.

**Criterios de aceptación:**
1. **Dado** que se conoce la marca y Meta entrega el celular, **entonces** el bot consulta 4.5 con la marca y el celular (cédula vacía) **sin pedir nada al usuario**.
2. **Dado** que Meta **no** entrega el celular (BSUID), **entonces** el bot pide el celular; acepta **10 dígitos que empiezan con 09** (o el mismo número con +593); si no es válido lo pide **1 vez** más y, si vuelve a fallar, sigue al catálogo sin la consulta (RN-03).
3. **Dado** que 4.5 devuelve un asesor, **entonces** el bot envía «Usted ya tiene un asesor asignado: {nombre}. Puede escribirle al {contacto}» y termina (F1:P8).
4. **Dado** que 4.5 no devuelve asesor, **entonces** el bot sigue a la persona de la marca y al catálogo (F1:P12).
5. **Dado** un usuario sin celular válido que llega a cotizar, **entonces** el bot le pide el celular antes de registrar el lead (HU-06); si no lo da, deriva a PMA.

---

### HU-01 — Origen de la campaña (Prioridad: P2)

**Flujo:** Flujo_1 · **Pasos:** F1:P1, F1:P2 · **Ejecución:** determinista

**Criterios de aceptación:**
1. **Dado** que el usuario llega desde un anuncio de Meta o TikTok, **entonces** se guarda en Datum lo que entregue la plataforma: página, campaña, grupo de anuncios, anuncio y formulario; los campos que no lleguen quedan vacíos y la conversación sigue (RN-01).
2. **Dado** que se registra el lead, **entonces** el origen va como texto en sus `notas` (D-14).
3. **Dado** que el usuario llega sin anuncio (escribe directo), **entonces** el origen queda como «directo».

---

### HU-08 — Conversación natural (Prioridad: P2)

**Flujo:** transversal · **Pasos:** F1:P13, T1:R7 (cierre) · **Ejecución:** mixta

**Criterios de aceptación:**
1. **Dado** que el usuario envía varios mensajes seguidos, **cuando** pasan **2 segundos** sin un mensaje nuevo, **entonces** el bot responde **una sola vez** considerando todos (valor inicial; se ajusta en pruebas).
2. **Dado** que dice que no le interesa o responde de forma agresiva, **entonces** el bot se disculpa, agradece y termina **sin repetir** ninguna pregunta pendiente (RN-07).
3. **Dado** que envía un audio, una imagen o un sticker donde se espera una opción, **entonces** el bot le pide elegir una de las opciones mostradas.

---

### HU-07 — Recordatorios por abandono (Prioridad: P3)

**Flujo:** transversal T1 · **Pasos:** T1:R1, R2, R3, R4, R5, R6, R7, R8 · **Ejecución:** determinista · **Escritura a un sistema del cliente:** sí (lead no gestionado)

**Criterios de aceptación:**
1. **Dado** que el usuario deja de responder en cualquier punto, **entonces** recibe un recordatorio **1 hora** después de su último mensaje, y luego cada **1 hora**, hasta **4** recordatorios (D-16).
2. **Dado** que un recordatorio cae en la **franja nocturna (21:00 a 07:59, hora de Ecuador)**, **entonces** no se envía en ese momento: se envía a las 08:00 si sigue dentro de la ventana de 24 horas; si no, ya no se envía.
3. **Dado** que pasaron **24 horas** desde el último mensaje del usuario, **entonces** no se envía ningún recordatorio más.
4. **Dado** un recordatorio, **entonces** lleva los botones **Continuar** y **No me interesa**; **Continuar** retoma donde quedó y **No me interesa** cierra sin insistir.
5. **Dado** que se agotan los 4 recordatorios (o vence la ventana) y el usuario **ya eligió un modelo** sin tener lead registrado, **entonces** se registra el lead en el BDC como **no gestionado**, sin agencia ni asesor (lo asigna el BDC), con los datos disponibles (D-07).
6. **Dado** que abandona **antes de elegir un modelo**, **entonces** no se registra lead en el BDC (el modelo es obligatorio); el abandono queda en Datum.
7. **Dado** que abandona sin celular (BSUID sin respuesta), **entonces** no se registra lead en el BDC (el celular es obligatorio); queda en Datum.

---

## Casos borde
| Caso | Qué pasa |
|---|---|
| Una API no responde o tarda | Contingencia y PMA (HU-09); nunca se deja al usuario sin respuesta |
| Texto libre donde se esperaba una opción | Se repite la pregunta 1 vez con las opciones; al segundo intento, salida a un asesor |
| Audio, imagen o sticker donde se esperaba una opción | Se le pide elegir una opción (HU-08) |
| Abandona y vuelve antes de 24 h | Retoma donde quedó (por recordatorio o escribiendo) |
| Vuelve después de 24 h | Empieza de nuevo desde la marca; el consentimiento se respeta si tiene 30 días o menos |
| Cotiza dos veces la misma marca | No se duplica el lead (HU-06, «La misma solicitud») |
| Cotiza dos marcas distintas | Un lead por marca |
| Cambia de marca a mitad del catálogo | Persona y catálogo de la nueva marca; consulta de asesor para esa marca antes de cotizar |
| La marca no tiene agencias en la ciudad elegida | Lo dice y ofrece otra ciudad o un asesor |
| Más de 10 ciudades o agencias | Lista paginada |
| Abre el webview y no vuelve | Cuenta como inactividad: aplica HU-07 |
| Interacción agresiva | Cierre cordial inmediato (HU-08) |
| El correo del asesor no está en PMA | Cola general de PMA (HU-06) |

## Requisitos funcionales
- **RF-000**: El agente DEBE obtener y registrar la aceptación de términos y la autorización de datos (Acepto / No acepto) antes de pedir datos personales, y refrescarla cuando tenga más de 30 días o cambie la versión de los términos, solo cuando el usuario inicia la conversación. *(HU-02, regla 17)*
- **RF-001**: El agente DEBE guardar el origen de la campaña que entregue Meta o TikTok y asociarlo al usuario y al lead. *(RN-01)*
- **RF-002**: El agente DEBE identificar la marca antes de mostrar el catálogo o consultar el asesor; si no la infiere, DEBE preguntarla con una lista de las marcas de la API 4.1. *(RN-04, D-12)*
- **RF-003**: El agente DEBE consultar si el usuario tiene asesor en la marca (4.5) usando el celular; si Meta no entrega el celular, DEBE pedirlo (10 dígitos, empieza con 09; 1 reintento). *(RN-03, H-02)*
- **RF-004**: El agente DEBE responder precios, modelos y fichas solo con datos de la API 4.2; lo que el catálogo no cubre se deriva a un asesor. *(RN-05)*
- **RF-005**: El agente DEBE pedir la cédula solo al cotizar y validar que tenga 10 dígitos (1 reintento; al segundo error, PMA). *(RN-06)*
- **RF-006**: El agente DEBE mostrar solo las agencias de la marca en la ciudad elegida, con nombre, dirección y horario.
- **RF-007**: El agente DEBE registrar el lead en el BDC con marca y modelo conocidos, y después obtener el asesor asignado con 4.5 para asignar la conversación en PMA por su correo; sin usuario de PMA con ese correo, cola general. *(RN-08, D-07, D-23)*
- **RF-008**: Dos registros con el mismo **celular + marca** son el mismo lead: el agente DEBE registrar como máximo 1 lead por marca y conversación. Ante un resultado incierto, DEBE verificar con 4.5 y, si no hay asesor, informar que está confirmando el registro y derivar a PMA; nunca pedir que lo reintente. *(AP-35)*
- **RF-009**: El agente DEBE cerrar sin insistir ante falta de interés o interacción negativa. *(RN-07)*
- **RF-010**: El agente DEBE agrupar los mensajes que lleguen con menos de 2 s de diferencia y responder una vez. *(D-05)*
- **RF-011**: El agente DEBE enviar hasta 4 recordatorios, cada 1 hora, dentro de 24 h y fuera de la franja 21:00–07:59; agotados, registrar el lead como no gestionado si ya hay modelo y celular. *(RN-10, D-16)*
- **RF-012**: Ante una API que no responde, el agente DEBE enviar un mensaje de contingencia y derivar a PMA con el contexto; una lista vacía no es un error. *(RN-09)*
- **RF-013**: Toda pregunta con opciones DEBE ir como mensaje interactivo (botones o lista). *(regla 11)*
- **RF-014**: El agente DEBE registrar en Datum el viaje del usuario (flujo, pasos, punto de abandono, derivación) aunque no complete el flujo. *(F-A2)*
- **RF-015**: Al derivar a PMA, el agente DEBE enviar marca, intención, modelos consultados, agencia y ciudad (si existen) y origen de la campaña. *(F-A1)*

## Tono y textos fijos
| Qué | Valor | Fuente |
|---|---|---|
| Tratamiento | **usted** | SOW, agentes F1/F2/T1 |
| Tono | cercano y comercial; el bot adopta la personalidad de la marca identificada | SOW (`idioma_tono`) |
| Persona por marca | [NECESITA ACLARACIÓN: nombre y rasgos del asistente para cada una de las 4 marcas (KEYTON, LYNK & CO, SINOTRUK AUTOS, SINOTRUK CAMIONETAS), o confirmar que es un solo asistente «Vehicentro» con el nombre de la marca] | SOW: «POR DEFINIR (persona por marca)» |
| Bienvenida | «¡Hola! Soy el asistente virtual de Vehicentro…» + link de términos — **se ajusta** para llevar los botones Acepto / No acepto (HU-02) | SOW F1:P3 |
| Asesor ya asignado | «Usted ya tiene un asesor asignado: {nombre}. Puede escribirle al {contacto}.» | SOW F1:P8 |
| Pedir marca | «¿Qué marca le interesa?» + lista | SOW F1:P10 |
| Sin interés | «Entendido, gracias por su tiempo. Si más adelante desea información, aquí estaremos.» | SOW F1:P13 |
| Pedir cédula | «Con gusto preparamos su cotización. ¿Me ayuda con su número de cédula?» | SOW F2:Q5 |
| Pedir ciudad | «¿En qué ciudad le gustaría ser atendido?» → como lista de ciudades (RF-013) | SOW F2:Q7 |
| Quién lo atiende | «Listo. Le atenderá {nombre_asesor} de la agencia {agencia}. En breve continuará con usted por este chat.» | SOW F2:Q11 |
| Recordatorio | «¿Sigue interesado en el {modelo}? Puedo ayudarle a cotizarlo cuando guste.» [Continuar] [No me interesa] | SOW T1:R3 |
| Cierre | «Entendido, gracias por su tiempo.» | SOW T1:R7 |
| Contingencia | Por redactar en F3 con el mismo tono (no lo trae el SOW) | — |

## Horario y calendario
| Qué | Valor | Fuente |
|---|---|---|
| Bot | 24/7 | SOW |
| Atención de asesores (PMA) | **No la modela el bot**: el nodo de atención humana evalúa el horario y lo que pasa fuera de él | D-17 |
| Franja sin recordatorios | 21:00 a 07:59, todos los días, America/Guayaquil | Supuesto (ver «Supuestos») |
| Feriados | No aplican al bot; los gestiona PMA | D-17 |
| Zona horaria | America/Guayaquil | SOW |

## Entidades clave
- **Usuario** (Datum): identificador de WhatsApp, celular, cédula, marca de origen, marca de interés, versión de términos, decisión y fecha. Retención indefinida (D-18).
- **Viaje** (Datum): flujo, pasos, punto de abandono, derivación a PMA.
- **Lead**: fuente de verdad en el **BDC de Vehicentro** (POST); copia en Datum con origen, marca, modelo, agencia, ciudad, intención, asesor asignado y estado (registrado, no gestionado, derivado).
- **Asesor**: fuente de verdad en el BDC (4.5 / 4.4); se usa su correo para PMA.
- **Catálogo**: fuente de verdad en la API 4.2; el webview de Jelou Shop muestra su propio catálogo (ver supuesto S-04).

## Criterios de éxito (propuestos; se revisan en F9)
- **CE-001**: ≥ **90 %** de las conversaciones con intención Comercial terminan con la marca identificada (por el router o la lista).
- **CE-002**: **0** leads duplicados por celular + marca en el BDC durante la estabilización.
- **CE-003**: **0** respuestas con un precio o modelo que no esté en la API 4.2.
- **CE-004**: **100 %** de los leads registrados quedan asignados en PMA a un asesor o a la cola general (ninguno sin destino).
- **CE-005**: **100 %** de los usuarios que dieron datos personales tienen su aceptación registrada antes del primer dato.
- **CE-006**: Leads registrados por día y tasa de cotización (cotizaciones / conversaciones Comerciales), como línea base para el cliente.

## Supuestos
- **S-01 (plataforma / tercero):** al recibir el lead **sin** `id_asesor`, el BDC asigna un asesor al momento y 4.5 lo devuelve en la consulta siguiente, también con la conexión `TESTCLARO`. Se verifica en F5 (**V-01**).
- **S-02:** [NECESITA ACLARACIÓN: ¿el BDC asigna un asesor **de la agencia que eligió el usuario**? La documentación pide `id_agencias` solo «si hay asesor». Si el BDC no respeta la agencia elegida, el asesor puede ser de otra agencia: ¿se envía `id_agencias` sin `id_asesor`, o se usa 4.4 para pedir el asesor de esa agencia antes del registro?]
- **S-03:** franja sin recordatorios 21:00–07:59 (el SOW dice «sin envíos nocturnos» sin horas). Se confirma en la UAT.
- **S-04:** el catálogo del webview de Jelou Shop tiene los mismos modelos y precios que la API 4.2 (RN-05). Si difieren, el usuario vería dos precios. Responsable: implementador + cliente; se verifica en F3.
- **S-05:** el nombre para el lead se toma del **nombre del perfil de WhatsApp**; si viene vacío, se registra «Cliente WhatsApp». No se pregunta (D-15: no se agregan preguntas fuera de alcance).
- **S-06 (plataforma):** Meta entrega el origen del anuncio (click-to-WhatsApp); qué entrega TikTok se confirma en F3 (Q-9).
- **S-07 (insumo pendiente):** `id_conexion` de producción por marca — responsable: cliente — fecha: antes de F8 — `insumos_pendientes` C-02 · HU-06, HU-07. Mientras tanto, `TESTCLARO` (D-13).
- **S-08 (insumo pendiente):** link de términos y política de datos — responsable: cliente — antes de F5 · HU-02.
- **S-09:** los teleasesores existen como usuarios de PMA con el mismo correo que devuelve el BDC — responsable: cliente — antes de la UAT · HU-06.

## Fuera de alcance
Flujos de repuestos y de taller (solo se derivan), OCR, HSM y campañas, comentarios en redes, geo-fencing, precalificación y buró, crédito directo (el flujo «Crédito Directo» que existe en DEV no se toca), biometría y firma, pagos, otros canales y números, Colombia, iframe/SSO en el CRM, actualización de registros existentes del CRM, y preguntar forma de pago o entrada (D-15).

## Trazabilidad
| HU | Flujo | Pasos del simulador | RF | CE |
|---|---|---|---|---|
| HU-02 | todos | **P0 (regla 17, agregado)**, F1:P3 | RF-000 | CE-005 |
| HU-01 | Flujo_1 | F1:P1, F1:P2 | RF-001, RF-014 | CE-006 |
| HU-04 | Flujo_1 | F1:P9, F1:P10, F1:P11, F1:P12, F1:P13, F1:P20 | RF-002, RF-009, RF-015 | CE-001 |
| HU-03 | Flujo_1 | F1:P4, F1:P5, F1:P6, F1:P7, F1:P8 | RF-003 | — |
| HU-05 | Flujo_2 | F2:Q1, F2:Q2, F2:Q3, F2:Q4 | RF-004, RF-013 | CE-003 |
| HU-06 | Flujo_2 | F2:Q5, F2:Q6, F2:Q7, F2:Q8, F2:Q9, F2:Q10, F2:Q11, F2:Q12 | RF-005, RF-006, RF-007, RF-008, RF-015 | CE-002, CE-004, CE-006 |
| HU-09 | Flujo_1, Flujo_2 | F1:P7 (rama de error), F1:P20, F2:Q20 | RF-012 | CE-004 |
| HU-08 | transversal | F1:P13, T1:R7 | RF-009, RF-010 | — |
| HU-07 | T1 | T1:R1, T1:R2, T1:R3, T1:R4, T1:R5, T1:R6, T1:R7, T1:R8 | RF-011, RF-014 | — |

Pasos de fin (F1:P21, F2:Q21) pertenecen a la HU del paso que los precede. Todos los pasos del simulador tienen HU.

**Pasos que cambian frente al simulador del SOW** (por las APIs reales, sin cambio de alcance):
| Paso | En el SOW | En esta spec | Por qué |
|---|---|---|---|
| F1:P2 | Registro del origen en el BDC (INT-6) | Se guarda en Datum; va al BDC en `notas` del lead | INT-6 es el ingreso de lead (A-02, D-14) |
| F1:P4–P7 | Antes de identificar la marca | Después de F1:P9 | 4.5 exige la marca (A-03) |
| F2:Q10 | Servicio que devuelve el correo del asesor (INT-5) | POST de lead + consulta 4.5 | INT-5 no existe (A-01, D-23) |
| T1:R6 | Envío de «datos disponibles» | Solo si hay modelo y celular; si no, solo Datum | Campos obligatorios del lead (A-06) |

## Cambios frente al SOW por la constitución
| Qué se agrega | Regla | Efecto | Aviso |
|---|---|---|---|
| Paso P0: Acepto / No acepto antes de cualquier dato, con evidencia y refresco a 30 días | 17 | La bienvenida (F1:P3) pasa de aviso implícito a mensaje con 2 botones; +1 interacción al inicio; camino de rechazo con asesor | **H-01:** lo decide el Tech Lead (D. B.) con el cliente. Borrador de aviso a la PM pendiente (los avisos los hace el implementador) |

## Marcas abiertas (para cerrar antes de la puerta de F2)
1. Persona por marca (Tono y textos fijos).
2. Asignación por agencia elegida (S-02).
