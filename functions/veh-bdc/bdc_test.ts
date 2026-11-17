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
