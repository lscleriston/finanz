#!/usr/bin/env python3
"""Teste de inspeção de PDFs em export/Bradesco para entender layout de lançamentos."""

from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
PDF_DIR = BASE_DIR / "export" / "Bradesco"


def inspect_pdf_file(path: Path) -> None:
    print(f"\n>>> Inspecting: {path}\n")

    # Text extraction por pdfplumber (preferido) e PyPDF2 fallback
    try:
        import pdfplumber
    except ModuleNotFoundError:
        pdfplumber = None

    try:
        from PyPDF2 import PdfReader
    except ModuleNotFoundError:
        PdfReader = None

    if pdfplumber is None and PdfReader is None:
        raise RuntimeError("Nenhuma biblioteca de PDF instalada. Instale pdfplumber ou PyPDF2.")

    if pdfplumber is not None:
        with pdfplumber.open(path) as pdf:
            print("-- pdfplumber text (partial) --")
            for i, page in enumerate(pdf.pages, 1):
                text = page.extract_text() or ""
                print(f"--- Página {i} (len {len(text)}) ---")
                print('\n'.join(text.splitlines()[:20]))
                print("\n-- tabela(s) --")
                tables = page.extract_tables()
                if not tables:
                    print("(sem tabelas)")
                else:
                    print(f"{len(tables)} tabela(s)")
                    for ti, table in enumerate(tables, 1):
                        print(f"Tabela {ti} → {len(table)} linhas")
                        for row in table[:5]:
                            print(row)
                # inspect only first 3 páginas para não poluir
                if i >= 3:
                    break
        return

    # fallback PyPDF2
    if PdfReader is not None:
        print("-- PyPDF2 text (partial) --")
        reader = PdfReader(path)
        for i, p in enumerate(reader.pages, 1):
            text = p.extract_text() or ""
            print(f"--- Página {i} (len {len(text)}) ---")
            print('\n'.join(text.splitlines()[:20]))
            if i >= 3:
                break


if __name__ == "__main__":
    pdf_files = sorted(PDF_DIR.glob("*.pdf"))
    if not pdf_files:
        print("Nenhum PDF encontrado em", PDF_DIR)
        raise SystemExit(1)

    for pdf in pdf_files:
        try:
            inspect_pdf_file(pdf)
        except Exception as e:
            print(f"Erro ao inspecionar {pdf}: {e}")
