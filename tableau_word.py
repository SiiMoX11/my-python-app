from io import BytesIO
from docx import Document
from docx.shared import Cm, Pt
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_COLOR_INDEX
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_CELL_VERTICAL_ALIGNMENT
from docx.oxml import OxmlElement
from docx.oxml.ns import qn

ROOM_ORDER = [str(n) for n in range(210, 219)] + [str(n) for n in range(201, 210)]

def bed_key(p):
    return (ROOM_ORDER.index(str(p["room"])), 0 if p["position"] == "P" else 1, p["id"])

def date_fr(value):
    value = str(value or "")
    parts = value[:10].split("-")
    return "/".join(reversed(parts)) if len(parts) == 3 else value

def paragraph(cell, text, bold=False, center=False, underline=False, highlight=None):
    p = cell.add_paragraph()
    p.paragraph_format.space_after = Pt(4)
    p.paragraph_format.keep_together = False
    if center:
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = p.add_run(str(text or ""))
    r.bold = bold
    r.underline = underline
    if highlight:
        r.font.highlight_color = highlight
    return p

def entry(cell, e, label):
    heading = " ".join(x for x in (label, e.get("category") or "", e.get("title") or "", date_fr(e.get("date"))) if x)
    paragraph(cell, heading + " :", bold=True, underline=True)
    if e.get("content"):
        paragraph(cell, e["content"])
    if e.get("details"):
        paragraph(cell, e["details"])

def build_document(patients, entries, stamp):
    doc = Document()
    section = doc.sections[0]
    section.page_width = Cm(21)
    section.page_height = Cm(29.7)
    section.top_margin = section.bottom_margin = Cm(1)
    section.left_margin = section.right_margin = Cm(1)
    normal = doc.styles["Normal"]
    normal.font.name = "Times New Roman"
    normal.font.size = Pt(10)
    normal.paragraph_format.space_after = Pt(3)
    normal.paragraph_format.line_spacing = 1
    p = doc.add_paragraph()
    p.add_run(date_fr(stamp[:10]) + " à " + stamp[11:16] + " — heure plateforme").bold = True
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = p.add_run("SERVICE CHIRURGIE VISCÉRALE A")
    r.bold = True
    r.font.size = Pt(13)
    table = doc.add_table(rows=0, cols=5)
    table.style = "Table Grid"
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    table.autofit = False
    widths = [1.45, 3.7, 3.2, 6.1, 4.55]
    for col, width in zip(table.columns, widths):
        col.width = Cm(width)
    for patient in sorted(patients, key=bed_key):
        cells = table.add_row().cells
        for cell, width in zip(cells, widths):
            cell.width = Cm(width)
            cell.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.TOP
            cell._element.remove(cell.paragraphs[0]._p)
        paragraph(cells[0], str(patient["room"]) + " " + patient["position"], True, True)
        paragraph(cells[1], patient["nom"] + " " + (patient.get("prenom") or ""), True, True)
        if patient.get("age") is not None:
            paragraph(cells[1], str(patient["age"]) + " ans", True, True)
        paragraph(cells[1], "IP : " + str(patient.get("ip") or "—"), True, True)
        paragraph(cells[1], patient.get("mutuelle") or "—", True, True)
        if patient.get("groupe"):
            paragraph(cells[1], patient["groupe"], True, True, highlight=WD_COLOR_INDEX.TURQUOISE)
        paragraph(cells[2], patient.get("motif") or "Motif non renseigné", True, True)
        if patient.get("date_entree"):
            paragraph(cells[2], "Entrée : " + date_fr(patient["date_entree"]), center=True)
        E = entries.get(patient["id"], {})
        paragraph(cells[2], "ATCDs :", True, True)
        for e in E.get("atcd", []):
            entry(cells[2], e, "")
        if not E.get("atcd"):
            paragraph(cells[2], "Non renseignés", center=True)
        for e in E.get("clinique", []):
            entry(cells[2], e, "Clinique")
        for e in E.get("bilan", []):
            entry(cells[3], e, "BB")
        for e in E.get("examen", []):
            entry(cells[3], e, "")
        for e in E.get("consigne", []):
            paragraph(cells[4], ("✓ " if e.get("done") else "À faire : ") + (e.get("content") or e.get("title") or ""), True,
                      highlight=WD_COLOR_INDEX.GRAY_25 if e.get("done") else WD_COLOR_INDEX.YELLOW)
        for e in E.get("avis", []):
            entry(cells[4], e, "Avis")
        for cell in cells:
            if not cell.paragraphs:
                cell.add_paragraph("—")
    if not patients:
        doc.add_paragraph("Aucun patient hospitalisé dans les chambres du service.")
    footer = section.footer.paragraphs[0]
    footer.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    footer.add_run("Document confidentiel — Page ")
    field = OxmlElement("w:fldSimple")
    field.set(qn("w:instr"), "PAGE")
    footer._p.append(field)
    buffer = BytesIO()
    doc.save(buffer)
    buffer.seek(0)
    return buffer

def register_tableau(app, db, login_required, now):
    from flask import send_file, jsonify
    @app.get("/api/tableau/word")
    @login_required
    def api_tableau_word():
        conn = db()
        conn.execute("BEGIN")
        try:
            patients = [dict(r) for r in conn.execute("SELECT * FROM patients WHERE status='hospitalise' AND room IS NOT NULL AND position IN ('P','F') AND (hors_service IS NULL OR hors_service='')").fetchall() if str(r["room"]) in ROOM_ORDER]
            entries = {}
            if patients:
                ids = [p["id"] for p in patients]
                marks = ",".join("?" for _ in ids)
                rows = conn.execute(f"SELECT * FROM entries WHERE patient_id IN ({marks}) AND kind IN ('atcd','clinique','bilan','examen','avis','consigne') ORDER BY date DESC,id DESC", ids).fetchall()
                for r in rows:
                    e = dict(r)
                    entries.setdefault(e["patient_id"], {}).setdefault(e["kind"], []).append(e)
            stamp = now()
        finally:
            conn.rollback()
        buffer = build_document(patients, entries, stamp)
        response = send_file(buffer, as_attachment=True, download_name="Tableau_service_" + stamp[:10] + ".docx", mimetype="application/vnd.openxmlformats-officedocument.wordprocessingml.document")
        response.headers["Cache-Control"] = "no-store"
        return response
