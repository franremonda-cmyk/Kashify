#!/usr/bin/env python3
"""Lo que vence hoy o está vencido en TAREAS.md, comparado con el reloj real.

Uso: python3 agenda.py [días]   (por defecto mira hoy, lo vencido y los próximos 7 días)
"""
import re, sys
from datetime import date, timedelta
from pathlib import Path

ventana = int(sys.argv[1]) if len(sys.argv) > 1 else 7
hoy = date.today()
lineas = Path(__file__).with_name("TAREAS.md").read_text().splitlines()
vencidas, de_hoy, pronto = [], [], []
for l in lineas:
    m = re.search(r"`(\d{4})-(\d{2})-(\d{2})`", l)
    if not m:
        continue
    f = date(*map(int, m.groups()))
    # la segunda celda de la tabla es la tarea
    celdas = [c.strip() for c in l.split("|")]
    # el ✅ solo cuenta en la celda de estado (la última): una tarea pendiente puede
    # contar pasos ya cumplidos en su texto y seguía desapareciendo de la agenda
    if "✅" in (celdas[-2] if len(celdas) > 4 else l):
        continue
    que = re.sub(r"\*\*|\[|\]\(.*?\)", "", celdas[2])[:95] if len(celdas) > 2 else l
    quien = celdas[3] if len(celdas) > 3 else ""
    fila = f"  {f.strftime('%d/%m')}  {que}" + (f"   → {quien}" if quien else "")
    (vencidas if f < hoy else de_hoy if f == hoy else pronto if f <= hoy + timedelta(days=ventana) else []).append(fila)

print(f"Hoy es {hoy.strftime('%A %d/%m/%Y')}\n")
for titulo, grupo in (("🔴 VENCIDAS", vencidas), ("🔜 HOY", de_hoy), (f"⏳ Próximos {ventana} días", pronto)):
    if grupo:
        print(titulo)
        print("\n".join(grupo))
        print()
if not (vencidas or de_hoy):
    print("Nada vencido ni para hoy.")
