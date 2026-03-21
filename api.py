#!/usr/bin/env python3
"""Backend FastAPI para consultar transações do SQLite."""
from pathlib import Path
import sqlite3
import json
from typing import List, Optional

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
DB_PATH = DATA_DIR / "transactions.db"

app = FastAPI(title="Finanz API", version="1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:5174", "http://127.0.0.1:5174"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class Transaction(BaseModel):
    id: int
    source_file: Optional[str]
    account_name: Optional[str]
    date: Optional[str]
    description: Optional[str]
    amount: Optional[float]
    category: Optional[str]
    details: Optional[str]
    inserted_at: Optional[str]


class AccountMapping(BaseModel):
    path: str
    name: str


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

    where_clause = " AND ".join(where)
    if where_clause:
        where_clause = "WHERE " + where_clause

    sql = f"SELECT * FROM transactions {where_clause} ORDER BY date DESC, id DESC LIMIT ? OFFSET ?"
    params += [limit, offset]

    try:
        return _query(sql, tuple(params))
    except FileNotFoundError as e:
        raise HTTPException(status_code=500, detail=str(e))


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
