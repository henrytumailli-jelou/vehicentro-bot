import { assert, assertEquals } from "jsr:@std/assert@1";
import type { Bdc } from "./bdc.ts";
import { datosFicha, producto, Shop, sincronizar } from "./shop.ts";

// BDC simulado: solo marcas() y modelos(), con la forma que devuelve bdc.ts.
// deno-lint-ignore no-explicit-any
function bdcFalso(marcas: any, modelos: Record<number, any>): Bdc {
  return {
    marcas: () => Promise.resolve(marcas),
    modelos: (id: number) => Promise.resolve(modelos[id] ?? { ok: true, tipo: "vacio", data: [] }),
  } as unknown as Bdc;
}

// Shop simulado: guarda lo que se envía al upsert.
// deno-lint-ignore no-explicit-any
function shopFalso(actuales: any[] | "caido", upsertStatus = 202) {
  // deno-lint-ignore no-explicit-any
  const enviados: any[] = [];
  const llamadas: string[] = [];
  const f: typeof fetch = (url, init) => {
    const u = String(url);
    llamadas.push(u.includes("upsert") ? "upsert" : "search");
    if (u.includes("/products/search")) {
      if (actuales === "caido") return Promise.resolve(new Response("x", { status: 500 }));
      return Promise.resolve(new Response(JSON.stringify({ data: actuales }), { status: 200 }));
    }
    enviados.push(...JSON.parse(String(init?.body)).resources);
    return Promise.resolve(new Response(JSON.stringify({ count: 1 }), { status: upsertStatus }));
  };
  return { shop: new Shop({ baseUrl: "https://x", appId: "app", apiKey: "k", fetch: f, timeoutMs: 1000 }), enviados, llamadas };
}

const marcas = { ok: true, tipo: "ok", data: [{ id: 3, nombre: "KEYTON" }, { id: 7, nombre: "LYNK & CO" }] };
const m82 = { id_modelo: 82, nombre: "FURGONETA M70L EV", segmento: "VAN", precio: 22990, caracteristicas: "Eléctrica", ficha: null, imagenes: ["https://cdn/a.png"] };
const m139 = { id_modelo: 139, nombre: "LYNK & CO 02", segmento: "SUV", precio: 39890, caracteristicas: "SUV", ficha: null, imagenes: ["https://cdn/b.png"] };
const modelos = {
  3: { ok: true, tipo: "ok", data: [m82] },
  7: { ok: true, tipo: "ok", data: [m139] },
};
// Así queda en la tienda un producto igual al del BDC.
const enTienda = (marca: string, m: typeof m82, extra = {}) => {
  const p = producto(marca, m);
  return { sku: p.sku, name: p.name, description: p.description, price: String(p.price), status: true, categories: [{ name: marca }], media: [{ id: 1 }], ...extra };
};

Deno.test("producto: SKU VEH-<id>, marca en el nombre, categoría = marca, sin impuesto", () => {
  const p = producto("KEYTON", m82);
  assertEquals(p.sku, "VEH-82");
  assertEquals(p.name, "KEYTON FURGONETA M70L EV");
  assertEquals(p.categories, ["KEYTON"]);
  assertEquals(p.has_tax, false);
  assertEquals(producto("LYNK & CO", m139).name, "LYNK & CO 02");
});

Deno.test("datosFicha: lee las claves en cualquier nivel y en orden", () => {
  const f = { info_base: { x: 1 }, especificaciones: { motor: { motor: "1.5 Turbo" }, transmision: ["DCT", "Manual"] } };
  assertEquals(datosFicha(f), ["Motor: 1.5 Turbo", "Transmisión: DCT"]);
  assertEquals(datosFicha(null), []);
});

Deno.test("sync: crea el nuevo con fotos, deja igual el que no cambió y desactiva el que ya no está", async () => {
  const viejo = { sku: "VEH-999", name: "X", description: "d", price: "10", status: true, categories: [{ name: "KEYTON" }], media: [] };
  const { shop, enviados } = shopFalso([enTienda("KEYTON", m82), viejo]);
  const r = await sincronizar(bdcFalso(marcas, modelos), shop);
  assertEquals(r.tipo, "ok");
  assertEquals(r.data!.creados, ["VEH-139"]);
  assertEquals(r.data!.sin_cambios, 1);
  assertEquals(r.data!.desactivados, ["VEH-999"]);
  const nuevo = enviados.find((p) => p.sku === "VEH-139");
  assertEquals(nuevo.images, ["https://cdn/b.png"]);
  assertEquals(enviados.find((p) => p.sku === "VEH-999").status, false);
  assert(!enviados.some((p) => p.sku === "VEH-82"));
});

Deno.test("sync: un cambio de precio actualiza sin volver a mandar las fotos", async () => {
  const { shop, enviados } = shopFalso([enTienda("KEYTON", m82, { price: "21000" }), enTienda("LYNK & CO", m139)]);
  const r = await sincronizar(bdcFalso(marcas, modelos), shop);
  assertEquals(r.data!.actualizados, ["VEH-82"]);
  assertEquals(enviados.length, 1);
  assertEquals(enviados[0].price, 22990);
  assertEquals(enviados[0].images, undefined);
});

Deno.test("sync: un producto sin fotos las recibe", async () => {
  const { shop, enviados } = shopFalso([enTienda("KEYTON", m82, { media: [] }), enTienda("LYNK & CO", m139)]);
  const r = await sincronizar(bdcFalso(marcas, modelos), shop);
  assertEquals(r.data!.actualizados, ["VEH-82"]);
  assertEquals(enviados[0].images, ["https://cdn/a.png"]);
});

Deno.test("sync: todo igual → no llama al upsert", async () => {
  const { shop, llamadas } = shopFalso([enTienda("KEYTON", m82), enTienda("LYNK & CO", m139)]);
  const r = await sincronizar(bdcFalso(marcas, modelos), shop);
  assertEquals(r.data!.sin_cambios, 2);
  assertEquals(llamadas.filter((l) => l === "upsert").length, 0);
});

Deno.test("sync: marcas sin respuesta → no toca la tienda", async () => {
  const { shop, llamadas } = shopFalso([]);
  const r = await sincronizar(bdcFalso({ ok: false, tipo: "indisponible", data: null }, modelos), shop);
  assertEquals(r.tipo, "indisponible");
  assertEquals(llamadas.length, 0);
});

Deno.test("sync: una marca sin respuesta → no toca la tienda", async () => {
  const { shop, llamadas } = shopFalso([enTienda("KEYTON", m82)]);
  const r = await sincronizar(bdcFalso(marcas, { 3: modelos[3], 7: { ok: false, tipo: "indisponible", data: null } }), shop);
  assertEquals(r.tipo, "indisponible");
  assertEquals(llamadas.length, 0);
});

Deno.test("sync: el BDC devuelve 0 modelos → no desactiva el catálogo", async () => {
  const { shop, llamadas } = shopFalso([enTienda("KEYTON", m82)]);
  const r = await sincronizar(bdcFalso(marcas, {}), shop);
  assertEquals(r.tipo, "negocio");
  assertEquals(llamadas.length, 0);
});

Deno.test("sync: el Shop no responde al listar → no hace upsert", async () => {
  const { shop, llamadas } = shopFalso("caido");
  const r = await sincronizar(bdcFalso(marcas, modelos), shop);
  assertEquals(r.tipo, "indisponible");
  assertEquals(llamadas.filter((l) => l === "upsert").length, 0);
});

Deno.test("sync: el Shop rechaza el upsert → indisponible con el resumen", async () => {
  const { shop } = shopFalso([], 422);
  const r = await sincronizar(bdcFalso(marcas, modelos), shop);
  assertEquals(r.tipo, "indisponible");
  assertEquals(r.data!.creados.length, 2);
});
