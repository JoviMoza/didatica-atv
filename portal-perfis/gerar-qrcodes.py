"""Gera qr-professor.png e qr-aluno.png a partir dos links secretos do banco.

Uso: python gerar-qrcodes.py [--host 192.168.1.3] [--porta 8000]
Sem --host, detecta o IP da LAN automaticamente.
O servidor precisa ter rodado ao menos uma vez (é ele que cria os links).
"""

import argparse
import socket
import sqlite3
import sys
from pathlib import Path

try:
    import qrcode
except ImportError:
    sys.exit('Instale antes: pip install "qrcode[pil]"')

AQUI = Path(__file__).resolve().parent


def ip_lan() -> str:
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("8.8.8.8", 80))
        return s.getsockname()[0]
    except OSError:
        return "localhost"
    finally:
        s.close()


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--host", default=ip_lan())
    ap.add_argument("--porta", default="8000")
    args = ap.parse_args()
    db = AQUI / "portal.db"
    if not db.exists():
        sys.exit("portal.db não existe: rode o servidor uma vez para criar os links.")
    con = sqlite3.connect(db)
    links = {r[0]: r[1] for r in con.execute(
        "SELECT perfil, token FROM links WHERE ativo=1")}
    con.close()
    if "professor" not in links or "aluno" not in links:
        sys.exit("Links não encontrados: rode o servidor uma vez.")
    base = f"http://{args.host}:{args.porta}"
    alvos = {
        "qr-professor.png": f"{base}/p/{links['professor']}",
        "qr-aluno.png": f"{base}/a/{links['aluno']}",
    }
    for arquivo, url in alvos.items():
        qrcode.make(url).save(AQUI / arquivo)
        print(f"{arquivo} -> {url}")


if __name__ == "__main__":
    main()
