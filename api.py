#!/usr/bin/env python3
"""Backend FastAPI para consultar transações do SQLite."""
from pathlib import Path
import sqlite3
import json
import re
from typing import List, Optional

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
DB_PATH = DATA_DIR / "finanzdb.db"

app = FastAPI(title="Finanz API", version="1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
        "http://localhost:8080",
        "http://127.0.0.1:8080",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class Transaction(BaseModel):
    id: int
    source_file: Optional[str]
    account_name: Optional[str]
    account_id: Optional[int]
    date: Optional[str]
    description: Optional[str]
    amount: Optional[float]
    category: Optional[str]
    details: Optional[str]
    inserted_at: Optional[str]


class AccountMapping(BaseModel):
    path: str
    name: str


class Account(BaseModel):
    id: int
    name: str
    path: str
    tipo: str


class AccountCreate(BaseModel):
    name: str
    tipo: str


class TransactionCreate(BaseModel):
    source_file: Optional[str] = None
    account_name: Optional[str] = None
    account_id: Optional[int] = None
    date: Optional[str] = None
    description: Optional[str] = None
    amount: Optional[float] = None
    category: Optional[str] = None
    details: Optional[str] = None


MAPPING_FILE = DATA_DIR / "account_mappings.json"


def _query(sql: str, params: tuple = ()) -> List[dict]:
    if not DB_PATH.exists():
        raise FileNotFoundError(f"Banco de dados não encontrado: {DB_PATH}")

    con = sqlite3.connect(str(DB_PATH))
    con.row_factory = sqlite3.Row
    cur = con.cursor()
    cur.execute(sql, params)
    rows = cur.fetchall()
    con.close()
    return [dict(r) for r in rows]


def _read_mappings() -> List[dict]:
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


def _write_mappings(mappings: List[dict]) -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    with MAPPING_FILE.open("w", encoding="utf-8") as f:
        json.dump(mappings, f, ensure_ascii=False, indent=2)


def _slugify(value: str) -> str:
    s = value.strip().lower()
    s = re.sub(r"[^a-z0-9]+", "-", s)
    s = s.strip("-")
    if not s:
        return "account"
    return s


@app.get("/api/account-mappings", response_model=List[AccountMapping])
def get_account_mappings():
    return _read_mappings()


@app.post("/api/account-mappings", response_model=List[AccountMapping])
def set_account_mapping(mapping: AccountMapping):
    lst = _read_mappings()
    path = mapping.path.rstrip("/")
    if path.startswith("/"):
        path = path[1:]
    found = False
    for item in lst:
        if item["path"] == path:
            item["name"] = mapping.name
            found = True
            break
    if not found:
        lst.append({"path": path, "name": mapping.name})
    _write_mappings(lst)
    return lst


@app.delete("/api/account-mappings", response_model=List[AccountMapping])
def delete_account_mapping(path: str = Query(...)):
    lst = _read_mappings()
    normalized = path.rstrip("/")
    if normalized.startswith("/"):
        normalized = normalized[1:]
    lst = [item for item in lst if item["path"] != normalized]
    _write_mappings(lst)
    return lst


@app.get("/api/accounts", response_model=List[Account])
def get_accounts():
    try:
        return _query("SELECT * FROM accounts ORDER BY name")
    except FileNotFoundError as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/accounts", response_model=Account)
def create_account(account: AccountCreate):
    if not DB_PATH.exists():
        raise HTTPException(status_code=500, detail=f"Banco não encontrado: {DB_PATH}")
    if not account.name.strip() or not account.tipo.strip():
        raise HTTPException(status_code=400, detail="Nome da conta e tipo não podem ser vazios")

    name = account.name.strip()
    tipo = account.tipo.strip()
    slug_name = _slugify(name)
    normalized_tipo = _slugify(tipo)

    account_path = f"{normalized_tipo}/{slug_name}"
    full_path = BASE_DIR / "export" / account_path
    full_path.mkdir(parents=True, exist_ok=True)

    conn = sqlite3.connect(str(DB_PATH))
    try:
        cur = conn.cursor()
        cur.execute(
            "INSERT OR IGNORE INTO accounts (name, path, tipo) VALUES (?, ?, ?)",
            (name, account_path, tipo),
        )
        conn.commit()
        cur.execute("SELECT * FROM accounts WHERE name = ?", (name,))
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=500, detail="Erro ao criar conta")
        return {"id": row[0], "name": row[1], "path": row[2], "tipo": row[3]}
    finally:
        conn.close()


@app.delete("/api/accounts")
def delete_account(id: int = Query(..., ge=1)):
    if not DB_PATH.exists():
        raise HTTPException(status_code=500, detail=f"Banco não encontrado: {DB_PATH}")

    conn = sqlite3.connect(str(DB_PATH))
    try:
        cur = conn.cursor()
        cur.execute("DELETE FROM accounts WHERE id = ?", (id,))
        conn.commit()
        if cur.rowcount == 0:
            raise HTTPException(status_code=404, detail=f"Conta com id {id} não encontrada")
        return {"status": "deleted", "id": id}
    finally:
        conn.close()


@app.post("/api/reload")
def reload_data():
    import subprocess

    try:
        subprocess.run(["python3", str(BASE_DIR / "export_to_sqlite.py")], check=True)
        return {"status": "ok"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/transactions", response_model=List[Transaction])
def get_transactions(
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    q: Optional[str] = Query(None),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    account_id: Optional[int] = Query(None, ge=1),
):
    where = []
    params: List[str] = []

    if q:
        where.append("(description LIKE ? OR source_file LIKE ? OR category LIKE ?)")
        like = f"%{q}%"
        params += [like, like, like]

    if date_from:
        where.append("date >= ?")
        params.append(date_from)

    if date_to:
        where.append("date <= ?")
        params.append(date_to)

    if account_id is not None:
        where.append("account_id = ?")
        params.append(account_id)

    where_clause = " AND ".join(where)
    if where_clause:
        where_clause = "WHERE " + where_clause

    sql = f"""
    SELECT
        t.id,
        t.source_file,
        a.name AS account_name,
        t.account_id,
        t.date,
        t.description,
        t.amount,
        t.category,
        t.details,
        t.inserted_at
    FROM transactions t
    LEFT JOIN accounts a ON t.account_id = a.id
    {where_clause}
    ORDER BY t.date DESC, t.id DESC
    LIMIT ? OFFSET ?
    """
    params += [limit, offset]

    try:
        return _query(sql, tuple(params))
    except FileNotFoundError as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/transactions", response_model=Transaction)
def create_transaction(tx: TransactionCreate):
    if not DB_PATH.exists():
        raise HTTPException(status_code=500, detail=f"Banco não encontrado: {DB_PATH}")

    db = sqlite3.connect(str(DB_PATH))
    try:
        cur = db.cursor()
        cur.execute(
            """
            INSERT INTO transactions (source_file, account_id, date, description, amount, category, details)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                tx.source_file,
                tx.account_id,
                tx.date,
                tx.description,
                tx.amount,
                tx.category,
                tx.details,
            ),
        )
        db.commit()
        new_id = cur.lastrowid
        row = _query("SELECT * FROM transactions WHERE id = ?", (new_id,))[0]
        return row
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        db.close()


@app.delete("/api/transactions")
def delete_transaction(id: int = Query(..., ge=1)):
    if not DB_PATH.exists():
        raise HTTPException(status_code=500, detail=f"Banco não encontrado: {DB_PATH}")

    db = sqlite3.connect(str(DB_PATH))
    try:
        cur = db.cursor()
        cur.execute("DELETE FROM transactions WHERE id = ?", (id,))
        db.commit()
        if cur.rowcount == 0:
            raise HTTPException(status_code=404, detail=f"Transação com id {id} não encontrada")
        return {"status": "deleted", "id": id}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        db.close()


@app.get("/api/summary")
def get_summary():
    if not DB_PATH.exists():
        raise HTTPException(status_code=500, detail=f"Banco não encontrado: {DB_PATH}")

    sql = "SELECT COUNT(*) AS total, SUM(amount) AS total_amount FROM transactions"
    try:
        stats = _query(sql)[0]
        return {
            "total_records": stats.get("total", 0),
            "total_amount": stats.get("total_amount", 0.0),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
