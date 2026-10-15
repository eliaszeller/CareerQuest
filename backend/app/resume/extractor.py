from __future__ import annotations

import re
import tempfile
import zipfile
from pathlib import Path

import fitz
from docx import Document
from fastapi import UploadFile
from pypdf import PdfReader

ALLOWED_EXTENSIONS = {".pdf", ".docx", ".txt"}
MAX_TEXT_CHARACTERS = 100_000
MAX_DOCX_ENTRIES = 500
MAX_DOCX_EXPANDED_BYTES = 20 * 1024 * 1024


class ResumeError(ValueError):
    """A safe, user-displayable résumé processing error."""


def _detect_type(data: bytes, extension: str) -> str:
    if data.startswith(b"%PDF-"):
        detected = ".pdf"
    elif data.startswith(b"PK\x03\x04"):
        detected = ".docx"
    else:
        try:
            data.decode("utf-8")
            detected = ".txt"
        except UnicodeDecodeError as exc:
            raise ResumeError(
                "The file content is not a supported PDF, DOCX, or UTF-8 text file."
            ) from exc
    if detected != extension:
        raise ResumeError("The file content does not match its filename extension.")
    return detected


def _extract_pdf(path: Path) -> str:
    try:
        reader = PdfReader(path)
        if reader.is_encrypted:
            raise ResumeError(
                "Encrypted PDFs are not supported. Save an unencrypted copy "
                "or enter details manually."
            )
        document = fitz.open(path)
        if document.needs_pass:
            raise ResumeError(
                "Encrypted PDFs are not supported. Save an unencrypted copy "
                "or enter details manually."
            )
        text = "\n".join(page.get_text("text") for page in document)
        document.close()
        return text
    except ResumeError:
        raise
    except Exception as exc:
        raise ResumeError(
            "This PDF could not be read. Try exporting it again or enter details manually."
        ) from exc


def _validate_docx_archive(path: Path) -> None:
    try:
        with zipfile.ZipFile(path) as archive:
            entries = archive.infolist()
            if len(entries) > MAX_DOCX_ENTRIES:
                raise ResumeError("This DOCX contains too many embedded items.")
            expanded = sum(entry.file_size for entry in entries)
            if expanded > MAX_DOCX_EXPANDED_BYTES:
                raise ResumeError("This DOCX expands beyond the safe processing limit.")
            names = {entry.filename for entry in entries}
            if "word/document.xml" not in names:
                raise ResumeError("This file is not a readable DOCX document.")
            if any(name.endswith("vbaProject.bin") for name in names):
                raise ResumeError("Macro-enabled documents are not supported.")
    except ResumeError:
        raise
    except zipfile.BadZipFile as exc:
        raise ResumeError("This DOCX is corrupted or unreadable.") from exc


def _extract_docx(path: Path) -> str:
    _validate_docx_archive(path)
    try:
        document = Document(path)
        paragraphs = [paragraph.text for paragraph in document.paragraphs]
        cells = [cell.text for table in document.tables for row in table.rows for cell in row.cells]
        return "\n".join(paragraphs + cells)
    except Exception as exc:
        raise ResumeError(
            "This DOCX could not be read. Try exporting it again or enter details manually."
        ) from exc


def extract_text(path: Path, file_type: str) -> str:
    if file_type == ".pdf":
        text = _extract_pdf(path)
    elif file_type == ".docx":
        text = _extract_docx(path)
    else:
        text = path.read_text(encoding="utf-8")
    normalized = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f]", "", text)
    normalized = normalized.replace("\uf0b7", "•").strip()
    if not normalized:
        raise ResumeError("No readable text was found. Try another file or enter details manually.")
    return normalized[:MAX_TEXT_CHARACTERS]


async def process_upload(upload: UploadFile, max_bytes: int) -> tuple[str, str]:
    filename = Path(upload.filename or "").name
    extension = Path(filename).suffix.lower()
    if extension not in ALLOWED_EXTENSIONS:
        raise ResumeError("Upload a PDF, DOCX, or TXT résumé.")

    data = await upload.read(max_bytes + 1)
    if len(data) > max_bytes:
        raise ResumeError(f"The file is larger than the {max_bytes // (1024 * 1024)} MB limit.")
    if not data:
        raise ResumeError("The uploaded file is empty.")
    file_type = _detect_type(data, extension)

    with tempfile.TemporaryDirectory(prefix="careerquest-resume-") as temp_dir:
        path = Path(temp_dir) / f"resume{file_type}"
        path.write_bytes(data)
        text = extract_text(path, file_type)
    return filename, text
