import os
import sys
import json
import subprocess
from io import BytesIO


def pdf_data(path,action,page_number=1):
    try:
        import pymupdf as fitz
    except ImportError:
        import fitz
    with fitz.open(path) as doc:
        if not doc.is_pdf:raise ValueError('Le document ne peut pas être lu comme PDF.')
        if doc.needs_pass:raise ValueError('PDF protégé par mot de passe : aperçu indisponible.')
        if action=='info':return json.dumps({'pages':doc.page_count}).encode('utf-8')
        if not 1<=page_number<=doc.page_count:raise ValueError('Page PDF inexistante.')
        page=doc.load_page(page_number-1)
        width,height=page.rect.width,page.rect.height
        if width<=0 or height<=0:raise ValueError('Dimensions de page invalides.')
        scale=min(2.0,1600/width,2200/height)
        return page.get_pixmap(matrix=fitz.Matrix(scale,scale),colorspace=fitz.csRGB,alpha=False).tobytes('png')


def run_pdf(path,action,page_number=1):
    # Separate process: avoids concurrent use of the PDF engine in Flask threads.
    cmd=[sys.executable,os.path.abspath(__file__),'--render',action,path,str(page_number)]
    try:result=subprocess.run(cmd,stdout=subprocess.PIPE,stderr=subprocess.PIPE,timeout=60)
    except subprocess.TimeoutExpired:raise ValueError('Aperçu trop long à générer. Utilisez le bouton Télécharger.')
    if result.returncode!=0:
        message=result.stderr.decode('utf-8',errors='replace').strip() or 'Impossible de lire le PDF.'
        raise ValueError(message[:500])
    return result.stdout


def register_document_pdf_routes(app,db,login_required,upload_dir):
    from flask import jsonify,send_file
    directory=os.environ.get('CVA_DOCUMENTS',os.path.join(upload_dir,'patient_documents'))
    def locate(pid,did):
        row=db().execute('SELECT * FROM patient_documents WHERE id=? AND patient_id=?',(did,pid)).fetchone()
        if not row:return None,None
        name=row['storage_name']
        if os.path.basename(name)!=name:return None,None
        path=os.path.join(directory,name)
        return (row,path) if os.path.isfile(path) else (None,None)
    def private(response):
        response.headers['Cache-Control']='no-store'
        response.headers['X-Content-Type-Options']='nosniff'
        return response

    @app.get('/api/patients/<int:pid>/documents/<int:did>/pdf-info')
    @login_required
    def api_patient_pdf_info(pid,did):
        row,path=locate(pid,did)
        if not row or row['extension']!='.pdf':return jsonify(error='PDF introuvable pour ce patient.'),404
        try:data=json.loads(run_pdf(path,'info'))
        except (ValueError,json.JSONDecodeError) as exc:return jsonify(error=str(exc)),422
        return private(jsonify(**data))

    @app.get('/api/patients/<int:pid>/documents/<int:did>/pdf-page/<int:page>')
    @login_required
    def api_patient_pdf_page(pid,did,page):
        row,path=locate(pid,did)
        if not row or row['extension']!='.pdf':return jsonify(error='PDF introuvable pour ce patient.'),404
        try:data=run_pdf(path,'page',page)
        except ValueError as exc:return jsonify(error=str(exc)),422
        return private(send_file(BytesIO(data),mimetype='image/png',as_attachment=False,download_name='page.png'))

    @app.get('/api/patients/<int:pid>/documents/<int:did>/download')
    @login_required
    def api_download_patient_document(pid,did):
        row,path=locate(pid,did)
        if not row:return jsonify(error='Document introuvable pour ce patient.'),404
        return private(send_file(path,as_attachment=True,download_name=row['original_name'],conditional=True))


if __name__=='__main__':
    if len(sys.argv)!=5 or sys.argv[1]!='--render':raise SystemExit('Module de la plateforme : ne pas lancer manuellement.')
    try:
        data=pdf_data(sys.argv[3],sys.argv[2],int(sys.argv[4]));sys.stdout.buffer.write(data)
    except Exception as exc:
        message=str(exc) if isinstance(exc,ValueError) else 'PDF invalide ou moteur PDF absent. Installer PyMuPDF.'
        sys.stderr.write(message);raise SystemExit(1)
