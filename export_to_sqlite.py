#!/usr/bin/env python3
"""Extrai lançamentos da pasta export e grava em SQLite.

Suporta CSV/TSV/JSON/TXT e PDF (quando instalado pdfplumber/PyPDF2).
Coloca os dados em export/transactions.db.
"""

from __future__ import annotations
from pathlib import Path
import sqlite3
import csv
import json
import re
from datetime import datetime
from typing import Optional, Dict, List

BASE_DIR = Path(__file__).resolve().parent
EXPORT_DIR = BASE_DIR / "export"
DB_PATH = BASE_DIR / "export" / "transactions.db"


def normalize_amount(value: str) -> Optional[float]:
    if value is None:
        return None
    value_str = str(value).strip()
    if value_str == "":
        return None
    value_str = value_str.replace(" ", "")
    value_str = value_str.replace("\u00A0", "")
    if value_str.count(',') and value_str.count('.'):
        if value_str.rfind(',') > value_str.rfind('.'):
            value_str = value_str.replace('.', '').replace(',', '.')
        else:
            value_str = value_str.replace(',', '')
    elif value_str.count(','):
        value_str = value_str.replace(',', '.')

    try:
        return float(value_str)
    except ValueError:
        return None


def parse_date(value: str) -> Optional[str]:
    if not value:
        return None
    value = value.strip()

    # aceita dd/mm, dd/mm/yy e dd/mm/yyyy
    if re.fullmatch(r"\d{2}/\d{2}$", value):
        value = f"{value}/{datetime.today().year}"
    elif re.fullmatch(r"\d{2}/\d{2}/\d{2}$", value):
        # transformar 23 em 2023; inferir século próximo
        parts = value.split("/")
        year = int(parts[2])
        year = 2000 + year if year < 100 else year
        value = f"{parts[0]}/{parts[1]}/{year}"

    for fmt in ["%d/%m/%Y", "%Y-%m-%d", "%d-%m-%Y", "%d.%m.%Y"]:
        try:
            return datetime.strptime(value, fmt).date().isoformat()
        except ValueError:
            continue
    return None


def create_db(conn: sqlite3.Connection) -> None:
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            source_file TEXT,
            date TEXT,
            description TEXT,
            amount REAL,
            category TEXT,
            details TEXT,
            inserted_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
        """
    )
    conn.commit()


def insert_transaction(conn: sqlite3.Connection, source_file: str, row: Dict[str, Optional[str]]) -> None:
    conn.execute(
        """
        INSERT INTO transactions (source_file, date, description, amount, category, details)
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        (
            source_file,
            row.get("date"),
            row.get("description"),
            row.get("amount"),
            row.get("category"),
            row.get("details"),
        ),
    )


def consume_csv(path: Path, conn: sqlite3.Connection) -> int:
    with path.open("r", encoding="utf-8", errors="ignore") as f:
        reader = csv.DictReader(f)
        added = 0
        for raw in reader:
            candidate = {
                "date": parse_date(raw.get("date") or raw.get("data") or raw.get("Data") or raw.get("DATA")),
                "description": (raw.get("description") or raw.get("descricao") or raw.get("Descricao") or "").strip(),
                "amount": normalize_amount(raw.get("amount") or raw.get("valor") or raw.get("Valor") or raw.get("Amount")),
                "category": (raw.get("category") or raw.get("categoria") or "").strip(),
                "details": json.dumps(raw, ensure_ascii=False),
            }
            if candidate["date"] is None and candidate["amount"] is None:
                continue
            insert_transaction(conn, str(path), candidate)
            added += 1
        conn.commit()
        return added


def consume_json(path: Path, conn: sqlite3.Connection) -> int:
    with path.open("r", encoding="utf-8", errors="ignore") as f:
        data = json.load(f)
    if isinstance(data, dict):
        entries = data.get("transactions") or data.get("lancamentos") or data.get("movimentos") or []
        if not entries:
            entries = [data]
    elif isinstance(data, list):
        entries = data
    else:
        return 0

    added = 0
    for raw in entries:
        if not isinstance(raw, dict):
            continue
        candidate = {
            "date": parse_date(raw.get("date") or raw.get("data")),
            "description": str(raw.get("description") or raw.get("descricao") or "").strip(),
            "amount": normalize_amount(raw.get("amount") or raw.get("valor") or raw.get("Value")),
            "category": str(raw.get("category") or raw.get("categoria") or "").strip(),
            "details": json.dumps(raw, ensure_ascii=False),
        }
        if candidate["date"] is None and candidate["amount"] is None:
            continue
        insert_transaction(conn, str(path), candidate)
        added += 1
    conn.commit()
    return added


def consume_txt(path: Path, conn: sqlite3.Connection) -> int:
    lines = path.read_text(encoding="utf-8", errors="ignore").splitlines()
    return _consume_lines(lines, path, conn)


def _consume_lines(lines: List[str], path: Path, conn: sqlite3.Connection) -> int:
    added = 0
    regex = re.compile(r"^(?P<date>\d{2}/\d{2}(?:/\d{2,4})?)\s+(?P<desc>.+?)\s+(?P<amount>[-+]?[,\.\d]+)$")
    for line in lines:
        line = line.strip()
        if not line:
            continue
        m = regex.match(line)
        if not m:
            continue
        date = parse_date(m.group("date"))
        desc = m.group("desc").strip()
        amount = normalize_amount(m.group("amount"))
        if date is None or amount is None:
            continue
        candidate = {
            "date": date,
            "description": desc,
            "amount": amount,
            "category": "",
            "details": line,
        }
        insert_transaction(conn, str(path), candidate)
        added += 1
    conn.commit()
    return added


def consume_pdf(path: Path, conn: sqlite3.Connection) -> int:
    # Extrai dados estruturados de tabela com pdfplumber quando disponível.
    try:
        import pdfplumber
    except ModuleNotFoundError:
        pdfplumber = None

    inserted = 0

    if pdfplumber is not None:
        with pdfplumber.open(str(path)) as pdf:
            for page in pdf.pages:
                tables = page.extract_tables() or []
                for table in tables:
                    if not table or len(table) < 2:
                        continue

                    header = [str(x).strip().lower() if x is not None else "" for x in table[0]]
                    has_date = any("data" in h for h in header)
                    has_hist = any("hist" in h for h in header)
                    has_amount = any("r$" in h or "us$" in h or "valor" in h for h in header)

                    # match estrutura de extrato Bradesco detectada.
                    if not has_date or not has_hist or not has_amount:
                        continue

                    # iterar nas linhas da tabela, ignorar cabecalho
                    for linha in table[1:]:
                        if not linha or len(linha) < 2:
                            continue

                        data_cell = linha[0]
                        desc_cell = linha[1] if len(linha) > 1 else ""
                        amount_cell = linha[-1] if len(linha) > 0 else ""

                        date = parse_date(str(data_cell).strip())
                        if date is None:
                            continue

                        amount = normalize_amount(str(amount_cell).strip())
                        if amount is None:
                            continue

                        candidate = {
                            "date": date,
                            "description": str(desc_cell or "").strip(),
                            "amount": amount,
                            "category": "",
                            "details": json.dumps(linha, ensure_ascii=False),
                        }
                        insert_transaction(conn, str(path), candidate)
                        inserted += 1

            if inserted > 0:
                conn.commit()
                return inserted

    # Fallback por texto livre (PDF não tabular ou sem tabelas claras)
    text = None
    if pdfplumber is not None:
        with pdfplumber.open(str(path)) as pdf:
            pages = []
            for p in pdf.pages:
                pages.append(p.extract_text() or "")
            text = "\n".join(pages)

    if not text:
        try:
            from PyPDF2 import PdfReader
            r = PdfReader(str(path))
            pages = [p.extract_text() or "" for p in r.pages]
            text = "\n".join(pages)
        except ModuleNotFoundError:
            print("Aviso: nenhuma biblioteca de PDF instalada (pdfplumber ou PyPDF2). Consulte: pip install pdfplumber")
            return 0

    lines = text.splitlines()
    return _consume_lines(lines, path, conn)


def process_file(path: Path, conn: sqlite3.Connection) -> int:
    ext = path.suffix.lower()
    if ext in {".csv", ".tsv"}:
        return consume_csv(path, conn)
    if ext == ".json":
        return consume_json(path, conn)
    if ext in {".txt", ".log"}:
        return consume_txt(path, conn)
    if ext == ".pdf":
        return consume_pdf(path, conn)
    return 0


def main() -> None:
    EXPORT_DIR.mkdir(parents=True, exist_ok=True)
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(DB_PATH))
    create_db(conn)

    files = list(EXPORT_DIR.rglob("*.*"))
    total = 0
    errors = []

    for path in sorted(files):
        inserted = 0
        try:
            inserted = process_file(path, conn)
        except Exception as exc:
            errors.append((path, str(exc)))
            continue

        if inserted > 0:
            print(f"{path}: inseridos {inserted} lançamentos")
        else:
            print(f"{path}: nenhum lançamento identificado")
        total += inserted

    conn.close()

    print("---")
    print(f"Total de lançamentos inseridos: {total}")
    if errors:
        print(f"Erros em {len(errors)} arquivo(s):")
        for path, msg in errors:
            print(f" - {path}: {msg}")


if __name__ == "__main__":
    main()
