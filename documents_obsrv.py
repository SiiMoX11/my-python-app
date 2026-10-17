import os
import secrets
import sqlite3
import zipfile
from io import BytesIO
from html import escape
from flask import request, jsonify, send_file, g
from PIL import Image
from docx import Document
from docx.text.paragraph import Paragraph
from docx.table import Table

MAX_SIZE=25*1024*1024
MIMES={'.pdf':'application/pdf','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.gif':'image/gif','.webp':'image/webp','.docx':'application/vnd.openxmlformats-officedocument.wordprocessingml.document'}

def validate_upload(data,extension):
    if extension=='.pdf':
        if not data.startswith(b'%PDF-'):raise ValueError('Le fichier ne ressemble pas à un PDF valide.')
    elif extension=='.docx':
        try:
            with zipfile.ZipFile(BytesIO(data)) as z:
                infos=z.infolist()
                if len(infos)>4000 or sum(i.file_size for i in infos)>100*1024*1024:
                    raise ValueError('Document Word trop volumineux après décompression.')
                if any(i.flag_bits&1 for i in infos):raise ValueError('Documents chiffrés non pris en charge.')
                if 'word/document.xml' not in z.namelist() or '[Content_Types].xml' not in z.namelist():
                    raise ValueError('Ce fichier n’est pas un document DOCX valide.')
                if any('vbaproject' in i.filename.lower() for i in infos):
                    raise ValueError('Les documents contenant des macros ne sont pas acceptés.')
            Document(BytesIO(data))
        except (zipfile.BadZipFile,KeyError) as exc:
            raise ValueError('Document Word invalide.') from exc
    else:
        try:
            with Image.open(BytesIO(data)) as image:
                expected={'.png':'PNG','.jpg':'JPEG','.jpeg':'JPEG','.gif':'GIF','.webp':'WEBP'}[extension]
                if image.format!=expected:raise ValueError('Le format réel de l’image ne correspond pas à son extension.')
                if image.width*image.height>40000000:raise ValueError('Image trop grande (40 mégapixels maximum).')
                image.verify()
        except (OSError,Image.DecompressionBombError) as exc:
            raise ValueError('Image invalide ou trop grande.') from exc

def docx_preview(path):
    document=Document(path);parts=[];chars=0;limited=False
    for child in document.element.body:
        if child.tag.endswith('}p'):
            text=Paragraph(child,document).text
            chars+=len(text)
            parts.append('<p>'+escape(text).replace('\n','<br>')+'</p>')
        elif child.tag.endswith('}tbl'):
            table=Table(child,document)
            if len(table.rows)>1000:limited=True;break
            rows=[]
            for row in table.rows:
                if len(row.cells)>100:limited=True;break
                cells=[]
                for cell in row.cells:
                    text=cell.text;chars+=len(text)
                    cells.append('<td>'+escape(text).replace('\n','<br>')+'</td>')
                rows.append('<tr>'+''.join(cells)+'</tr>')
            parts.append('<table>'+''.join(rows)+'</table>')
        if chars>1000000:limited=True;break
    note='Aperçu local du texte et des tableaux. Les images intégrées et la mise en page exacte de Word ne sont pas reproduites ; utiliser un PDF pour un aperçu fidèle.'
    if limited:note+=' Document volumineux : aperçu partiel.'
    return '<!doctype html><html lang="fr"><head><meta charset="utf-8"><style>body{font:15px Arial,sans-serif;margin:24px;color:#1e293b}p{white-space:pre-wrap;line-height:1.5}table{border-collapse:collapse;width:100%;margin:14px 0}td{border:1px solid #cbd5e1;padding:8px;vertical-align:top;overflow-wrap:anywhere}.note{padding:12px;background:#f1f5f9;font-size:12px}</style></head><body><div class="note">'+escape(note)+'</div>'+''.join(parts)+'</body></html>'

def register_documents(app,db,login_required,now,log,db_path,upload_dir):
    directory=os.environ.get('CVA_DOCUMENTS',os.path.join(upload_dir,'patient_documents'))
    os.makedirs(directory,exist_ok=True)
    conn=sqlite3.connect(db_path)
    try:
        conn.executescript('''
        CREATE TABLE IF NOT EXISTS patient_documents (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
          title TEXT NOT NULL,
          original_name TEXT NOT NULL,
          storage_name TEXT NOT NULL UNIQUE,
          extension TEXT NOT NULL,
          size_bytes INTEGER NOT NULL,
          document_date TEXT NOT NULL,
          uploaded_at TEXT NOT NULL,
          author TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_patient_documents ON patient_documents(patient_id);
        ''')
        conn.commit()
    finally:conn.close()

    def patient_exists(pid):return db().execute('SELECT 1 FROM patients WHERE id=?',(pid,)).fetchone() is not None

    @app.get('/api/patients/<int:pid>/documents')
    @login_required
    def api_patient_documents(pid):
        if not patient_exists(pid):return jsonify(error='Patient introuvable.'),404
        rows=db().execute('SELECT id,title,original_name,extension,size_bytes,document_date,uploaded_at FROM patient_documents WHERE patient_id=? ORDER BY document_date DESC,id DESC',(pid,)).fetchall()
        return jsonify(documents=[dict(r) for r in rows],max_size=MAX_SIZE)

    @app.post('/api/patients/<int:pid>/documents')
    @login_required
    def api_upload_patient_document(pid):
        if not patient_exists(pid):return jsonify(error='Patient introuvable.'),404
        file=request.files.get('file')
        if not file or not file.filename:return jsonify(error='Choisissez un document.'),400
        original=os.path.basename(file.filename.replace('\\','/'))[:240]
        extension=os.path.splitext(original)[1].lower()
        if extension not in MIMES:return jsonify(error='Formats : PDF, JPG, PNG, GIF, WebP, Word DOCX. Convertir les anciens .doc en .docx ou PDF.'),400
        data=file.stream.read(MAX_SIZE+1)
        if not data or len(data)>MAX_SIZE:return jsonify(error='Document vide ou supérieur à 25 Mo.'),400
        try:validate_upload(data,extension)
        except Exception as exc:
            if isinstance(exc,ValueError):return jsonify(error=str(exc)),400
            return jsonify(error='Fichier invalide ou non lisible.'),400
        title=(request.form.get('title') or original).strip()[:240] or original
        date=(request.form.get('date') or now()[:10]).strip()
        try:
            import datetime
            datetime.date.fromisoformat(date)
        except ValueError:return jsonify(error='Date invalide.'),400
        storage=secrets.token_hex(24)+extension
        path=os.path.join(directory,storage)
        try:
            with open(path,'xb') as target:target.write(data)
            cur=db().execute('INSERT INTO patient_documents(patient_id,title,original_name,storage_name,extension,size_bytes,document_date,uploaded_at,author) VALUES(?,?,?,?,?,?,?,?,?)',(pid,title,original,storage,extension,len(data),date,now(),g.user['full_name']))
            log(pid,'Document ajouté',title+' — '+original)
            db().commit()
        except Exception:
            db().rollback()
            if os.path.exists(path):os.remove(path)
            raise
        return jsonify(id=cur.lastrowid),201

    @app.get('/api/patients/<int:pid>/documents/<int:did>/preview')
    @login_required
    def api_preview_patient_document(pid,did):
        row=db().execute('SELECT * FROM patient_documents WHERE id=? AND patient_id=?',(did,pid)).fetchone()
        if not row:return jsonify(error='Document introuvable pour ce patient.'),404
        path=os.path.join(directory,row['storage_name'])
        if not os.path.isfile(path):return jsonify(error='Fichier absent du stockage.'),404
        if row['extension']=='.docx':
            try:html=docx_preview(path)
            except Exception:return jsonify(error='Impossible de lire ce document Word.'),422
            response=app.response_class(html,mimetype='text/html')
            response.headers['Content-Security-Policy']="default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'self'"
        else:
            response=send_file(path,mimetype=MIMES[row['extension']],as_attachment=False,download_name=row['original_name'],conditional=True)
        response.headers['Cache-Control']='no-store'
        response.headers['X-Content-Type-Options']='nosniff'
        return response
