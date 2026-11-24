// Sincronización diaria del catálogo del BDC con Jelou Shop (T027, D-30, D-35).
// Mismas reglas que scripts/shop-catalogo/cargar.py: SKU = VEH-<id_modelo>, categoría = marca,
// precio en USD sin impuesto, stock ilimitado y descripción = características + datos de la ficha.
// Sin dependencias del runtime de Functions para poder probarlo solo.

import type { Bdc, Resultado } from "./bdc.ts";

export const PREFIJO = "VEH-";

export interface ShopConfig {
  baseUrl: string; // https://gateway.jelou.ai/ecommerce
  appId: string; // id de la tienda (no es secreto)
  apiKey: string; // clave de API de la company (secreto)
  fetch?: typeof fetch;
  timeoutMs?: number;
  log?: (msg: string, extra?: Record<string, unknown>) => void;
}

export interface ProductoShop {
  sku: string;
  name: string;
  description: string;
  price: number;
  has_tax: boolean;
  status: boolean;
  stock_type: "unlimited";
  categories: string[];
  images?: string[];
}

export interface Resumen {
  modelos_bdc: number;
  creados: string[];
  actualizados: string[];
  desactivados: string[];
  sin_cambios: number;
}

// Datos de la ficha que se muestran, en orden: (clave en la ficha, etiqueta).
const FICHA: [string, string][] = [
  ["tipo_de_tren_motriz", "Tren motriz"],
  ["motor", "Motor"],
  ["potencia_maxima_combinada_kw_hp", "Potencia combinada (kW/hp)"],
  ["potencia_maxima_kw_hp", "Potencia (kW/hp)"],
  ["potencia_maxima_kw", "Potencia (kW)"],
  ["autonomia_km", "Autonomía (km)"],
  ["capacidad_de_la_bateria_de_potencia_kwh", "Batería (kWh)"],
  ["transmision", "Transmisión"],
  ["traccion", "Tracción"],
  ["cilindrada", "Cilindrada"],
  ["combustible", "Combustible"],
];

// Primer valor de texto de una clave en cualquier nivel de la ficha ya parseada.
function buscarClave(o: unknown, clave: string): string | null {
  if (Array.isArray(o)) {
    for (const x of o) {
      const v = buscarClave(x, clave);
      if (v) return v;
    }
    return null;
  }
  if (o && typeof o === "object") {
    for (const [k, v] of Object.entries(o as Record<string, unknown>)) {
      if (k === clave) {
        const val = Array.isArray(v) ? v[0] : v;
        if (val != null && typeof val !== "object" && String(val).trim()) return String(val).trim();
      }
    }
    for (const v of Object.values(o as Record<string, unknown>)) {
      const r = buscarClave(v, clave);
      if (r) return r;
    }
  }
  return null;
}

export function datosFicha(ficha: unknown): string[] {
  const lineas: string[] = [];
  const vistas = new Set<string>();
  for (const [clave, etiqueta] of FICHA) {
    const v = buscarClave(ficha, clave);
    if (v && !vistas.has(etiqueta)) {
      lineas.push(`${etiqueta}: ${v}`);
      vistas.add(etiqueta);
    }
  }
  return lineas;
}

// deno-lint-ignore no-explicit-any
export function producto(marca: string, m: any): ProductoShop {
  const partes: string[] = [];
  if (m.caracteristicas) partes.push(String(m.caracteristicas).trim());
  const ficha = datosFicha(m.ficha);
  if (ficha.length) partes.push(ficha.join("\n"));
  partes.push(`Marca: ${marca} · Segmento: ${m.segmento || "-"}`);
  // La marca en el nombre ayuda a la búsqueda del Shop y se ve en el carrusel.
  let nombre = String(m.nombre ?? "").trim();
  const prefijo = marca.split(/\s+/)[0];
  if (!nombre.toUpperCase().includes(prefijo.toUpperCase())) nombre = `${prefijo} ${nombre}`;
  return {
    sku: `${PREFIJO}${m.id_modelo}`,
    name: nombre,
    description: partes.join("\n\n"),
    price: Number(m.precio) || 0,
    has_tax: false,
    status: true,
    stock_type: "unlimited",
    categories: [marca],
  };
}

const normal = (s: unknown) => String(s ?? "").replace(/\r\n/g, "\n").trim();

export class Shop {
  constructor(private cfg: ShopConfig) {}

  private async pedir(ruta: string, cuerpo: unknown): Promise<Response> {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), this.cfg.timeoutMs ?? 15_000);
    try {
      return await (this.cfg.fetch ?? fetch)(`${this.cfg.baseUrl}/v2/apps/${this.cfg.appId}${ruta}`, {
        method: "POST",
        headers: { "x-api-key": this.cfg.apiKey, "Content-Type": "application/json" },
        body: JSON.stringify(cuerpo),
        signal: ctrl.signal,
      });
    } finally {
      clearTimeout(t);
    }
  }

  // Productos VEH-* de la tienda con sus fotos; null si el Shop no responde.
  // deno-lint-ignore no-explicit-any
  async actuales(): Promise<any[] | null> {
    try {
      const r = await this.pedir("/products/search?page=1&limit=200", {
        search: { value: PREFIJO },
        includes: [{ relation: "media" }, { relation: "categories" }],
      });
      if (!r.ok) {
        this.cfg.log?.("shop_listar", { status: r.status });
        return null;
      }
      const j = await r.json();
      const filas = Array.isArray(j?.data) ? j.data : Array.isArray(j?.data?.data) ? j.data.data : [];
      // deno-lint-ignore no-explicit-any
      return filas.filter((p: any) => String(p?.sku ?? "").startsWith(PREFIJO));
    } catch (e) {
      this.cfg.log?.("shop_listar_error", { error: String(e) });
      return null;
    }
  }

  async upsert(recursos: ProductoShop[]): Promise<boolean> {
    if (!recursos.length) return true;
    try {
      const r = await this.pedir("/batch/products/upsert", { resources: recursos });
      this.cfg.log?.("shop_upsert", { status: r.status, n: recursos.length });
      return r.ok;
    } catch (e) {
      this.cfg.log?.("shop_upsert_error", { error: String(e) });
      return false;
    }
  }
}

// Fail-closed: si el BDC o el Shop no responden, o el BDC devuelve un catálogo vacío,
// no se toca la tienda (nunca se desactiva el catálogo por una caída).
export async function sincronizar(bdc: Bdc, shop: Shop, log?: ShopConfig["log"]): Promise<Resultado<Resumen>> {
  const ms = await bdc.marcas();
  if (ms.tipo !== "ok") return { ok: false, tipo: "indisponible", data: null, mensaje: "marcas sin respuesta" };
  // deno-lint-ignore no-explicit-any
  const deseados: { p: ProductoShop; imagenes: string[] }[] = [];
  for (const mk of ms.data ?? []) {
    const r = await bdc.modelos(Number(mk.id));
    if (r.tipo !== "ok" && r.tipo !== "vacio") {
      return { ok: false, tipo: "indisponible", data: null, mensaje: `modelos de ${mk.nombre} sin respuesta` };
    }
    // deno-lint-ignore no-explicit-any
    for (const m of (r.data ?? []) as any[]) deseados.push({ p: producto(String(mk.nombre), m), imagenes: m.imagenes ?? [] });
  }
  if (!deseados.length) return { ok: false, tipo: "negocio", data: null, mensaje: "el BDC devolvió 0 modelos; no se toca la tienda" };

  const actuales = await shop.actuales();
  if (actuales == null) return { ok: false, tipo: "indisponible", data: null, mensaje: "el Shop no responde" };
  // deno-lint-ignore no-explicit-any
  const porSku = new Map<string, any>(actuales.map((p) => [String(p.sku), p]));

  const resumen: Resumen = { modelos_bdc: deseados.length, creados: [], actualizados: [], desactivados: [], sin_cambios: 0 };
  const cambios: ProductoShop[] = [];
  for (const { p, imagenes } of deseados) {
    const a = porSku.get(p.sku);
    if (!a) {
      cambios.push({ ...p, images: imagenes });
      resumen.creados.push(p.sku);
      continue;
    }
    // deno-lint-ignore no-explicit-any
    const cat = (a.categories ?? []).map((c: any) => c?.name ?? c);
    const igual = normal(a.name) === p.name && Number(a.price) === p.price && normal(a.description) === normal(p.description) &&
      Boolean(a.status) === true && cat.includes(p.categories[0]);
    const sinFotos = !(a.media ?? []).length && imagenes.length > 0;
    if (igual && !sinFotos) {
      resumen.sin_cambios++;
      continue;
    }
    // Las fotos solo van cuando el producto no tiene ninguna: repetirlas las duplicaría.
    cambios.push(sinFotos ? { ...p, images: imagenes } : p);
    resumen.actualizados.push(p.sku);
  }
  const vigentes = new Set(deseados.map((d) => d.p.sku));
  for (const a of actuales) {
    if (!vigentes.has(String(a.sku)) && a.status) {
      // Un modelo que ya no está en el BDC se desactiva (reversible), nunca se borra.
      cambios.push({
        sku: String(a.sku), name: normal(a.name), description: normal(a.description), price: Number(a.price) || 0,
        has_tax: false, status: false, stock_type: "unlimited",
        // deno-lint-ignore no-explicit-any
        categories: (a.categories ?? []).map((c: any) => c?.name ?? c).filter(Boolean),
      });
      resumen.desactivados.push(String(a.sku));
    }
  }
  const ok = await shop.upsert(cambios);
  log?.("shop_sync", { modelos: resumen.modelos_bdc, creados: resumen.creados.length, actualizados: resumen.actualizados.length, desactivados: resumen.desactivados.length, ok });
  return ok ? { ok: true, tipo: "ok", data: resumen } : { ok: false, tipo: "indisponible", data: resumen, mensaje: "el Shop rechazó el upsert" };
}
