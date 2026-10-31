#!/usr/bin/env python3
"""Arma el Atajo de iPhone con la clave adentro y lo deja firmado en ~/Downloads.

Correr desde proyectos/neo-app: python3 scripts/armar-atajo.py
Rehacerlo cuando cambie ATAJO_TOKEN. El archivo lleva la clave: se borra después de
importarlo y nunca se commitea.
"""
import os
import plistlib
import subprocess
import tempfile
import uuid
from pathlib import Path

URL = "https://kashify.vercel.app/api/neo/atajo"
SALIDA = Path.home() / "Downloads" / "Neo.shortcut"
OBJETO = "￼"  # lugar que ocupa una variable dentro de un texto de Atajos


def leer_token() -> str:
    for linea in Path(".env.local").read_text().splitlines():
        if linea.startswith("ATAJO_TOKEN="):
            return linea.split("=", 1)[1].strip()
    raise SystemExit("Falta ATAJO_TOKEN en .env.local")


def texto(valor: str) -> dict:
    return {"Value": {"string": valor, "attachmentsByRange": {}}, "WFSerializationType": "WFTextTokenString"}


def variable(id_accion: str, nombre: str) -> dict:
    adjunto = {"OutputName": nombre, "OutputUUID": id_accion, "Type": "ActionOutput"}
    return {"Value": {"string": OBJETO, "attachmentsByRange": {"{0, 1}": adjunto}}, "WFSerializationType": "WFTextTokenString"}


def campos(*pares: tuple[dict, dict]) -> dict:
    items = [{"WFItemType": 0, "WFKey": clave, "WFValue": valor} for clave, valor in pares]
    return {"Value": {"WFDictionaryFieldValueItems": items}, "WFSerializationType": "WFDictionaryFieldValue"}


def atajo(token: str) -> dict:
    pedir, enviar = str(uuid.uuid4()).upper(), str(uuid.uuid4()).upper()
    return {
        "WFWorkflowClientVersion": "2607.0.5",
        "WFWorkflowMinimumClientVersion": 900,
        "WFWorkflowIcon": {"WFWorkflowIconStartColor": 463140863, "WFWorkflowIconGlyphNumber": 59511},
        "WFWorkflowTypes": [],
        "WFWorkflowInputContentItemClasses": [],
        "WFWorkflowOutputContentItemClasses": [],
        "WFWorkflowImportQuestions": [],
        "WFWorkflowActions": [
            {
                "WFWorkflowActionIdentifier": "is.workflow.actions.ask",
                "WFWorkflowActionParameters": {"UUID": pedir, "WFAskActionPrompt": "¿Qué anoto?", "WFInputType": "Text"},
            },
            {
                "WFWorkflowActionIdentifier": "is.workflow.actions.downloadurl",
                "WFWorkflowActionParameters": {
                    "UUID": enviar,
                    "WFURL": URL,
                    "WFHTTPMethod": "POST",
                    "ShowHeaders": True,
                    "WFHTTPHeaders": campos((texto("Authorization"), texto(f"Bearer {token}"))),
                    "WFHTTPBodyType": "JSON",
                    "WFJSONValues": campos((texto("message"), variable(pedir, "Entrada proporcionada"))),
                },
            },
            {
                "WFWorkflowActionIdentifier": "is.workflow.actions.showresult",
                "WFWorkflowActionParameters": {"Text": variable(enviar, "Contenido de la URL")},
            },
        ],
    }


with tempfile.TemporaryDirectory() as carpeta:
    crudo = Path(carpeta) / "Neo.shortcut"
    crudo.write_bytes(plistlib.dumps(atajo(leer_token()), fmt=plistlib.FMT_BINARY))
    subprocess.run(["shortcuts", "sign", "--mode", "anyone", "--input", str(crudo), "--output", str(SALIDA)], check=True)

SALIDA.chmod(0o600)
print(f"Listo: {SALIDA} ({SALIDA.stat().st_size} bytes)")
