from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Dict, List, TypedDict
from zipfile import ZipFile

import xml.etree.ElementTree as ET

from flask import Flask, abort, jsonify, render_template, send_from_directory

BASE_DIR = Path(__file__).resolve().parent
DATA_FILE = BASE_DIR / "data" / "lithology_entries.json"
PDF_DIRECTORY = BASE_DIR
EXCEL_FILE = BASE_DIR / "Geological Profiles.xlsx"

XML_NAMESPACES = {
    "main": "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
    "rel": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
}


class LithologySection(TypedDict):
    from_depth: str
    to_depth: str
    description: str


class LithologyEntryBase(TypedDict):
    tab_name: str
    title: str
    description: str
    pdf_filename: str


class LithologyEntry(LithologyEntryBase, total=False):
    sections: List[LithologySection]


def _read_shared_strings(zf: ZipFile) -> List[str]:
    try:
        raw = zf.read("xl/sharedStrings.xml")
    except KeyError:
        return []

    root = ET.fromstring(raw)
    strings: List[str] = []
    for item in root.findall("main:si", XML_NAMESPACES):
        text = "".join(
            node.text or "" for node in item.findall(".//main:t", XML_NAMESPACES)
        )
        strings.append(text)
    return strings


def _cell_value(cell: ET.Element, shared_strings: List[str]) -> str:
    value_element = cell.find("main:v", XML_NAMESPACES)
    if value_element is None or value_element.text is None:
        return ""

    cell_type = cell.attrib.get("t")
    if cell_type == "s":
        try:
            index = int(value_element.text)
        except ValueError:
            return ""
        if 0 <= index < len(shared_strings):
            return shared_strings[index]
        return ""

    return value_element.text


def _column_from_reference(reference: str) -> str:
    return "".join(char for char in reference if char.isalpha())


def _format_numeric(value: str) -> str:
    text = value.strip()
    if not text:
        return ""

    try:
        number = float(text)
    except ValueError:
        return text

    if number.is_integer():
        return f"{int(number)}"

    formatted = f"{number:.2f}".rstrip("0").rstrip(".")
    return formatted or text


def _parse_sheet_sections(
    sheet_data: ET.Element, shared_strings: List[str]
) -> List[LithologySection]:
    sections: List[LithologySection] = []
    rows = sheet_data.findall("main:row", XML_NAMESPACES)
    for index, row in enumerate(rows):
        cells: Dict[str, str] = {}
        for cell in row.findall("main:c", XML_NAMESPACES):
            reference = cell.attrib.get("r", "")
            column = _column_from_reference(reference)
            if not column:
                continue
            cells[column] = _cell_value(cell, shared_strings)

        if index == 0:
            # Skip header row.
            continue

        start = cells.get("A", "")
        end = cells.get("B", "")
        description = cells.get("C", "").strip()

        if not description:
            continue

        sections.append(
            LithologySection(
                from_depth=_format_numeric(start),
                to_depth=_format_numeric(end),
                description=description,
            )
        )

    return sections


@lru_cache(maxsize=1)
def load_section_tables() -> Dict[str, List[LithologySection]]:
    if not EXCEL_FILE.exists():
        return {}

    tables: Dict[str, List[LithologySection]] = {}

    with ZipFile(EXCEL_FILE) as workbook:
        shared_strings = _read_shared_strings(workbook)
        workbook_xml = ET.fromstring(workbook.read("xl/workbook.xml"))
        rels_xml = ET.fromstring(workbook.read("xl/_rels/workbook.xml.rels"))

        relationship_targets = {
            rel.attrib["Id"]: rel.attrib["Target"] for rel in rels_xml
        }

        sheets = workbook_xml.findall("main:sheets/main:sheet", XML_NAMESPACES)
        for sheet in sheets:
            sheet_name = sheet.attrib.get("name", "").strip()
            relationship_id = sheet.attrib.get(
                "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id"
            )
            if not sheet_name or not relationship_id:
                continue

            sheet_target = relationship_targets.get(relationship_id)
            if not sheet_target:
                continue

            sheet_path = f"xl/{sheet_target}"
            try:
                sheet_xml = ET.fromstring(workbook.read(sheet_path))
            except KeyError:
                continue

            sheet_data = sheet_xml.find("main:sheetData", XML_NAMESPACES)
            if sheet_data is None:
                continue

            sections = _parse_sheet_sections(sheet_data, shared_strings)
            if not sections:
                continue

            key_candidates = {sheet_name}
            if not sheet_name.lower().endswith(".pdf"):
                key_candidates.add(f"{sheet_name}.pdf")

            for key in key_candidates:
                tables[key] = sections

    return tables


@lru_cache(maxsize=1)
def load_entries() -> List[LithologyEntry]:
    with DATA_FILE.open("r", encoding="utf-8") as fp:
        data: List[LithologyEntry] = json.load(fp)

    section_tables = load_section_tables()
    for entry in data:
        pdf_key = entry.get("pdf_filename", "")
        sections = section_tables.get(pdf_key)
        if sections is None:
            # Fall back to the tab name if the PDF name is not present.
            sections = section_tables.get(entry.get("tab_name", ""), [])
        entry["sections"] = [
            LithologySection(
                from_depth=section["from_depth"],
                to_depth=section["to_depth"],
                description=section["description"],
            )
            for section in sections
        ]

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
