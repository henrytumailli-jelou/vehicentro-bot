// Cliente del BDC de Vehicentro: OAuth client credentials, clasificación de respuestas
// y registro del lead. Sin dependencias del runtime de Functions para poder probarlo solo.

export type Tipo = "ok" | "vacio" | "negocio" | "indisponible" | "incierto";
// Alias y no interface: el SDK exige un objeto con firma de índice como respuesta.
export type Resultado<T = unknown> = {
  ok: boolean;
  tipo: Tipo;
  data: T | null;
  mensaje?: string;
};

export interface Config {
  baseUrl: string;
  clientId: string;
  clientSecret: string;
  idConexion: string;
  fetch?: typeof fetch;
  timeoutMs?: number;
  log?: (msg: string, extra?: Record<string, unknown>) => void;
}

// deno-lint-ignore no-explicit-any
const res = (tipo: Tipo, data: any = null, mensaje?: string): Resultado<any> => ({
  ok: tipo === "ok" || tipo === "vacio",
  tipo,
  data,
  ...(mensaje ? { mensaje } : {}),
});

// Token compartido por la instancia; vence a los 55 min aunque el BDC diga 60.
let cache: { token: string; vence: number } | null = null;
export const _resetToken = () => {
  cache = null;
};

export function normalizarCelular(valor: string | null | undefined): string | null {
  const d = String(valor ?? "").replace(/\D/g, "");
  if (/^09\d{8}$/.test(d)) return d;
  if (/^5939\d{8}$/.test(d)) return "0" + d.slice(3);
  if (/^9\d{8}$/.test(d)) return "0" + d;
  return null;
}

export const enmascarar = (v: string | null | undefined) =>
  v ? String(v).slice(0, 2) + "****" + String(v).slice(-2) : "";

const sinAcentos = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

export class Bdc {
  constructor(private cfg: Config) {}

  private get f() {
    return this.cfg.fetch ?? fetch;
  }

  private async llamar(url: string, init: RequestInit): Promise<Response> {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), this.cfg.timeoutMs ?? 10_000);
    try {
      return await this.f(url, { ...init, signal: ctrl.signal });
    } finally {
      clearTimeout(t);
    }
  }

  async token(forzar = false): Promise<string | null> {
    if (!forzar && cache && cache.vence > Date.now()) return cache.token;
    const basic = btoa(`${this.cfg.clientId}:${this.cfg.clientSecret}`);
    try {
      const r = await this.llamar(`${this.cfg.baseUrl}/oauth/token`, {
        method: "POST",
        headers: {
          Authorization: `Basic ${basic}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: "grant_type=client_credentials",
      });
      if (!r.ok) {
        this.cfg.log?.("bdc_token_rechazado", { status: r.status });
        return null;
      }
      const j = await r.json();
      const segs = Number(j.expires_in ?? 3600);
      cache = { token: j.access_token, vence: Date.now() + Math.min(segs - 300, 3300) * 1000 };
      return cache.token;
    } catch (e) {
      this.cfg.log?.("bdc_token_error", { error: String(e) });
      return null;
    }
  }

  // Lectura: 1 reintento ante red/5xx; 401 → token nuevo y 1 repetición.
  async get<T = unknown>(ruta: string): Promise<Resultado<T[]>> {
    for (let intento = 0; intento < 2; intento++) {
      const tok = await this.token();
      if (!tok) return res("indisponible", null, "sin token");
      let r: Response;
      try {
        r = await this.llamar(`${this.cfg.baseUrl}/api/conexiones/${ruta}`, {
          headers: { Authorization: `Bearer ${tok}` },
        });
      } catch (e) {
        this.cfg.log?.("bdc_get_red", { ruta: ruta.split("/")[0], intento, error: String(e) });
        continue;
      }
      if (r.status === 401) {
        _resetToken();
        if (intento === 0) continue;
        return res("indisponible", null, "token rechazado");
      }
      if (r.status >= 500) {
        this.cfg.log?.("bdc_get_5xx", { ruta: ruta.split("/")[0], status: r.status, intento });
        continue;
      }
      if (r.status === 404) return res("negocio", null, "ruta inexistente");
      let j: { status?: string; data?: T[]; message?: string };
      try {
        j = await r.json();
      } catch {
        return res("indisponible", null, "respuesta no es JSON");
      }
      if (j.status === "error") return res("negocio", null, j.message ?? "error del BDC");
      const data = Array.isArray(j.data) ? j.data : [];
      return data.length ? res("ok", data) : res("vacio", []);
    }
    return res("indisponible", null, "sin respuesta");
  }

  marcas() {
    return this.get<{ id: number; nombre: string }>("botwa_marcas");
  }

  async modelos(idMarca: number, busqueda?: string) {
    const r = await this.get<Record<string, unknown>>(`botwa_modelos/${idMarca}`);
    if (r.tipo !== "ok") return r;
    const q = busqueda ? sinAcentos(busqueda) : "";
    const items = (r.data ?? [])
      .filter((m) => !q || sinAcentos(String(m.nombre_modelo ?? "")).includes(q))
      .map((m) => ({
        id_modelo: m.id_modelo,
        nombre: m.nombre_modelo,
        segmento: m.nombre_segmento,
        precio: m.precio_venta,
        moneda: m.moneda,
        caracteristicas: m.caracteristicas,
        ficha: parsearFicha(m.json_ficha_tecnica),
        imagenes: String(m.imagenes ?? "").split(",").map((s) => s.trim()).filter(Boolean),
        videos: String(m.videos ?? "").split(",").map((s) => s.trim()).filter(Boolean),
      }));
    return items.length ? res("ok", items) : res("vacio", []);
  }

  async agencias(idMarca: number, ciudad?: string) {
    const r = await this.get<Record<string, unknown>>(`botwa_agencias/${idMarca}`);
    if (r.tipo !== "ok") return { ...r, data: null };
    const todas = (r.data ?? []).map((a) => ({
      id: a.id_agencia,
      nombre: a.nombre_agencia,
      ciudad: a.ciudad_agencia,
      provincia: a.provincia_agencia,
      direccion: a.direccion_agencia,
      referencia: a.referencia_agencia,
      ubicacion: a.ubicacion_agencia,
      horario: String(a.horario_agencia ?? "").replace(/\r\n/g, "\n"),
    }));
    const ciudades = [...new Set(todas.map((a) => String(a.ciudad ?? "")).filter(Boolean))].sort();
    const agencias = ciudad
      ? todas.filter((a) => sinAcentos(String(a.ciudad ?? "")) === sinAcentos(ciudad))
      : todas;
    return agencias.length ? res("ok", { ciudades, agencias }) : res("vacio", { ciudades, agencias: [] });
  }

  async asesorDeAgencia(idAgencia: number, idMarca: number) {
    const r = await this.get<Record<string, unknown>>(`botwa_asesores/${idAgencia}/${idMarca}`);
    return r.tipo === "ok" ? res("ok", asesor(r.data![0])) : { ...r, data: null };
  }

  async existeAsesor(idMarca: number, celular: string | null, cedula?: string | null) {
    const cel = normalizarCelular(celular);
    if (!cel) return res("negocio", null, "celular inválido");
    const ced = cedula && /^\d{10,13}$/.test(cedula) ? cedula : "null";
    const r = await this.get<Record<string, unknown>>(`botwa_existe_asesor/${idMarca}/${ced}/${cel}`);
    return r.tipo === "ok" ? res("ok", asesor(r.data![0])) : { ...r, data: null };
  }

  // Escritura: nunca se reintenta salvo un 401 (no llegó a registrarse).
  // Con resultado incierto se verifica con 4.5 en vez de reenviar.
  async lead(l: LeadEntrada): Promise<Resultado<{ asesor: Asesor | null }>> {
    const cel = normalizarCelular(l.celular);
    if (!cel) return res("negocio", null, "celular inválido");
    const body = JSON.stringify({
      nombres: (l.nombres || "Cliente WhatsApp").slice(0, 120),
      celular: cel,
      cedula: l.cedula ?? null,
      id_modelo: String(l.id_modelo),
      notas: (l.notas ?? "").slice(0, 1000),
      direccion: l.ciudad ?? null,
      ...(l.id_agencia != null ? { id_agencias: String(l.id_agencia) } : {}),
    });
    let estado: "registrado" | "incierto" | "negocio" = "incierto";
    for (let intento = 0; intento < 2; intento++) {
      const tok = await this.token();
      if (!tok) return res("indisponible", null, "sin token");
      let r: Response;
      try {
        r = await this.llamar(`${this.cfg.baseUrl}/api/conexiones/botwa/${this.cfg.idConexion}`, {
          method: "POST",
          headers: { Authorization: `Bearer ${tok}`, "Content-Type": "application/json" },
          body,
        });
      } catch (e) {
        this.cfg.log?.("bdc_lead_red", { celular: enmascarar(cel), error: String(e) });
        estado = "incierto";
        break;
      }
      if (r.status === 401 && intento === 0) {
        _resetToken();
        continue;
      }
      if (r.status === 201 || r.status === 200) estado = "registrado";
      else if (r.status === 400 || r.status === 404 || r.status === 401) estado = "negocio";
      else estado = "incierto";
      this.cfg.log?.("bdc_lead", { status: r.status, estado, celular: enmascarar(cel) });
      break;
    }
    if (estado === "negocio") return res("negocio", null, "el BDC rechazó el lead");
    const a = await this.existeAsesor(l.id_marca, cel, l.cedula);
    const asesorAsignado = a.tipo === "ok" ? (a.data as Asesor) : null;
    if (estado === "registrado") return res("ok", { asesor: asesorAsignado });
    // Incierto: si 4.5 ya devuelve asesor, el lead entró.
    return asesorAsignado ? res("ok", { asesor: asesorAsignado }) : res("incierto", { asesor: null });
  }
}

export interface LeadEntrada {
  id_marca: number;
  celular: string;
  cedula?: string | null;
  nombres?: string | null;
  id_modelo: string | number;
  id_agencia?: string | number | null;
  ciudad?: string | null;
  notas?: string | null;
}

export interface Asesor {
  id: string;
  nombre: string;
  correo: string;
  celular: string;
  id_agencia: number;
  agencia: string;
  direccion: string;
  horario: string;
}

function asesor(a: Record<string, unknown>): Asesor {
  return {
    id: String(a.id_usuario ?? ""),
    nombre: String(a.nombre_usuario ?? ""),
    correo: String(a.email_usuario ?? "").toLowerCase(),
    celular: String(a.celular_usuario ?? ""),
    id_agencia: Number(a.id_agencia ?? 0),
    agencia: String(a.nombre_agencia ?? ""),
    direccion: String(a.direccion_agencia ?? ""),
    horario: String(a.horario_agencia ?? "").replace(/\r\n/g, "\n"),
  };
}

// La ficha llega como texto con JSON adentro; se parsea y se recorta para el agente.
export function parsearFicha(v: unknown, max = 1500): unknown {
  if (v == null || v === "") return null;
  let obj: unknown = v;
  if (typeof v === "string") {
    try {
      obj = JSON.parse(v);
    } catch {
      return String(v).slice(0, max);
    }
  }
  const s = JSON.stringify(obj);
  return s.length <= max ? obj : JSON.parse(JSON.stringify(recortar(obj, max)));
}

function recortar(o: unknown, max: number): unknown {
  if (typeof o !== "object" || o === null) return o;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(o as Record<string, unknown>)) {
    out[k] = v;
    if (JSON.stringify(out).length > max) {
      delete out[k];
      break;
    }
  }
  return out;
}
