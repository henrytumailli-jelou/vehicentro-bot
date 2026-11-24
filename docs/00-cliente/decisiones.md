# Decisiones del cliente — Vehicentro

## 2026-11-04 · Reunión «Revisión flujos Vehicentro» (Diio 47d1154e-…)
Participantes por rol: PM del cliente (Vehicentro), PM y comercial del partner (Claro), PM de Jelou, implementador, arquitecto de Jelou.

Acuerdos y pedidos (por clasificar contra el Brief v1.2 = alcance base):
| # | Pedido / acuerdo | Clasificación propuesta |
|---|---|---|
| D-01 | Guardar el origen del lead (página, campaña, grupo de anuncios, anuncio, formulario) de Meta y TikTok. Jelou confirma qué estructura llega en cada caso | Dentro del alcance (registro de la campaña). Acción: implementador |
| D-02 | La validación de asesor asignado se hace por **celular**, sin pedir la cédula al inicio. Con BSUID hay que pedir el celular por WhatsApp | Cambio respecto de la preventa (el Brief preveía esta variante) |
| D-03 | La cédula se pide recién **al cotizar**: el bot invita a cotizar → cédula → ciudad → agencias (API) → el cliente elige agencia → se informa el asesor y la agencia | Cambio de flujo dentro de Flujo_2 |
| D-04 | El bot sigue el contexto si el cliente cambia de marca o de modelo: compara modelos y responde precios y características | Dentro del alcance (agente IA + catálogo) |
| D-05 | Agrupar los mensajes consecutivos: espera de unos 2 s y responde al último. Se ajusta en pruebas | Dentro del alcance (configuración) |
| D-06 | Si detecta interacción negativa o falta de interés: se disculpa y termina, sin insistir | Dentro del alcance (Brief: «si no está interesado, cierra») |
| D-07 | **Envío del prospecto al sistema de Vehicentro (JSON)**, que devuelve el **correo del teleasesor** asignado. Jelou asigna la conversación a ese usuario en PMA. Si abandona después de elegir el modelo, igual se envía lo que haya. El servicio que devuelve el asesor **no existe todavía** del lado del cliente | **Posible ampliación**: el Brief excluye crear o actualizar registros en el CRM → pregunta a Comercial + nuevo insumo [C] |
| D-08 | Recordatorios: hasta 5 (el Brief decía 3), con intervalos, sin mensajes en la noche. Fuera de las 24 h haría falta una plantilla de utilidad (HSM, con costo) | 3→5 es un cambio a confirmar; usar HSM es una **posible ampliación** (el Brief retiró los HSM) |
| D-09 | Si el usuario borra el mensaje predeterminado del anuncio, el bot pide la marca antes de seguir | Dentro del alcance |
| D-10 | Consentimiento: mensaje «al continuar, acepta los términos» con link; si sigue chateando, aceptó | Decisión del cliente; **choca con la regla 17** (H-01) |
| D-11 | Llegan prospectos también por Google Ads y otros medios, no solo por Meta y TikTok | Por aclarar (el Brief solo nombra Meta y TikTok) |

Compromisos:
- Implementador: Brief actualizado (v1.3) con el flujo, las integraciones, la asignación, los recordatorios, la agrupación de mensajes y las interacciones negativas → a la PM del partner, que lo remite al cliente. **Fecha: 2026-11-06.**
- PM del cliente: aprobar el Brief el mismo día que lo reciba.
- PM del partner: pedir el cronograma actualizado tras la aprobación (desarrollo estimado en 21 días hábiles). Fecha: 2026-11-09.

## 2026-11-04 · Resolución de alcance para el Brief v1.3 (implementador)
- D-07 **entra** en v1.3: envío del prospecto (JSON) al sistema de Vehicentro y asignación en PMA por el correo del teleasesor que devuelva. Nuevo insumo del cliente: el servicio que devuelve el asesor asignado (no existe aún).
- D-08 **entra acotado**: máximo **4** recordatorios, con intervalos y sin envíos nocturnos. Los HSM fuera de 24 h **no son obligatorios** (opcionales, con costo aparte; no se comprometen en el alcance).
- D-11 **no entra**: solo Meta y TikTok como origen de campaña.
- Formato: el v1.3 se emite en el mismo formato del Brief (v1.0–v1.2).

## 2026-11-16 · Aclaraciones tras la revisión de las APIs BDC (implementador)
**No se emite un Brief nuevo: se trabaja con el v1.3 aprobado (05/11).** Lo que la documentación de las APIs cambia respecto del texto del v1.3 se resuelve en la spec funcional (F2) como detalle de implementación, sin cambiar el alcance.

| # | Tema | Decisión |
|---|---|---|
| D-12 | Marcas | **4 marcas** (KEYTON, LYNK & CO, SINOTRUK AUTOS, SINOTRUK CAMIONETAS), verificado consumiendo la API 4.1 |
| D-13 | `id_conexion` del lead | Por ahora se usa **TESTCLARO** (pruebas); los de producción por marca quedan pendientes para antes del go-live |
| D-14 | Origen de la campaña | Va **como texto en `notas`** del lead (y en Datum); el BDC no agrega campos |
| D-15 | Datos del lead | El bot **no pregunta** forma de pago ni entrada: no están en el alcance. `notas` se arma con lo que haya en la conversación |
| D-16 | Recordatorios | Se empieza con **un recordatorio cada 1 hora** (máximo 4, dentro de 24 h); se ajusta en pruebas |
| D-17 | Horarios del contact center | No se modelan en el bot: el nodo de atención humana (PMA) evalúa el horario por su cuenta |
| D-18 | Retención en Datum | Se conservan los datos **de forma indefinida** |
| D-19 | Disponibilidad de las APIs | 24/7, según el cliente |
| D-20 | Credenciales OAuth | Entregadas por el cliente; se cargan como secretos en la plataforma, nunca por chat ni en el repo |
| D-21 | Brain | Se construye en `DEV Vehicentro` y se promueve a `EC-02-113-01 Vehicentro` |
| D-22 | Ecommerce WebView | Es el webview que ya existe en Jelou Shop; no se desarrolla |
| D-23 | Asignación del asesor (D-07) | **Primero se registra el lead** (POST, sin `id_asesor`; el BDC lo asigna) y **después se consulta 4.5 Existe asesor**, que devuelve el asesor con su correo para asignar la conversación en PMA. Si 4.5 ya devolvía asesor al inicio, se usa ese. 4.4 queda como respaldo. Por verificar en F5: que el BDC asigna al momento del POST (también con `TESTCLARO`) |
| D-24 | Aprobación de D-07 | No requiere ratificación de Comercial: el proyecto va por partner y el Brief v1.3 aprobado ya lo incluye. Q-CP-1 cerrada |
| D-25 | Persona del asistente | **Un solo asistente de Vehicentro para las 4 marcas** (por ahora); ajusta «persona por marca» del SOW |
| D-26 | Agencia elegida en el lead | El lead se registra con `id_agencias` de la agencia elegida y **sin** `id_asesor`; el BDC asigna el asesor de esa agencia y 4.5 lo devuelve. Respaldo: 4.4 antes del registro. Se verifica en V-01 |
| D-27 | Catálogo (**reemplazada por D-30**) | **Carrusel en el chat** con la API 4.2 (tool «Enviar carrusel modelos», ya existe) en lugar del webview de Jelou Shop, cuyo catálogo está vacío. Cambia el Ecommerce WebView del SOW: hay que avisar al PM y al partner antes de la UAT |
| D-28 | Asesor del lead (reemplaza D-23 y D-26) | **V-01 falló**: tras el POST con TESTCLARO, 4.5 no devuelve asesor. Se usa el flujo documentado del cliente: con la agencia elegida, **4.4 da el asesor y su correo antes del registro**; se asigna en PMA con ese correo. En producción el lead lleva `id_agencias` e `id_asesor` (`BDC_ENVIAR_ASESOR=true`); en pruebas (TESTCLARO) no se envían. 4.4 no se llama en pruebas internas sin acuerdo del cliente (reparto real de leads, A-09) |
| D-29 | Asignación a PMA (provisional) | Hasta tener un operador de prueba en PMA (V-03), «Derivar a Asesor» responde solo «Aquí va la asignación a PMA.» en lugar del `CONNECT`. Se reemplaza por el `CONNECT` con sus 4 salidas en T011, **antes de cerrar F5** |
| D-30 | Catálogo en Jelou Shop (reemplaza D-27) | 2026-11-17, pedido de quien retoma el proyecto: el catálogo vuelve a **Jelou Shop**, como dice el SOW. Los 10 modelos de la API 4.2 se cargan en el Shop con un script (`scripts/shop-catalogo/` en `main`): SKU `VEH-<id_modelo>`, categoría = marca, precio en USD, descripción y fotos del BDC. El agente de Ventas muestra el **carrusel del Shop** (tool `search_and_send_products_webview` de la app Jelou Shop con `presentation: "carousel"`; la nativa `search_products` solo devuelve datos, V-08) en lugar de la tool «Enviar carrusel modelos». **Precio y ficha escritos siguen saliendo del BDC en vivo** (RN-05). La sincronización BDC → Shop será una Function con un job cada hora (después; mientras tanto se corre el script). Se vuelve a cumplir el SOW, así que ya no hay que avisar al cliente del cambio de D-27 |

## 2026-11-18 · Respuestas del cliente y minuta de seguimiento (correos del partner, 18 y 23/11)

| # | Tema | Decisión |
|---|---|---|
| D-31 | Términos y política de datos (C-05) | **Un solo link** para términos y política: `https://vehicentro.com/politicaprivacidad` (cliente, 18/11; el implementador confirmó el 24/11 que vale para ambos). El cliente no indicó versión: se usa **v1**; si cambia el texto se sube la versión y el bot vuelve a pedir la autorización (regla 17) |
| D-32 | `id_conexion` de producción (C-02) | Es el `codigo` que devuelve `botwa_marcas` para cada marca y va en el `:ID` del POST del lead. Reemplaza en producción el valor fijo de D-13; hay que adaptar `veh-bdc` antes del go-live |
| D-33 | Correo del teleasesor (C-06) | El POST del lead devuelve el correo del asesor como variable de salida (documento actualizado del cliente, 18/11). Se revisa en T010/T011 si cambia D-28 (asesor por 4.4 antes del lead) |
| D-34 | Pruebas de asignación (A-09) | Consultar asesores no afecta el reparto. Los POST de prueba van con `id_agencias` e `id_asesor` en null (coincide con D-28); la asignación real se prueba junto con el cliente |
| D-35 | Sincronización del catálogo (T027) | **Una vez al día** es suficiente: los precios cambian cerca de una vez al mes y los modelos nuevos son raros (minuta 18/11). Reemplaza «cada hora» de T027 |
| D-36 | Anuncio de prueba Meta/TikTok (C-08) | Se hace en una fase posterior; no bloquea la construcción (minuta 18/11) |
