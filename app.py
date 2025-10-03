from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import List, TypedDict

from flask import Flask, abort, jsonify, render_template, send_from_directory

BASE_DIR = Path(__file__).resolve().parent
DATA_FILE = BASE_DIR / "data" / "lithology_entries.json"
PDF_DIRECTORY = BASE_DIR


class LithologyEntry(TypedDict):
    tab_name: str
    title: str
    description: str
    pdf_filename: str


@lru_cache(maxsize=1)
def load_entries() -> List[LithologyEntry]:
    with DATA_FILE.open("r", encoding="utf-8") as fp:
        data = json.load(fp)
    return data


app = Flask(__name__)


@app.route("/")
def index() -> str:
    """Render the main application view."""
    return render_template("index.html")


@app.route("/api/lithology")
def lithology_api():
    """Return all lithology entries as JSON."""
    entries = load_entries()
    return jsonify(entries)


@app.route("/pdfs/<path:filename>")
def serve_pdf(filename: str):
    """Serve PDF files that are listed in the lithology data set."""
    # Ensure we do not allow directory traversal.
    clean_name = Path(filename).name
    if clean_name != filename:
        abort(404)

    entry_filenames = {entry["pdf_filename"] for entry in load_entries()}
    if clean_name not in entry_filenames:
        abort(404)

    file_path = PDF_DIRECTORY / clean_name
    if not file_path.exists() or file_path.suffix.lower() != ".pdf":
        abort(404)

    return send_from_directory(PDF_DIRECTORY, clean_name)


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
