import { assert, assertEquals } from "jsr:@std/assert@1";
import { _resetToken, Bdc, normalizarCelular, parsearFicha } from "./bdc.ts";

// BDC simulado solo para las pruebas: responde según la ruta.
type Resp = { status: number; body?: unknown } | "red";
function bdcFalso(rutas: Record<string, Resp | Resp[]>) {
  const llamadas: string[] = [];
  const contador: Record<string, number> = {};
  const f = (url: string | URL | Request, _init?: RequestInit) => {
    const u = String(url);
    const clave = Object.keys(rutas).find((k) => u.includes(k)) ?? "";
    llamadas.push(clave || u);
    const r = rutas[clave];
    const lista = Array.isArray(r) ? r : [r];
    const n = contador[clave] = (contador[clave] ?? -1) + 1;
    const e = lista[Math.min(n, lista.length - 1)];
    if (!e || e === "red") return Promise.reject(new Error("red"));
    return Promise.resolve(new Response(e.body === undefined ? null : JSON.stringify(e.body), { status: e.status }));
  };
  return { f: f as typeof fetch, llamadas };
}
const token = { status: 200, body: { access_token: "t", expires_in: 3600 } };
const nuevo = (f: typeof fetch) => {
  _resetToken();
  return new Bdc({ baseUrl: "https://x", clientId: "a", clientSecret: "b", idConexion: "TESTCLARO", fetch: f, timeoutMs: 1000 });
};
const asesorRow = { id_usuario: "1", nombre_usuario: "A. B.", email_usuario: "ASESOR@vehicentro.com", id_agencia: 2, nombre_agencia: "Ag" };

Deno.test("celular: normaliza 593 y 09; rechaza otros", () => {
  assertEquals(normalizarCelular("+593 99 123 4567"), "0991234567");
  assertEquals(normalizarCelular("0991234567"), "0991234567");
  assertEquals(normalizarCelular("12345"), null);
});

Deno.test("status:error con HTTP 200 es negocio, sin reintento", async () => {
  const { f, llamadas } = bdcFalso({ "oauth/token": token, botwa_marcas: { status: 200, body: { status: "error", message: "x" } } });
  const r = await nuevo(f).marcas();
  assertEquals(r.tipo, "negocio");
  assertEquals(llamadas.filter((l) => l === "botwa_marcas").length, 1);
});

Deno.test("data vacía es vacio, no error", async () => {
  const { f } = bdcFalso({ "oauth/token": token, botwa_agencias: { status: 200, body: { status: "success", data: [] } } });
  const r = await nuevo(f).agencias(3, "Quito");
  assertEquals(r.tipo, "vacio");
  assert(r.ok);
});

Deno.test("5xx en lectura: 1 reintento y luego indisponible", async () => {
  const { f, llamadas } = bdcFalso({ "oauth/token": token, botwa_marcas: { status: 500 } });
  const r = await nuevo(f).marcas();
  assertEquals(r.tipo, "indisponible");
  assertEquals(llamadas.filter((l) => l === "botwa_marcas").length, 2);
});

Deno.test("401: token nuevo y una repetición", async () => {
  const { f, llamadas } = bdcFalso({
    "oauth/token": token,
    botwa_marcas: [{ status: 401 }, { status: 200, body: { status: "success", data: [{ id: 3, nombre: "K" }] } }],
  });
  const r = await nuevo(f).marcas();
  assertEquals(r.tipo, "ok");
  assertEquals(llamadas.filter((l) => l === "oauth/token").length, 2);
});

Deno.test("agencias: ciudades únicas y filtro sin acentos", async () => {
  const data = [
    { id_agencia: 1, nombre_agencia: "A", ciudad_agencia: "AMBATO", horario_agencia: "L\r\nS" },
    { id_agencia: 2, nombre_agencia: "B", ciudad_agencia: "QUITO" },
    { id_agencia: 3, nombre_agencia: "C", ciudad_agencia: "AMBATO" },
  ];
  const { f } = bdcFalso({ "oauth/token": token, botwa_agencias: { status: 200, body: { status: "success", data } } });
  const r = await nuevo(f).agencias(3, "ambató");
  assertEquals(r.tipo, "ok");
  const d = r.data as { ciudades: string[]; agencias: { horario: string }[] };
  assertEquals(d.ciudades, ["AMBATO", "QUITO"]);
  assertEquals(d.agencias.length, 2);
  assertEquals(d.agencias[0].horario, "L\nS");
});

Deno.test("lead con agencia: asesor de 4.4; en pruebas no envía id_asesor", async () => {
  let enviado = "";
  const { f, llamadas } = bdcFalso({
    "oauth/token": token,
    botwa_asesores: { status: 200, body: { status: "success", data: [asesorRow] } },
    "botwa/TESTCLARO": { status: 201 },
  });
  const espia: typeof fetch = (u, i) => {
    if (String(u).includes("botwa/TESTCLARO")) enviado = String(i?.body ?? "");
    return f(u, i);
  };
  const r = await nuevo(espia).lead({ id_marca: 3, celular: "0991234567", id_modelo: 82, id_agencia: 2, notas: "x".repeat(2000) });
  assertEquals(r.tipo, "ok");
  assertEquals(r.data?.asesor?.correo, "asesor@vehicentro.com");
  assertEquals(enviado.includes("id_asesor"), false);
  assertEquals(JSON.parse(enviado).notas.length, 1000);
  assertEquals(llamadas.filter((l) => l === "botwa/TESTCLARO").length, 1);
});

Deno.test("lead en producción: envía id_agencias e id_asesor de 4.4", async () => {
  let enviado = "";
  const { f } = bdcFalso({
    "oauth/token": token,
    botwa_asesores: { status: 200, body: { status: "success", data: [asesorRow] } },
    "botwa/TESTCLARO": { status: 201 },
  });
  const espia: typeof fetch = (u, i) => {
    if (String(u).includes("botwa/TESTCLARO")) enviado = String(i?.body ?? "");
    return f(u, i);
  };
  _resetToken();
  const b = new Bdc({ baseUrl: "https://x", clientId: "a", clientSecret: "b", idConexion: "TESTCLARO", enviarAsesor: true, fetch: espia, timeoutMs: 1000 });
  await b.lead({ id_marca: 3, celular: "0991234567", id_modelo: 82, id_agencia: 2 });
  const j = JSON.parse(enviado);
  assertEquals(j.id_asesor, "1");
  assertEquals(j.id_agencias, "2");
});

Deno.test("lead sin respuesta: NO reenvía; 4.5 vacío → incierto", async () => {
  const { f, llamadas } = bdcFalso({
    "oauth/token": token,
    "botwa/TESTCLARO": "red",
    botwa_existe_asesor: { status: 200, body: { status: "success", data: [] } },
  });
  const r = await nuevo(f).lead({ id_marca: 3, celular: "0991234567", id_modelo: 82 });
  assertEquals(r.tipo, "incierto");
  assertEquals(llamadas.filter((l) => l === "botwa/TESTCLARO").length, 1);
});

Deno.test("lead incierto pero 4.5 ya trae asesor → ok", async () => {
  const { f } = bdcFalso({
    "oauth/token": token,
    "botwa/TESTCLARO": { status: 502 },
    botwa_existe_asesor: { status: 200, body: { status: "success", data: [asesorRow] } },
  });
  const r = await nuevo(f).lead({ id_marca: 3, celular: "0991234567", id_modelo: 82 });
  assertEquals(r.tipo, "ok");
});

Deno.test("lead 400 es negocio y no consulta 4.5", async () => {
  const { f, llamadas } = bdcFalso({ "oauth/token": token, "botwa/TESTCLARO": { status: 400 }, botwa_existe_asesor: { status: 200, body: { status: "success", data: [asesorRow] } } });
  const r = await nuevo(f).lead({ id_marca: 3, celular: "0991234567", id_modelo: 82 });
  assertEquals(r.tipo, "negocio");
  assertEquals(llamadas.includes("botwa_existe_asesor"), false);
});

Deno.test("caso negativo del doble: un BDC caído no da ok", async () => {
  const { f } = bdcFalso({ "oauth/token": { status: 500 } });
  const r = await nuevo(f).marcas();
  assertEquals(r.ok, false);
});

Deno.test("ficha: texto con JSON se parsea y se recorta", () => {
  const ficha = JSON.stringify({ a: "1", b: "x".repeat(3000) });
  const r = parsearFicha(ficha, 100) as Record<string, unknown>;
  assertEquals(r.a, "1");
  assertEquals("b" in r, false);
});

// Forma real del BDC: JSON con escapes de Markdown y valores repetidos por versión.
const fichaBdc =
  String.raw`{"info\_base":{"marca":"SINOTRUK","anio":"No especificado"},"versiones\_detectadas":\["4x2","4x4"\],` +
  String.raw`"especificaciones":{"motor":{"tipo\_combustible":\["Diésel","Diésel"\],"potencia\_maxima\_hp":\["180","180"\]}}}`;

Deno.test("ficha del BDC: quita escapes de Markdown, parsea y compacta", () => {
  const r = parsearFicha(fichaBdc) as Record<string, any>;
  assertEquals(r.info_base.marca, "SINOTRUK");
  assertEquals("anio" in r.info_base, false);
  assertEquals(r.versiones_detectadas, ["4x2", "4x4"]);
  assertEquals(r.especificaciones.motor.tipo_combustible, "Diésel");
});

Deno.test("caso negativo: sin quitar los escapes la ficha no es JSON", () => {
  let fallo = false;
  try {
    JSON.parse(fichaBdc);
  } catch {
    fallo = true;
  }
  assert(fallo);
});

const fila = (id: number, nombre: string, segmento: string, caracteristicas: string, ficha: unknown, precio: number) => ({
  id_modelo: id, nombre_modelo: nombre, nombre_segmento: segmento, caracteristicas, precio_venta: precio, moneda: "USD",
  json_ficha_tecnica: JSON.stringify(ficha), imagenes: `https://img/${id}-1.jpg,https://img/${id}-2.jpg`,
});
function catalogoFalso() {
  return bdcFalso({
    "oauth/token": token,
    botwa_marcas: { status: 200, body: { status: "success", data: [{ id: 3, nombre: "KEYTON" }, { id: 7, nombre: "LYNK & CO" }, { id: 9, nombre: "SINOTRUK CAMIONETAS" }] } },
    "botwa_modelos/3": { status: 200, body: { status: "success", data: [fila(82, "FURGONETA M70L EV", "VAN", "", { motor: { almacenamiento_bateria_kwh: "41.86", autonomia_km: "200 Km" } }, 22990)] } },
    "botwa_modelos/7": { status: 200, body: { status: "success", data: [
      fila(139, "LYNK & CO 02", "SUV", "SUV 100% Eléctrico: Autonomía: 435 km", { motor: { tipo_bateria: "NCM" } }, 39890),
      fila(161, "LYNK & CO 08 HALO", "SUV", "SUV Súper Híbrido enchufable, 200 km en modo puramente eléctrico", { motor: { tipo_tren_motriz: "Vehículo híbrido enchufable (PHEV)", octanaje: "92" } }, 45890),
    ] } },
    "botwa_modelos/9": { status: 200, body: { status: "success", data: [
      fila(152, "BOLDEN PICK UP 4X2 MT", "PICK UP", "4x2, Potencia 180 HP", { versiones: ["4x2", "4x4"], motor: { tipo_combustible: "Diésel" }, confort: { aire_acondicionado_automatico: "Sí", elevavidrios_electricos: "Sí" } }, 28990),
      fila(118, "BOLDEN PICK UP 4X4 MT", "PICK UP", "4x4, Potencia 180 HP", { versiones: ["4x2", "4x4"], motor: { tipo_combustible: "Diésel" } }, 31990),
    ] } },
  });
}

Deno.test("buscar por modelo sin marca: encuentra la marca", async () => {
  const r = await nuevo(catalogoFalso().f).buscar("quiero el bolden 4x4");
  const d = r.data as any;
  assertEquals(d.resultados[0].id_modelo, 118);
  assertEquals(d.resultados[0].marca, "SINOTRUK CAMIONETAS");
  assertEquals(d.resultados[0].id_marca, 9);
  assertEquals(d.resultados[0].sku, "VEH-118");
  assertEquals("texto" in d.resultados[0], false);
});

Deno.test("buscar eléctricos: EV primero como exactos; el enchufable como relacionado", async () => {
  const r = await nuevo(catalogoFalso().f).buscar("busco un carro eléctrico");
  const d = r.data as any;
  const exactos = d.resultados.filter((x: any) => x.coincidencia === "exacta").map((x: any) => x.id_modelo).sort((a: number, b: number) => a - b);
  assertEquals(exactos, [82, 139]);
  const r161 = d.resultados.find((x: any) => x.id_modelo === 161);
  assertEquals(r161?.coincidencia, "relacionada");
  assert(!d.resultados.some((x: any) => x.id_modelo === 118));
});

Deno.test("buscar 4x4: la 4x4 exacta; la 4x2 no es exacta aunque su ficha nombre 4x4", async () => {
  const r = await nuevo(catalogoFalso().f).buscar("una camioneta 4x4");
  const d = r.data as any;
  assertEquals(d.resultados[0].id_modelo, 118);
  assertEquals(d.resultados.find((x: any) => x.id_modelo === 152)?.coincidencia, "relacionada");
});

Deno.test("buscar «lynk 08»: el número del modelo cuenta; solo el 08 es exacto", async () => {
  const d = (await nuevo(catalogoFalso().f).buscar("lynk 08")).data as any;
  const exactos = d.resultados.filter((x: any) => x.coincidencia === "exacta").map((x: any) => x.id_modelo);
  assertEquals(exactos, [161]);
});

Deno.test("«eléctrico» no trae una diésel por sus elevavidrios eléctricos; MT no es automático", async () => {
  const d = (await nuevo(catalogoFalso().f).buscar("eléctrico")).data as any;
  assert(!d.resultados.some((x: any) => x.id_modelo === 152));
  const bolden = ((await nuevo(catalogoFalso().f).buscar("bolden 4x2")).data as any).resultados[0];
  assertEquals(bolden.id_modelo, 152);
  assert(bolden.etiquetas.includes("manual"));
  assert(!bolden.etiquetas.includes("automático"));
});

Deno.test("buscar sin términos útiles devuelve todo el catálogo; con marca filtra", async () => {
  const todo = await nuevo(catalogoFalso().f).buscar("quiero ver vehículos");
  assertEquals((todo.data as any).resultados.length, 5);
  const lynk = await nuevo(catalogoFalso().f).buscar("", 7);
  assertEquals((lynk.data as any).resultados.length, 2);
});

Deno.test("buscar algo que no existe es vacio, no error", async () => {
  const r = await nuevo(catalogoFalso().f).buscar("helicóptero");
  assertEquals(r.tipo, "vacio");
  assert(r.ok);
});

Deno.test("buscar con una marca caída es indisponible", async () => {
  const { f } = bdcFalso({
    "oauth/token": token,
    botwa_marcas: { status: 200, body: { status: "success", data: [{ id: 3, nombre: "KEYTON" }] } },
    "botwa_modelos/3": { status: 500 },
  });
  const r = await nuevo(f).buscar("keyton");
  assertEquals(r.tipo, "indisponible");
});
