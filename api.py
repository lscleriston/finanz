#!/usr/bin/env python3
"""Backend FastAPI para consultar transações do SQLite."""
from pathlib import Path
import sqlite3
import json
import re
import shutil
import subprocess
from datetime import datetime
from typing import List, Optional

from fastapi import FastAPI, HTTPException, Query, UploadFile, File, Form, Body
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
DB_PATH = DATA_DIR / "finanzdb.db"

app = FastAPI(title="Finanz API", version="1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/ping")
def ping():
    return {"status": "ok"}



class Transaction(BaseModel):
    id: int
    source_file: Optional[str] = None
    account_name: Optional[str] = None
    account_id: Optional[int] = None
    date: Optional[str] = None
    original_date: Optional[str] = None
    description: Optional[str] = None
    amount: Optional[float] = None
    category: Optional[str] = None
    category_id: Optional[int] = None
    details: Optional[str] = None
    inserted_at: Optional[str] = None


class Category(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    parent_id: Optional[int] = None


class CategoryCreate(BaseModel):
    name: str
    description: Optional[str] = None
    parent_id: Optional[int] = None


class CategoryMapping(BaseModel):
    id: int
    pattern: str
    match_type: str
    category_id: int
    priority: int
    active: bool


class CategoryMappingCreate(BaseModel):
    pattern: str
    match_type: str = "substring"
    category_id: int
    priority: int = 100
    active: bool = True


class AccountMapping(BaseModel):
    path: str
    name: str


class Account(BaseModel):
    id: int
    name: str
    path: str
    tipo: str
    invert_values: bool


class AccountCreate(BaseModel):
    name: str
    tipo: str
    invert_values: bool = False


class TransactionCreate(BaseModel):
    source_file: Optional[str] = None
    account_name: Optional[str] = None
    account_id: Optional[int] = None
    date: Optional[str] = None
    original_date: Optional[str] = None
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


def _exec(sql: str, params: tuple = ()): 
    con = sqlite3.connect(str(DB_PATH))
    cur = con.cursor()
    cur.execute(sql, params)
    con.commit()
    last = cur.lastrowid
    con.close()
    return last


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
    s = value.strip()
    # substitui espaços e caracteres inválidos por '-'
    s = re.sub(r"[^A-Za-z0-9]+", "-", s)
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
        # include a computed balance per account from transactions
        sql = """
        SELECT a.id, a.name, a.path, a.tipo, a.invert_values,
               COALESCE(SUM(t.amount), 0) AS balance
        FROM accounts a
        LEFT JOIN transactions t ON t.account_id = a.id
        GROUP BY a.id
        ORDER BY a.name
        """
        return _query(sql)
    except FileNotFoundError as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/categories", response_model=List[Category])
def get_categories():
    try:
        return _query("SELECT id, name, description, parent_id FROM categories ORDER BY parent_id, name")
    except FileNotFoundError as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/categories", response_model=Category)
def create_category(cat: CategoryCreate):
    if not DB_PATH.exists():
        raise HTTPException(status_code=500, detail=f"Banco não encontrado: {DB_PATH}")
    conn = sqlite3.connect(str(DB_PATH))
    try:
        cur = conn.cursor()
        cur.execute("INSERT OR IGNORE INTO categories (name, description, parent_id) VALUES (?, ?, ?)", (cat.name.strip(), cat.description, cat.parent_id))
        conn.commit()
        cur.execute("SELECT id, name, description, parent_id FROM categories WHERE name = ? AND (parent_id IS ? OR parent_id = ?)", (cat.name.strip(), cat.parent_id, cat.parent_id))
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=500, detail="Erro ao criar categoria")
        return {"id": row[0], "name": row[1], "description": row[2], "parent_id": row[3]}
    finally:
        conn.close()


@app.delete("/api/categories")
def delete_category(id: int = Query(...)):
    if not DB_PATH.exists():
        raise HTTPException(status_code=500, detail=f"Banco não encontrado: {DB_PATH}")
    conn = sqlite3.connect(str(DB_PATH))
    cur = conn.cursor()
    # check for children
    cur.execute("SELECT COUNT(*) FROM categories WHERE parent_id = ?", (id,))
    children = cur.fetchone()[0]
    if children > 0:
        conn.close()
        raise HTTPException(status_code=400, detail=f"Categoria tem {children} subcategorias. Remova-as ou reatribua antes.")
    # check for transactions
    cur.execute("SELECT COUNT(*) FROM transactions WHERE category_id = ?", (id,))
    txs = cur.fetchone()[0]
    if txs > 0:
        conn.close()
        raise HTTPException(status_code=400, detail=f"Categoria está em uso por {txs} transações. Reatribua antes de excluir.")
    cur.execute("DELETE FROM categories WHERE id = ?", (id,))
    conn.commit()
    conn.close()
    return {"deleted": id}


@app.get("/api/category-mappings", response_model=List[CategoryMapping])
def get_category_mappings():
    try:
        return _query("SELECT id, pattern, match_type, category_id, priority, active FROM category_mappings ORDER BY priority ASC, id ASC")
    except FileNotFoundError as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/category-mappings", response_model=CategoryMapping)
def create_category_mapping(mapping: CategoryMappingCreate):
    if not DB_PATH.exists():
        raise HTTPException(status_code=500, detail=f"Banco não encontrado: {DB_PATH}")
    conn = sqlite3.connect(str(DB_PATH))
    try:
        cur = conn.cursor()
        cur.execute("INSERT INTO category_mappings (pattern, match_type, category_id, priority, active) VALUES (?, ?, ?, ?, ?)", (mapping.pattern, mapping.match_type, mapping.category_id, mapping.priority, int(mapping.active)))
        conn.commit()
        mid = cur.lastrowid
        cur.execute("SELECT id, pattern, match_type, category_id, priority, active FROM category_mappings WHERE id = ?", (mid,))
        row = cur.fetchone()
        return {"id": row[0], "pattern": row[1], "match_type": row[2], "category_id": row[3], "priority": row[4], "active": bool(row[5])}
    finally:
        conn.close()


def _apply_mappings_sql(filters: dict, force: bool = False) -> int:
    """
    Apply mappings to transactions. Returns number of updated rows.
    filters: dict can contain date_from, date_to, account_id
    """
    if not DB_PATH.exists():
        raise HTTPException(status_code=500, detail=f"Banco não encontrado: {DB_PATH}")

    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()

    # load mappings ordered
    cur.execute("SELECT id, pattern, match_type, category_id, priority, active FROM category_mappings WHERE active=1 ORDER BY priority ASC, id ASC")
    mappings = cur.fetchall()

    # build base filter
    where = []
    params = []
    if filters.get("date_from"):
        where.append("date >= ?")
        params.append(filters.get("date_from"))
    if filters.get("date_to"):
        where.append("date <= ?")
        params.append(filters.get("date_to"))
    if filters.get("account_id"):
        where.append("account_id = ?")
        params.append(filters.get("account_id"))

    base_where = "WHERE " + " AND ".join(where) if where else ""

    updated = 0

    # For performance, fetch candidate rows once and apply mappings in Python
    sql = f"SELECT id, description, amount FROM transactions {base_where}"
    cur.execute(sql, tuple(params))
    candidates = cur.fetchall()

    for m in mappings:
        mid = m[0]
        pattern = m[1]
        match_type = m[2]
        cat_id = m[3]
        for row in candidates:
            tid = row[0]
            desc = row[1] or ""
            # skip if already has category and not force
            cur2 = conn.cursor()
            cur2.execute("SELECT category_id FROM transactions WHERE id = ?", (tid,))
            existing = cur2.fetchone()
            if existing and existing[0] and not force:
                continue

            matched = False
            if match_type == "substring":
                if pattern.lower() in desc.lower():
                    matched = True
            elif match_type == "starts_with":
                if desc.lower().startswith(pattern.lower()):
                    matched = True
            elif match_type == "regex":
                try:
                    if re.search(pattern, desc, flags=re.I):
                        matched = True
                except re.error:
                    matched = False

            if matched:
                cur.execute("UPDATE transactions SET category_id = ? WHERE id = ?", (cat_id, tid))
                updated += cur.rowcount

    conn.commit()
    conn.close()
    return updated


@app.post("/api/transactions/classify")
def classify_transactions(force: bool = False, date_from: Optional[str] = None, date_to: Optional[str] = None, account_id: Optional[int] = None):
    filters = {"date_from": date_from, "date_to": date_to, "account_id": account_id}
    try:
        updated = _apply_mappings_sql(filters, force=force)
        return {"updated": updated}
    except FileNotFoundError as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/migrate-categories")
def migrate_categories(create_backup: bool = True):
    if not DB_PATH.exists():
        raise HTTPException(status_code=500, detail=f"Banco não encontrado: {DB_PATH}")
    # backup
    if create_backup:
        ts = datetime.now().strftime("%Y%m%d%H%M%S")
        backup = DATA_DIR / f"finanzdb.db.bak.{ts}"
        shutil.copy2(DB_PATH, backup)

    conn = sqlite3.connect(str(DB_PATH))
    cur = conn.cursor()
    # find distinct non-empty category strings
    cur.execute("SELECT DISTINCT category FROM transactions WHERE category IS NOT NULL AND TRIM(category) <> ''")
    rows = cur.fetchall()
    created = 0
    for (catname,) in rows:
        name = catname.strip()
        cur.execute("INSERT OR IGNORE INTO categories (name, description) VALUES (?, ?)", (name, None))
        conn.commit()
        cur.execute("SELECT id FROM categories WHERE name = ?", (name,))
        cid = cur.fetchone()[0]
        cur.execute("UPDATE transactions SET category_id = ? WHERE TRIM(category) = ?", (cid, name))
        created += 1

    conn.commit()
    conn.close()
    return {"mapped_distinct": len(rows), "categories_created": created}


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
            "INSERT OR IGNORE INTO accounts (name, path, tipo, invert_values) VALUES (?, ?, ?, ?)",
            (name, account_path, tipo, int(account.invert_values)),
        )
        conn.commit()
        cur.execute("SELECT * FROM accounts WHERE name = ?", (name,))
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=500, detail="Erro ao criar conta")
        return {
            "id": row[0],
            "name": row[1],
            "path": row[2],
            "tipo": row[3],
            "invert_values": bool(row[4]),
        }
    finally:
        conn.close()


@app.delete("/api/accounts")
def delete_account(id: int = Query(..., ge=1)):
    if not DB_PATH.exists():
        raise HTTPException(status_code=500, detail=f"Banco não encontrado: {DB_PATH}")

    # obter conta antes de deletar para remover pasta correspondente
    account = _query("SELECT * FROM accounts WHERE id = ?", (id,))
    if not account:
        raise HTTPException(status_code=404, detail=f"Conta com id {id} não encontrada")

    account_path = account[0].get("path")

    conn = sqlite3.connect(str(DB_PATH))
    try:
        cur = conn.cursor()
        cur.execute("DELETE FROM accounts WHERE id = ?", (id,))
        conn.commit()
        if cur.rowcount == 0:
            raise HTTPException(status_code=404, detail=f"Conta com id {id} não encontrada")

        if account_path:
            folder = Path(account_path)
            if not folder.is_absolute():
                folder = BASE_DIR / "export" / folder
            if folder.exists() and folder.is_dir():
                # remova recursivamente a pasta para limpar arquivos de importação
                shutil.rmtree(folder)

        return {"status": "deleted", "id": id}
    finally:
        conn.close()


@app.post("/api/reload")
def reload_data():
    try:
        subprocess.run(["python3", str(BASE_DIR / "export_to_sqlite.py")], check=True)
        return {"status": "ok"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/import")
async def import_files(
    account_id: int = Form(...),
    billing_date: Optional[str] = Form(None),
    files: List[UploadFile] = File(...),
):
    if not DB_PATH.exists():
        raise HTTPException(status_code=500, detail=f"Banco não encontrado: {DB_PATH}")

    acc = _query("SELECT * FROM accounts WHERE id = ?", (account_id,))
    if not acc:
        raise HTTPException(status_code=404, detail="Conta não encontrada")

    account = acc[0]
    account_path = account["path"]
    account_tipo = str(account.get("tipo") or "").strip().lower()

    if account_tipo == "cartaocredito":
        if not billing_date:
            raise HTTPException(status_code=400, detail="Para contas CartaoCredito, informe billing_date")
        try:
            datetime.fromisoformat(billing_date)
        except ValueError:
            raise HTTPException(status_code=400, detail="billing_date deve estar no formato yyyy-mm-dd")

    target_folder = Path(account_path)
    if not target_folder.is_absolute():
        target_folder = BASE_DIR / "export" / target_folder

    target_folder.mkdir(parents=True, exist_ok=True)

    saved_files = []
    for file in files:
        out_path = target_folder / Path(file.filename).name
        try:
            with out_path.open("wb") as f:
                shutil.copyfileobj(file.file, f)
            saved_files.append(str(out_path))

            if account_tipo == "cartaocredito":
                meta = {
                    "due_date": billing_date,
                }
                meta_path = out_path.with_name(out_path.name + ".meta.json")
                with meta_path.open("w", encoding="utf-8") as mf:
                    json.dump(meta, mf, ensure_ascii=False)
        finally:
            file.file.close()

    try:
        subprocess.run(["python3", str(BASE_DIR / "export_to_sqlite.py")], check=True)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao processar arquivo: {e}")

    return {"status": "ok", "saved_files": saved_files, "imported_account_id": account_id}


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
        t.original_date,
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
            INSERT INTO transactions (source_file, account_id, date, original_date, description, amount, category, details)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                tx.source_file,
                tx.account_id,
                tx.date,
                tx.original_date or tx.date,
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
    except sqlite3.IntegrityError as e:
        raise HTTPException(status_code=400, detail=f"Transação duplicada: {e}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        db.close()


@app.patch("/api/transactions", response_model=Transaction)
def update_transaction(id: int = Query(..., ge=1), payload: dict = Body(...)):
    if not DB_PATH.exists():
        raise HTTPException(status_code=500, detail=f"Banco não encontrado: {DB_PATH}")

    allowed = {"date", "original_date", "description", "amount", "category", "category_id", "details", "account_id"}
    updates = {k: v for k, v in payload.items() if k in allowed}
    if not updates:
        raise HTTPException(status_code=400, detail="Nenhum campo válido para atualizar")

    conn = sqlite3.connect(str(DB_PATH))
    try:
        cur = conn.cursor()
        set_clause = ", ".join([f"{k} = ?" for k in updates.keys()])
        params = list(updates.values()) + [id]
        cur.execute(f"UPDATE transactions SET {set_clause} WHERE id = ?", tuple(params))
        conn.commit()
        if cur.rowcount == 0:
            raise HTTPException(status_code=404, detail=f"Transação com id {id} não encontrada")
        row = _query("SELECT * FROM transactions WHERE id = ?", (id,))[0]
        return row
    finally:
        conn.close()


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
