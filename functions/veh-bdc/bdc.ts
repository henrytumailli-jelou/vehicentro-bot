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
  // Producción (D-32): el id_conexion es el `codigo` de botwa_marcas de cada marca.
  conexionPorMarca?: boolean;
  enviarAsesor?: boolean;
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
  catalogoCache = null;
};

// Catálogo de todas las marcas para la búsqueda; 10 min por instancia.
// deno-lint-ignore no-explicit-any
let catalogoCache: { data: any[]; vence: number } | null = null;

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
      this.cfg.log?.("bdc_token_ok", { expira_en: segs });
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
      this.cfg.log?.("bdc_get", { ruta: ruta.split("/")[0], status: r.status, intento });
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
      this.cfg.log?.("bdc_get_resultado", { ruta: ruta.split("/")[0], n: data.length });
      return data.length ? res("ok", data) : res("vacio", []);
    }
    return res("indisponible", null, "sin respuesta");
  }

  marcas() {
    return this.get<{ id: number; nombre: string; codigo?: string }>("botwa_marcas");
  }

  // id_conexion del POST del lead. Con conexionPorMarca y sin código de la marca no se
  // registra en otra conexión: sale como negocio o indisponible (fail-closed).
  async conexion(idMarca: number): Promise<Resultado<string>> {
    if (!this.cfg.conexionPorMarca) return res("ok", this.cfg.idConexion);
    const ms = await this.marcas();
    if (ms.tipo !== "ok") return { ...ms, data: null } as Resultado<string>;
    const codigo = String(ms.data!.find((m) => Number(m.id) === Number(idMarca))?.codigo ?? "").trim();
    return codigo ? res("ok", codigo) : res("negocio", null, "marca sin id_conexion");
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

  // Catálogo completo (todas las marcas) con índice de búsqueda; 10 min en memoria.
  async catalogo(): Promise<Resultado<ModeloCatalogo[]>> {
    if (catalogoCache && catalogoCache.vence > Date.now()) return res("ok", catalogoCache.data);
    const ms = await this.marcas();
    if (ms.tipo !== "ok") return { ...ms, data: null } as Resultado<ModeloCatalogo[]>;
    const porMarca = await Promise.all(
      (ms.data ?? []).map(async (mk) => ({ mk, r: await this.get<Record<string, unknown>>(`botwa_modelos/${mk.id}`) })),
    );
    if (porMarca.some((x) => x.r.tipo !== "ok" && x.r.tipo !== "vacio")) return res("indisponible", null, "modelos sin respuesta");
    const data: ModeloCatalogo[] = [];
    for (const { mk, r } of porMarca) {
      for (const m of r.data ?? []) {
        const ficha = parsearFicha(m.json_ficha_tecnica, 100_000);
        const tf = textoFicha(ficha);
        const nombre = String(m.nombre_modelo ?? "");
        const segmento = String(m.nombre_segmento ?? "");
        const carac = String(m.caracteristicas ?? "");
        const imgs = String(m.imagenes ?? "").split(",").map((s) => s.trim()).filter(Boolean);
        data.push({
          id_modelo: Number(m.id_modelo),
          sku: `VEH-${m.id_modelo}`,
          nombre,
          marca: mk.nombre,
          id_marca: mk.id,
          segmento,
          precio: Number(m.precio_venta),
          moneda: String(m.moneda ?? "USD"),
          etiquetas: etiquetas(nombre, segmento, carac, tf),
          caracteristicas: carac.slice(0, 300),
          imagen: imgs[0] ?? null,
          texto: `${sinAcentos(`${nombre} ${mk.nombre} ${segmento} ${carac}`)} | ${tf}`,
        });
      }
    }
    catalogoCache = { data, vence: Date.now() + 10 * 60_000 };
    return data.length ? res("ok", data) : res("vacio", []);
  }

  // Busca en todas las marcas (o en una) por nombre, modelo, segmento o características.
  // Sin términos útiles devuelve todo el catálogo. coincidencia: «exacta» = cada término está
  // en el nombre o en una etiqueta; «relacionada» = alguno solo aparece en la ficha o no aparece.
  async buscar(consulta: string, idMarca?: number) {
    const c = await this.catalogo();
    if (c.tipo !== "ok") return { ...c, data: null };
    const base = (c.data ?? []).filter((m) => !idMarca || m.id_marca === idMarca);
    const terminos = terminosConsulta(consulta ?? "");
    const filas = base
      .map((m) => {
        const ps = terminos.length ? puntosPorTermino(m, terminos) : [3];
        return { m, p: ps.reduce((a, b) => a + b, 0), exacta: ps.every((x) => x >= 3) };
      })
      .filter((x) => x.p > 0)
      .sort((a, b) => Number(b.exacta) - Number(a.exacta) || b.p - a.p || a.m.precio - b.m.precio);
    const resultados = filas.map(({ m, exacta }) => {
      const { texto: _t, ...pub } = m;
      return { ...pub, coincidencia: exacta ? "exacta" : "relacionada" };
    });
    const marcas = [...new Set(resultados.map((r) => r.marca))];
    this.cfg.log?.("bdc_buscar", { terminos: terminos.length, resultados: resultados.length, marcas: marcas.length });
    return resultados.length
      ? res("ok", { terminos, marcas, resultados })
      : res("vacio", { terminos, marcas: [], resultados: [] });
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

  // Escritura (D-28): el asesor sale de 4.4 con la agencia elegida, ANTES del registro.
  // En producción (enviarAsesor) el lead lleva id_agencias e id_asesor; en pruebas
  // (TESTCLARO) no, como pide la documentación del cliente. El POST nunca se reintenta
  // salvo un 401 (no llegó a registrarse); con resultado incierto se verifica con 4.5.
  async lead(l: LeadEntrada): Promise<Resultado<{ asesor: Asesor | null }>> {
    const cel = normalizarCelular(l.celular);
    if (!cel) return res("negocio", null, "celular inválido");
    const cx = await this.conexion(l.id_marca);
    if (cx.tipo !== "ok") {
      this.cfg.log?.("bdc_lead_sin_conexion", { id_marca: l.id_marca, tipo: cx.tipo });
      return { ...cx, data: null } as Resultado<{ asesor: Asesor | null }>;
    }
    let asesorAgencia: Asesor | null = null;
    if (l.id_agencia != null) {
      const a = await this.asesorDeAgencia(Number(l.id_agencia), l.id_marca);
      asesorAgencia = a.tipo === "ok" ? (a.data as Asesor) : null;
    }
    const conAsesor = !!(this.cfg.enviarAsesor && asesorAgencia);
    const body = JSON.stringify({
      nombres: (l.nombres || "Cliente WhatsApp").slice(0, 120),
      celular: cel,
      cedula: l.cedula ?? null,
      id_modelo: String(l.id_modelo),
      notas: (l.notas ?? "").slice(0, 1000),
      direccion: l.ciudad ?? null,
      ...(conAsesor ? { id_agencias: String(asesorAgencia!.id_agencia), id_asesor: asesorAgencia!.id } : {}),
    });
    let estado: "registrado" | "incierto" | "negocio" = "incierto";
    for (let intento = 0; intento < 2; intento++) {
      const tok = await this.token();
      if (!tok) return res("indisponible", null, "sin token");
      let r: Response;
      try {
        r = await this.llamar(`${this.cfg.baseUrl}/api/conexiones/botwa/${encodeURIComponent(cx.data!)}`, {
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
      this.cfg.log?.("bdc_lead", { status: r.status, estado, con_asesor: conAsesor, asesor_4_4: !!asesorAgencia, celular: enmascarar(cel) });
      break;
    }
    if (estado === "negocio") return res("negocio", null, "el BDC rechazó el lead");
    if (estado === "registrado") return res("ok", { asesor: asesorAgencia });
    // Incierto: no se reenvía. Si 4.5 ya devuelve asesor, el lead entró.
    const v = await this.existeAsesor(l.id_marca, cel, l.cedula);
    return v.tipo === "ok" ? res("ok", { asesor: v.data as Asesor }) : res("incierto", { asesor: asesorAgencia });
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

// La ficha llega como texto con JSON adentro y con escapes de Markdown (`info\_base`, `\[`),
// que rompen JSON.parse. Se quitan los escapes, se parsea, se compacta (valores repetidos
// por versión → uno; «No especificado» fuera) y se recorta por secciones completas.
export function parsearFicha(v: unknown, max = 4000): unknown {
  if (v == null || v === "") return null;
  let obj: unknown = v;
  if (typeof v === "string") {
    const limpio = v.replace(/\\([_\[\]*#\-])/g, "$1");
    try {
      obj = JSON.parse(limpio);
    } catch {
      return limpio.slice(0, max);
    }
  }
  const c = compactar(obj);
  return JSON.stringify(c).length <= max ? c : recortar(c, max);
}

const NO_DATO = /^(no especificado|n\/a|-|)$/i;

function compactar(o: unknown): unknown {
  if (Array.isArray(o)) {
    const vals = o.map(compactar).filter((x) => x != null && !(typeof x === "string" && NO_DATO.test(x.trim())));
    const unicos = [...new Set(vals.map((x) => JSON.stringify(x)))].map((x) => JSON.parse(x));
    if (!unicos.length) return null;
    return unicos.length === 1 ? unicos[0] : unicos;
  }
  if (o && typeof o === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(o as Record<string, unknown>)) {
      const c = compactar(v);
      if (c != null && !(typeof c === "string" && NO_DATO.test(c.trim()))) out[k] = c;
    }
    return Object.keys(out).length ? out : null;
  }
  return o;
}

// Recorta por secciones de primer nivel y, dentro de «especificaciones», por subsección.
function recortar(o: unknown, max: number): unknown {
  if (typeof o !== "object" || o === null) return o;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(o as Record<string, unknown>)) {
    if (v && typeof v === "object" && !Array.isArray(v)) {
      const sub: Record<string, unknown> = {};
      out[k] = sub;
      for (const [k2, v2] of Object.entries(v as Record<string, unknown>)) {
        sub[k2] = v2;
        if (JSON.stringify(out).length > max) {
          delete sub[k2];
          return out;
        }
      }
    } else {
      out[k] = v;
      if (JSON.stringify(out).length > max) {
        delete out[k];
        return out;
      }
    }
  }
  return out;
}

// Texto plano de la ficha para buscar (claves y valores, sin acentos).
export function textoFicha(f: unknown): string {
  const partes: string[] = [];
  const rec = (o: unknown, k = "") => {
    if (o == null) return;
    if (Array.isArray(o)) o.forEach((x) => rec(x, k));
    else if (typeof o === "object") for (const [kk, vv] of Object.entries(o as Record<string, unknown>)) rec(vv, kk);
    else partes.push(`${k.replace(/_/g, " ")} ${o}`);
  };
  rec(f);
  return sinAcentos(partes.join(" | "));
}

// ---------- Búsqueda en todo el catálogo (nombre, marca, segmento o características) ----------

export interface ModeloCatalogo {
  id_modelo: number;
  sku: string;
  nombre: string;
  marca: string;
  id_marca: number;
  segmento: string;
  precio: number;
  moneda: string;
  etiquetas: string[];
  caracteristicas: string;
  imagen: string | null;
  texto: string; // índice de búsqueda; no se devuelve al agente
}

// Etiquetas derivadas del nombre, las características y la ficha.
export function etiquetas(nombre: string, segmento: string, caracteristicas: string, ficha: string): string[] {
  const n = sinAcentos(`${nombre} ${caracteristicas}`);
  const todo = `${n} ${ficha}`;
  const t = new Set<string>();
  const enchufable = /\bphev\b|enchufable/.test(todo);
  if (enchufable) t.add("híbrido enchufable");
  else if (/hibrid/.test(todo)) t.add("híbrido");
  if (!enchufable && !/hibrid/.test(todo) &&
    (/\bev\b|100\s*% electric|electrico\b/.test(n) || (/bateria/.test(ficha) && /autonomia/.test(ficha) && !/combustible|gasolina|diesel/.test(ficha)))) {
    t.add("eléctrico");
  }
  if (/\bdiesel\b/.test(todo)) t.add("diésel");
  else if (!t.has("eléctrico") && /gasolina|octanaje|combustible/.test(todo)) t.add("gasolina");
  // Tracción: el nombre manda; si no la dice, la ficha.
  if (/4x4|awd|4wd/.test(sinAcentos(nombre))) t.add("4x4");
  else if (/4x2/.test(sinAcentos(nombre))) t.add("4x2");
  else if (/4x4|awd|4wd|traccion (total|integral)/.test(todo)) t.add("4x4");
  else if (/traccion (en las )?ruedas delanteras|4x2/.test(todo)) t.add("4x2");
  if (/7 pasajeros|3 filas|tres filas/.test(todo)) t.add("7 pasajeros");
  // Transmisión: el nombre (MT/AT) manda; si no, solo los campos de transmisión de la ficha
  // (el «aire acondicionado automático» no cuenta).
  const nom = sinAcentos(nombre);
  const transmision = (ficha.match(/(?:^|\| )[^|]*(?:transmision|caja)[^|]*/g) ?? []).join(" ");
  if (/\bmt\b|manual/.test(nom)) t.add("manual");
  else if (/\bat\b|automatic/.test(nom)) t.add("automático");
  else if (/automatic|\bdct\b|\bcvt\b|\bdht\b|\bat\b/.test(transmision)) t.add("automático");
  else if (/manual/.test(transmision)) t.add("manual");
  const seg = sinAcentos(segmento);
  if (seg) t.add(seg.replace("pick up", "pick-up"));
  return [...t];
}

// Sinónimos: cada término de la consulta se expande a lo que puede aparecer en el catálogo.
const SINONIMOS: Record<string, string[]> = {
  electrico: ["electrico", "ev", "bateria"],
  electrica: ["electrico", "ev", "bateria"],
  ev: ["electrico", "ev"],
  hibrido: ["hibrido", "phev", "enchufable"],
  hibrida: ["hibrido", "phev", "enchufable"],
  phev: ["phev", "enchufable"],
  "4x4": ["4x4", "awd", "4wd", "traccion total", "traccion integral"],
  "4x2": ["4x2"],
  camioneta: ["pick-up", "pick up", "suv"],
  pickup: ["pick-up", "pick up"],
  furgoneta: ["van", "furgoneta"],
  van: ["van", "furgoneta"],
  carga: ["van", "furgoneta", "pick-up", "carga"],
  familia: ["7 pasajeros", "3 filas", "suv"],
  familiar: ["7 pasajeros", "3 filas", "suv"],
  diesel: ["diesel"],
  gasolina: ["gasolina"],
  automatico: ["automatico", "dct", "cvt"],
  automatica: ["automatico", "dct", "cvt"],
  manual: ["manual"],
};
const VACIAS = new Set(
  ("quiero un una unos unas el la los las de del que sea con para por me gustaria busco buscando tienen tiene hay algun alguna " +
    "carro carros auto autos vehiculo vehiculos modelo modelos ver info informacion precio precios cuanto cuesta y o en mas mejor " +
    "busco necesito interesa interesado hola buenas favor porfa algo tipo").split(" "),
);

export function terminosConsulta(consulta: string): string[] {
  const q = sinAcentos(consulta).replace(/[^\p{L}\p{N}%\s-]/gu, " ");
  const out: string[] = [];
  // «7 pasajeros» y «3 filas» como frase.
  for (const m of q.matchAll(/(\d+)\s*(pasajeros|puestos|asientos|filas)/g)) out.push(`${m[1]} ${m[2] === "filas" ? "filas" : "pasajeros"}`);
  const enFrase = new Set(out.map((x) => x.split(" ")[0]));
  // Los números de 2+ cifras («02», «08», «70») son parte del nombre del modelo; los de 1 cifra no.
  for (const w of q.split(/\s+/)) {
    if (!w || VACIAS.has(w) || enFrase.has(w) || /^(pasajeros|puestos|asientos|filas)$/.test(w)) continue;
    if (/^\d$/.test(w)) continue;
    out.push(w);
  }
  return [...new Set(out)];
}

// Términos de característica: solo cuentan en el nombre o en las etiquetas (la ficha está llena de
// «eléctrico» en elevavidrios o dirección). RELACIONADOS da la coincidencia parcial que sí tiene sentido.
const RELACIONADOS: Record<string, string[]> = {
  electrico: ["hibrido enchufable"],
  electrica: ["hibrido enchufable"],
  ev: ["hibrido enchufable"],
  "4x4": ["pick-up"],
};

// Términos cortos («ev», «at», «02») solo cuentan como palabra completa.
function contiene(texto: string, termino: string): boolean {
  if (termino.length > 3) return texto.includes(termino);
  const e = termino.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z0-9])${e}($|[^a-z0-9])`).test(texto);
}

// Por término: nombre o marca = 4, etiqueta = 3, solo en la ficha o las características = 1, nada = 0.
export function puntosPorTermino(m: ModeloCatalogo, terminos: string[]): number[] {
  const nombre = sinAcentos(`${m.nombre} ${m.marca}`);
  const tags = sinAcentos(m.etiquetas.join(" | "));
  return terminos.map((t) => {
    const esCaracteristica = t in SINONIMOS || /^\d+ (pasajeros|filas)$/.test(t);
    let p = 0;
    for (const a of (SINONIMOS[t] ?? [t]).map((x) => x.trim())) {
      if (contiene(nombre, a)) p = Math.max(p, 4);
      else if (contiene(tags, a)) p = Math.max(p, 3);
      else if (!esCaracteristica && contiene(m.texto, a)) p = Math.max(p, 1);
    }
    if (!p && (RELACIONADOS[t] ?? []).some((r) => contiene(tags, r))) p = 1;
    return p;
  });
}
