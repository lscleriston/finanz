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
DATA_DIR = BASE_DIR / "data"
DB_PATH = DATA_DIR / "finanzdb.db"
MAPPING_FILE = DATA_DIR / "account_mappings.json"


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


def _load_account_mappings() -> List[Dict[str, str]]:
    if not MAPPING_FILE.exists():
        return []
    try:
        with MAPPING_FILE.open("r", encoding="utf-8") as f:
            data = json.load(f)
        if isinstance(data, list):
            return [m for m in data if isinstance(m, dict) and "path" in m and "name" in m]
    except Exception:
        return []
    return []


def _find_account_name(resource_path: str, default_name: Optional[str]) -> Optional[str]:
    mappings = _load_account_mappings()
    candidate = default_name
    best_len = -1
    for m in mappings:
        mpath = m["path"].rstrip("/")
        if mpath.startswith("/"):
            mpath = mpath[1:]
        if repository_path := resource_path.lstrip("/"):
            if repository_path.startswith(mpath) and len(mpath) > best_len:
                candidate = m["name"]
                best_len = len(mpath)
    return candidate


def create_db(conn: sqlite3.Connection) -> None:
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS accounts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE NOT NULL,
            path TEXT NOT NULL,
            tipo TEXT NOT NULL,
            invert_values INTEGER NOT NULL DEFAULT 0
        )
        """
    )

    cur = conn.cursor()
    cur.execute("PRAGMA table_info(accounts)")
    account_cols = {row[1] for row in cur.fetchall()}
    if "path" not in account_cols:
        conn.execute("ALTER TABLE accounts ADD COLUMN path TEXT")
    if "tipo" not in account_cols:
        conn.execute("ALTER TABLE accounts ADD COLUMN tipo TEXT NOT NULL DEFAULT ''")
    if "invert_values" not in account_cols:
        conn.execute("ALTER TABLE accounts ADD COLUMN invert_values INTEGER NOT NULL DEFAULT 0")

    # Migração: para contas antigas sem tipo, extrai do path se possível
    conn.execute(
        "UPDATE accounts SET tipo = TRIM(SUBSTR(path, 1, INSTR(path, '/') - 1)) WHERE tipo='' AND path LIKE '%/%'"
    )

    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            source_file TEXT,
            account_id INTEGER,
            date TEXT,
            description TEXT,
            amount REAL,
            category TEXT,
            details TEXT,
            inserted_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(account_id) REFERENCES accounts(id)
        )
        """
    )

    # caso tabela exista sem a coluna nova, adiciona
    cur = conn.cursor()
    cur.execute("PRAGMA table_info(transactions)")
    existing_cols = {row[1] for row in cur.fetchall()}
    if "account_id" not in existing_cols:
        conn.execute("ALTER TABLE transactions ADD COLUMN account_id INTEGER")

    # Índice único para evitar duplicatas de linhas repetidas
    conn.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_unique ON transactions (account_id, date, description, amount)"
    )
    conn.commit()


_CURRENT_ACCOUNT_NAME: Optional[str] = None


def _normalize_amount_for_account(
    account_tipo: Optional[str],
    account_name: Optional[str],
    description: Optional[str],
    amount: Optional[float],
    invert_values: bool = False,
) -> Optional[float]:
    if amount is None:
        return None

    if not account_tipo and not account_name:
        value = amount
    else:
        lower_tipo = (account_tipo or "").strip().lower()
        lower_name = (account_name or "").strip().lower()

        is_card = any(x in lower_tipo for x in ["cartao", "cartão", "cartãocredito"]) or any(
            x in lower_name for x in ["cartao", "cartão", "cartãocredito"]
        )

        if is_card:
            # Para contas de cartão de crédito:
            # - valores positivos no extrato são despesas (débito) -> armazenar negativo
            # - valores negativos no extrato são créditos/pagamentos -> armazenar positivo
            if amount > 0:
                value = -abs(amount)
            elif amount < 0:
                value = abs(amount)
            else:
                value = 0.0
        else:
            value = amount

    if invert_values and value is not None and value != 0:
        return -value

    return value


def _get_account_info(conn: sqlite3.Connection, account_name: Optional[str]) -> Optional[Dict[str, Optional[str]]]:
    if not account_name:
        return None

    normalized = account_name.strip("/ ")
    lower_norm = normalized.lower()

    cur = conn.cursor()
    # 1) procurar por nome exato (case insensitive)
    cur.execute("SELECT id, name, tipo, path, invert_values FROM accounts WHERE lower(name) = ?", (lower_norm,))
    row = cur.fetchone()
    if row:
        return {"id": row[0], "name": row[1], "tipo": row[2], "path": row[3], "invert_values": bool(row[4])}

    # 2) procurar por path exato
    cur.execute("SELECT id, name, tipo, path, invert_values FROM accounts WHERE lower(path) = ?", (lower_norm,))
    row = cur.fetchone()
    if row:
        return {"id": row[0], "name": row[1], "tipo": row[2], "path": row[3], "invert_values": bool(row[4])}

    # 3) tentar com última parte de path
    if "/" in normalized:
        final = normalized.split("/")[-1].strip().lower()
        cur.execute("SELECT id, name, tipo, path, invert_values FROM accounts WHERE lower(name) = ?", (final,))
        row = cur.fetchone()
        if row:
            return {"id": row[0], "name": row[1], "tipo": row[2], "path": row[3], "invert_values": bool(row[4])}

    return None


def _get_account_id(conn: sqlite3.Connection, account_name: Optional[str]) -> Optional[int]:
    account = _get_account_info(conn, account_name)
    if account:
        return account.get("id")
    return None


def _get_account_tipo(conn: sqlite3.Connection, account_id: int) -> Optional[str]:
    cur = conn.cursor()
    cur.execute("SELECT tipo FROM accounts WHERE id = ?", (account_id,))
    row = cur.fetchone()
    return row[0] if row else None


def insert_transaction(conn: sqlite3.Connection, source_file: str, row: Dict[str, Optional[str]]) -> bool:
    account_name = row.get("account_name") or _CURRENT_ACCOUNT_NAME
    account_id = row.get("account_id")
    account_tipo = None

    account_invert = False
    if account_id is not None:
        account_tipo = _get_account_tipo(conn, account_id)
        cur = conn.cursor()
        cur.execute("SELECT invert_values FROM accounts WHERE id = ?", (account_id,))
        row_iv = cur.fetchone()
        if row_iv is not None:
            account_invert = bool(row_iv[0])
    else:
        account_info = _get_account_info(conn, account_name)
        if account_info:
            account_id = account_info.get("id")
            account_tipo = account_info.get("tipo")
            account_invert = bool(account_info.get("invert_values", False))

    if account_id is None:
        # Não processa transação sem conta cadastrada
        print(f"Aviso: ignorando transação sem conta cadastrada: account_name={account_name}, date={row.get('date')}, desc={row.get('description')}")
        return False

    normalized_amount = _normalize_amount_for_account(
        account_tipo,
        account_name,
        row.get("description"),
        row.get("amount"),
        invert_values=account_invert,
    )

    conn.execute(
        """
        INSERT OR IGNORE INTO transactions (source_file, account_id, date, description, amount, category, details)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
        (
            source_file,
            account_id,
            row.get("date"),
            row.get("description"),
            normalized_amount,
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
            if insert_transaction(conn, str(path), candidate):
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
        if insert_transaction(conn, str(path), candidate):
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
                        if insert_transaction(conn, str(path), candidate):
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


def _extract_account_info(path: Path) -> Dict[str, Optional[str]]:
    try:
        rel = path.relative_to(EXPORT_DIR)
    except ValueError:
        return {"account_name": None}

    parts = rel.parts
    # Por padrão, usar a pasta pai quando disponível (e.g. CartaoCredito/Bradesco)
    account_name = None
    if len(parts) > 1:
        account_name = f"{parts[0]}/{parts[1]}"
    elif len(parts) > 0:
        account_name = parts[0]

    account_name = _find_account_name(rel.as_posix(), account_name)
    return {"account_name": account_name}



def process_file(path: Path, conn: sqlite3.Connection, force_account_name: Optional[str] = None) -> int:
    account_info = _extract_account_info(path)
    ext = path.suffix.lower()

    global _CURRENT_ACCOUNT_NAME
    old_account_name = _CURRENT_ACCOUNT_NAME
    _CURRENT_ACCOUNT_NAME = force_account_name or account_info.get("account_name")

    try:
        if ext in {".csv", ".tsv"}:
            return consume_csv(path, conn)
        if ext == ".json":
            return consume_json(path, conn)
        if ext in {".txt", ".log"}:
            return consume_txt(path, conn)
        if ext == ".pdf":
            return consume_pdf(path, conn)
        return 0
    finally:
        _CURRENT_ACCOUNT_NAME = old_account_name


def main() -> None:
    EXPORT_DIR.mkdir(parents=True, exist_ok=True)
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)

    # limpeza automática antes de recarregar (evita duplicação por repeats)
    # preserva contas existentes e limpa somente lançamentos.
    if DB_PATH.exists():
        conn = sqlite3.connect(str(DB_PATH))
        create_db(conn)
        conn.execute("DELETE FROM transactions")
        conn.commit()
        print(f"Banco existente preservado: {DB_PATH}. Transações limpas e nova carga iniciada.")
    else:
        conn = sqlite3.connect(str(DB_PATH))
        create_db(conn)
        print(f"Banco criado: {DB_PATH}. Iniciando carga limpa.")

    # Varre cada conta cadastrada e importa arquivos da pasta indicada por account.path.
    cur = conn.cursor()
    cur.execute("SELECT id, name, path FROM accounts")
    accounts = cur.fetchall()

    total = 0
    errors = []

    for account_id, account_name, account_path in accounts:
        if not account_path:
            print(f"Aviso: conta '{account_name}' sem pasta configurada (path). Ignorando.)")
            continue

        base_folder = Path(account_path)
        if not base_folder.is_absolute():
            base_folder = EXPORT_DIR / base_folder

        if not base_folder.exists():
            print(f"Aviso: pasta '{base_folder}' não existe para conta '{account_name}'. Ignorando.")
            continue

        for path in sorted([f for f in base_folder.rglob("*.*") if f != DB_PATH and f.suffix.lower() != ".db"]):
            inserted = 0
            try:
                inserted = process_file(path, conn, force_account_name=account_name)
            except Exception as exc:
                errors.append((path, str(exc)))
                continue

            if inserted > 0:
                print(f"{path}: inseridos {inserted} lançamentos")
            else:
                print(f"{path}: nenhum lançamento identificado")
            total += inserted

    if not accounts:
        files = [f for f in EXPORT_DIR.rglob("*.*") if f != DB_PATH and f.suffix.lower() != ".db"]
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
