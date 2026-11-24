import { app, define, z } from "@jelou/functions";
import { Bdc } from "./bdc.ts";
import { Shop, sincronizar } from "./shop.ts";

// Adaptador del BDC de Vehicentro. Toda respuesta: {ok, tipo, data, mensaje?}
// con tipo ok | vacio | negocio | indisponible | incierto.
// Secretos: BDC_CLIENT_ID, BDC_CLIENT_SECRET, SHOP_API_KEY. Configuración: BDC_BASE_URL,
// BDC_ID_CONEXION, BDC_CONEXION_POR_MARCA, BDC_ENVIAR_ASESOR, SHOP_APP_ID.

// Tienda de Jelou Shop de la company 13744 (no es secreto; SHOP_APP_ID la reemplaza).
const SHOP_APP_ID = "7188851b-e1dc-4c9d-aaed-a1fe89f45ef1";

type Ctx = { env: { get(k: string): string | undefined }; log: (...a: unknown[]) => void };

function bdc(ctx: Ctx) {
  return new Bdc({
    baseUrl: ctx.env.get("BDC_BASE_URL") ?? "https://bdc.vehicentro.com:9443/ords/ws_vehicentro",
    clientId: ctx.env.get("BDC_CLIENT_ID") ?? "",
    clientSecret: ctx.env.get("BDC_CLIENT_SECRET") ?? "",
    idConexion: ctx.env.get("BDC_ID_CONEXION") ?? "TESTCLARO",
    // Solo en producción (D-32): sin esta variable se sigue usando BDC_ID_CONEXION.
    conexionPorMarca: ctx.env.get("BDC_CONEXION_POR_MARCA") === "true",
    // Solo en producción: con TESTCLARO no se envían id_agencias ni id_asesor (doc del cliente).
    enviarAsesor: ctx.env.get("BDC_ENVIAR_ASESOR") === "true",
    log: (m, e) => ctx.log(m, e ? JSON.stringify(e) : ""),
  });
}

const idMarca = z.coerce.number().int().positive();

export default app({
  config: { timeout: 25_000, mcp: false },
  tools: {
    estado: define({
      description: "Comprueba que el BDC entrega token",
      input: z.object({}),
      handler: async (_i, ctx) => {
        ctx.log("veh_bdc_estado", ctx.env.get("BDC_CLIENT_ID") ? "con credenciales" : "sin credenciales");
        const t = await bdc(ctx).token(true);
        return { ok: !!t, tipo: t ? "ok" : "indisponible", data: null };
      },
    }),
    marcas: define({
      description: "Marcas habilitadas (4.1)",
      input: z.object({}),
      handler: (_i, ctx) => bdc(ctx).marcas(),
    }),
    modelos: define({
      description: "Modelos de una marca (4.2), con la ficha parseada; busqueda opcional por nombre",
      input: z.object({ id_marca: idMarca, busqueda: z.string().optional() }),
      handler: (i, ctx) => bdc(ctx).modelos(i.id_marca, i.busqueda),
    }),
    buscar: define({
      description:
        "Busca vehículos en todas las marcas (o en una si se envía id_marca) por nombre, modelo, segmento o características " +
        "(eléctrico, híbrido, 4x4, 7 pasajeros, pick up, diésel…). Sin consulta devuelve todo el catálogo. " +
        "Cada resultado trae marca, id_marca, id_modelo, sku, precio, etiquetas y coincidencia (exacta | relacionada).",
      input: z.object({
        consulta: z.string().optional().default(""),
        // La tool envía "" o "0" cuando no hay marca: se busca en todas.
        id_marca: z.preprocess((v) => (v === "" || v === "0" || v === 0 || v == null ? undefined : v), idMarca.optional()),
      }),
      handler: (i, ctx) => bdc(ctx).buscar(i.consulta, i.id_marca),
    }),
    agencias: define({
      description: "Agencias de una marca (4.3) y sus ciudades; filtra por ciudad si se envía",
      input: z.object({ id_marca: idMarca, ciudad: z.string().optional() }),
      handler: (i, ctx) => bdc(ctx).agencias(i.id_marca, i.ciudad),
    }),
    asesor: define({
      description: "Asesor por agencia y marca (4.4), respaldo",
      input: z.object({ id_agencia: z.coerce.number().int().positive(), id_marca: idMarca }),
      handler: (i, ctx) => bdc(ctx).asesorDeAgencia(i.id_agencia, i.id_marca),
    }),
    existeAsesor: define({
      description: "Asesor ya asignado al cliente en la marca (4.5)",
      input: z.object({ id_marca: idMarca, celular: z.string(), cedula: z.string().optional() }),
      handler: (i, ctx) => bdc(ctx).existeAsesor(i.id_marca, i.celular, i.cedula),
    }),
    lead: define({
      description:
        "Pide el asesor de la agencia (4.4), registra el lead y devuelve el asesor, id_prospecto e id_usuario_bdc; " +
        "con LISTAS_NEGRAS sale tipo negocio y data.motivo = listas_negras",
      input: z.object({
        id_marca: idMarca,
        celular: z.string(),
        cedula: z.string().optional(),
        nombres: z.string().optional(),
        id_modelo: z.union([z.string(), z.number()]),
        id_agencia: z.union([z.string(), z.number()]).optional(),
        ciudad: z.string().optional(),
        notas: z.string().optional(),
      }),
      config: { methods: ["POST"] },
      handler: (i, ctx) => bdc(ctx).lead(i),
    }),
    sincronizarShop: define({
      description:
        "Sincroniza el catálogo del BDC con Jelou Shop (T027): crea los modelos nuevos, actualiza nombre, precio y " +
        "descripción, y desactiva los que ya no están. Corre a diario por cron; sin cambios si el BDC o el Shop no responden",
      input: z.object({}),
      // D-35: una vez al día es suficiente (precios ~mensuales).
      config: { methods: ["POST"], cron: [{ expression: "0 6 * * *", timezone: "America/Guayaquil", name: "sync-shop" }] },
      handler: (_i, ctx) => {
        const apiKey = ctx.env.get("SHOP_API_KEY") ?? "";
        if (!apiKey) {
          ctx.log("shop_sync_sin_clave", "");
          return { ok: false, tipo: "indisponible", data: null, mensaje: "falta SHOP_API_KEY" };
        }
        const shop = new Shop({
          baseUrl: "https://gateway.jelou.ai/ecommerce",
          appId: ctx.env.get("SHOP_APP_ID") ?? SHOP_APP_ID,
          apiKey,
          log: (m, e) => ctx.log(m, e ? JSON.stringify(e) : ""),
        });
        return sincronizar(bdc(ctx), shop, (m, e) => ctx.log(m, e ? JSON.stringify(e) : ""));
      },
    }),
  },
});
