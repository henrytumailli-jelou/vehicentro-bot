"""Carga el catálogo del BDC (salida de extraer.py) en Jelou Shop de Vehicentro.

- SKU = VEH-<id_modelo>: estable y el agente recupera el id_modelo del BDC desde el SKU.
  El upsert es por SKU, así que correrlo otra vez actualiza en lugar de duplicar.
- Categoría = marca (KEYTON, LYNK & CO, SINOTRUK AUTOS, SINOTRUK CAMIONETAS).
- Precio del BDC en USD; stock ilimitado (el BDC no informa stock).
- Descripción = características del BDC + datos principales de la ficha.
- Imágenes: se descargan de la CDN del cliente y se suben con `jelou shop products images add`;
  solo se suben si el producto todavía no tiene imágenes (no duplica al repetir).

Uso:
  python -I cargar.py --catalogo catalogo-bdc.json --perfil vehicentro [--solo VEH-82] [--sin-imagenes] [--simular]
"""
import argparse
import json
import os
import re
import subprocess
import sys
import tempfile
import urllib.parse
import urllib.request

PREFIJO = "VEH-"

# Datos de la ficha que se muestran, en orden: (clave en la ficha, etiqueta)
FICHA = [
    ("tipo_de_tren_motriz", "Tren motriz"),
    ("motor", "Motor"),
    ("potencia_maxima_combinada_kw_hp", "Potencia combinada (kW/hp)"),
    ("potencia_maxima_kw_hp", "Potencia (kW/hp)"),
    ("potencia_maxima_kw", "Potencia (kW)"),
    ("autonomia_km", "Autonomía (km)"),
    ("capacidad_de_la_bateria_de_potencia_kwh", "Batería (kWh)"),
    ("transmision", "Transmisión"),
    ("traccion", "Tracción"),
    ("cilindrada", "Cilindrada"),
    ("combustible", "Combustible"),
]


def jelou(args, perfil, entrada=None):
    r = subprocess.run(
        ["jelou", *args, "--profile", perfil, "--agent"],
        capture_output=True, text=True, encoding="utf-8", input=entrada, shell=(os.name == "nt"),
    )
    try:
        return json.loads(r.stdout)
    except json.JSONDecodeError:
        return {"ok": False, "error": {"message": (r.stdout or r.stderr)[:400]}}


def datos_ficha(ficha: str) -> list[str]:
    """La ficha llega como texto con JSON escapado y recortado: se extraen valores con regex."""
    if not ficha:
        return []
    t = ficha.replace("\\_", "_").replace("\\[", "[").replace("\\]", "]")
    lineas, vistos = [], set()
    for clave, etiqueta in FICHA:
        m = re.search(r'"' + re.escape(clave) + r'"\s*:\s*\[?\s*"([^"]+)"', t)
        if m and etiqueta not in vistos:
            lineas.append(f"{etiqueta}: {m.group(1).strip()}")
            vistos.add(etiqueta)
    return lineas


def producto(marca: dict, m: dict) -> dict:
    partes = []
    if m.get("caracteristicas"):
        partes.append(str(m["caracteristicas"]).strip())
    ficha = datos_ficha(m.get("ficha") or "")
    if ficha:
        partes.append("\n".join(ficha))
    partes.append(f"Marca: {marca['nombre']} · Segmento: {m.get('segmento') or '-'}")
    # La marca en el nombre ayuda a la búsqueda del Shop y se ve en el carrusel
    # («FURGONETA M70L EV» → «KEYTON FURGONETA M70L EV»; «U70 FULL» → «SINOTRUK U70 FULL»).
    nombre = str(m["nombre"]).strip()
    prefijo = marca["nombre"].split()[0]
    if prefijo.upper() not in nombre.upper():
        nombre = f"{prefijo} {nombre}"
    return {
        "sku": f"{PREFIJO}{m['id_modelo']}",
        "name": nombre,
        "description": "\n\n".join(partes),
        "price": float(m.get("precio") or 0),
        "has_tax": False,
        "status": True,
        "stock_type": "unlimited",
        "categories": [marca["nombre"]],
    }


LIMITE_IMAGEN = 500 * 1024  # el Shop rechaza imágenes de más de 512 KB


def reducir(ruta: str) -> str:
    """Si la imagen pasa el límite del Shop, la redimensiona (lado mayor 1600 px) y la
    recomprime como JPEG hasta que entre. Devuelve la ruta del archivo a subir."""
    if os.path.getsize(ruta) <= LIMITE_IMAGEN:
        return ruta
    from PIL import Image  # solo hace falta cuando hay imágenes grandes

    img = Image.open(ruta).convert("RGB")
    img.thumbnail((1600, 1600))
    salida = os.path.splitext(ruta)[0] + ".jpg"
    for calidad in (85, 75, 65, 55):
        img.save(salida, "JPEG", quality=calidad, optimize=True)
        if os.path.getsize(salida) <= LIMITE_IMAGEN:
            break
    return salida


def subir_imagenes(sku: str, urls: list[str], perfil: str) -> str:
    """Sube en orden las imágenes que falten. El Shop guarda el nombre del archivo
    (<SKU>-<nn>), así que repetir la carga no duplica fotos."""
    actual = jelou(["shop", "products", "list", "--search", sku], perfil)
    prods = [p for p in (actual.get("data") or {}).get("data", []) if p.get("sku") == sku]
    if not prods:
        return "producto no encontrado"
    ya = {os.path.splitext(m.get("file_name") or "")[0] for m in prods[0].get("media") or []}
    ok, omitidas = 0, 0
    with tempfile.TemporaryDirectory() as d:
        for i, url in enumerate(urls, 1):
            base = f"{sku}-{i:02d}"
            if base in ya:
                omitidas += 1
                continue
            ext = os.path.splitext(url.split("?")[0])[1].lower() or ".jpg"
            ruta = os.path.join(d, base + ext)
            try:
                # Algunas URLs del CRM traen espacios («CAMIONETA 4X2.png»)
                segura = urllib.parse.quote(url, safe=":/?&=%#")
                with urllib.request.urlopen(segura, timeout=30) as r, open(ruta, "wb") as f:
                    f.write(r.read())
                ruta = reducir(ruta)
            except Exception as e:  # noqa: BLE001
                # Se corta aquí para no dejar las fotos fuera de orden (la 1 es la portada)
                print(f"    imagen {i}: no se descargó o no se pudo reducir ({e.__class__.__name__}); se detiene este producto")
                break
            res = jelou(["shop", "products", "images", "add", sku, "--file", ruta], perfil)
            if res.get("ok"):
                ok += 1
            else:
                print(f"    imagen {i}: {res.get('error', {}).get('message')}; se detiene este producto")
                break
    return f"{ok} subidas, {omitidas} ya estaban, de {len(urls)}"


def main() -> int:
    sys.stdout.reconfigure(encoding="utf-8")
    ap = argparse.ArgumentParser()
    ap.add_argument("--catalogo", required=True)
    ap.add_argument("--perfil", default="vehicentro")
    ap.add_argument("--solo", help="SKU único a cargar (prueba)")
    ap.add_argument("--sin-imagenes", action="store_true")
    ap.add_argument("--simular", action="store_true", help="solo imprime lo que cargaría")
    a = ap.parse_args()

    with open(a.catalogo, encoding="utf-8") as f:
        catalogo = json.load(f)
    filas = [(x["marca"], m) for x in catalogo for m in x["modelos"]]
    productos = [(producto(mc, m), m.get("imagenes") or []) for mc, m in filas]
    if a.solo:
        productos = [p for p in productos if p[0]["sku"] == a.solo]
    print(f"productos a cargar: {len(productos)}")
    for p, imgs in productos:
        print(f"  {p['sku']} | {p['categories'][0]} | {p['name']} | USD {p['price']:,.0f} | {len(imgs)} imágenes")
    if a.simular:
        print(json.dumps(productos[0][0], ensure_ascii=False, indent=2) if productos else "")
        return 0

    with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False, encoding="utf-8") as f:
        json.dump({"resources": [p for p, _ in productos]}, f, ensure_ascii=False)
        archivo = f.name
    try:
        res = jelou(["shop", "products", "upsert", "--file", archivo, "--sync"], a.perfil)
    finally:
        os.unlink(archivo)
    print("upsert:", json.dumps(res.get("data") if res.get("ok") else res.get("error"), ensure_ascii=False)[:600])
    if not res.get("ok"):
        return 1
    if not a.sin_imagenes:
        for p, imgs in productos:
            print(f"  {p['sku']}: {subir_imagenes(p['sku'], imgs, a.perfil)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
