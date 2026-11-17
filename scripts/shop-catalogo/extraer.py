"""Extrae el catálogo de vehículos del BDC de Vehicentro a través de la Function veh-bdc.

Solo lectura. Llama a POST /marcas y POST /modelos {id_marca} con una API key de la
organización (la del perfil del Jelou CLI), que nunca se imprime ni se guarda.

Uso:
  python -I extraer.py --perfil vehicentro --salida catalogo-bdc.json
  (o con la variable VEH_API_KEY en lugar del perfil)
"""
import argparse
import json
import os
import sys
import urllib.request

BASE = "https://veh-bdc.fn.jelou.ai"


def api_key(perfil: str) -> str:
    if os.environ.get("VEH_API_KEY"):
        return os.environ["VEH_API_KEY"]
    ruta = os.path.expanduser("~/.jelou/credentials.json")
    with open(ruta, encoding="utf-8") as f:
        return json.load(f)["profiles"][perfil]["token"]


def post(ruta: str, cuerpo: dict, key: str) -> dict:
    req = urllib.request.Request(
        BASE + ruta,
        data=json.dumps(cuerpo).encode(),
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {key}"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=40) as r:
        return json.loads(r.read().decode("utf-8"))


def main() -> int:
    sys.stdout.reconfigure(encoding="utf-8")
    ap = argparse.ArgumentParser()
    ap.add_argument("--perfil", default="vehicentro")
    ap.add_argument("--salida", required=True)
    a = ap.parse_args()
    key = api_key(a.perfil)

    marcas = post("/marcas", {}, key)
    if not marcas.get("ok"):
        print(f"marcas: tipo={marcas.get('tipo')} mensaje={marcas.get('mensaje')}", file=sys.stderr)
        return 1
    salida = []
    for m in marcas["data"]:
        r = post("/modelos", {"id_marca": m["id"]}, key)
        modelos = r.get("data") or []
        print(f"{m['nombre']}: tipo={r.get('tipo')} modelos={len(modelos)}")
        if r.get("tipo") not in ("ok", "vacio"):
            print(f"  aviso: {r.get('mensaje')}", file=sys.stderr)
            return 1
        salida.append({"marca": m, "modelos": modelos})
    with open(a.salida, "w", encoding="utf-8") as f:
        json.dump(salida, f, ensure_ascii=False, indent=2)
    print(f"total modelos: {sum(len(x['modelos']) for x in salida)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
