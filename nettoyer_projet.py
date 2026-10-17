# -*- coding: utf-8 -*-
"""
Nettoyage du projet CVA (Chirurgie Viscérale A).

A placer a cote de app.py puis lancer :   python nettoyer_projet.py
Option :  python nettoyer_projet.py --simulation   (n'effectue aucune modification)

Rien n'est supprime : les fichiers inutiles sont DEPLACES dans un dossier
d'archive a cote du projet (../CVA_archive_AAAAMMJJ_HHMMSS). Vous pourrez
supprimer cette archive vous-meme apres avoir verifie que tout fonctionne.
"""
from pathlib import Path
import datetime
import shutil
import sys

SIMULATION = '--simulation' in sys.argv
root = Path(__file__).resolve().parent
if not (root / 'app.py').exists() or not (root / 'static' / 'app.js').exists():
    raise SystemExit('Placez ce script a cote de app.py (le dossier static/ doit exister).')

# 1) Verification : toutes les adaptations doivent deja etre dans le code
CONTROLES = [
    ('static/app.js', 'MENU TABLEAU VISITE ET STAFFER V1', 'Menu Tableau de Visite + Patients a staffer'),
    ('static/app.js', 'ONGLETS ET LOGS ADMIN V1', 'Onglets renommes + LOGS reserves admin'),
    ('static/app.js', 'SORTIE DATES ET CRH V1', 'Sortie : date d entree + CRH prerempli'),
    ('static/app.js', 'AUTRES ET CENTRAGE ONGLETS V1', 'Onglet AUTRES'),
    ('static/app.js', 'BEGIN SORTIE WORD INTEGRATED V2', 'CRH / ordonnance Word integres dans app.js'),
    ('static/app.js', 'TTT PRESENTATION V3', 'TTT V3 (apercu + tri)'),
    ('static/app.js', 'OBSRV DOCUMENTS V1', 'Documents OBSRV'),
    ('static/app.js', 'VIDEOS IMAGERIES V1', 'Videos imageries V1'),
    ('static/app.js', 'MINIATURES IMAGERIES V2', 'Videos imageries V2 (miniatures)'),
    ('static/app.js', 'TELECHARGEMENT IMAGERIE V3', 'Imageries V3 (telechargement)'),
    ('static/app.css', 'DATE IMAGERIE PLUS VISIBLE V3', 'Date imagerie plus visible'),
    ('static/app.css', 'CORRECTION ONGLETS MEME LIGNE ET GRANDE TAILLE V2', 'Onglets meme ligne'),
    ('traitements_ttt.py', '# STYLE FICHE TTT V2', 'Style fiche TTT'),
    ('app.py', 'register_document_pdf_routes', 'Documents V2 (apercu PDF)'),
    ('app.py', 'register_sortie_documents', 'Sortie Word (backend)'),
]
print('=== Verification des adaptations ===')
manquantes = []
for fichier, marqueur, libelle in CONTROLES:
    p = root / fichier
    ok = p.exists() and marqueur in p.read_text(encoding='utf-8', errors='ignore')
    print(('  OK      ' if ok else '  ABSENT  ') + libelle)
    if not ok:
        manquantes.append(libelle)
if manquantes:
    raise SystemExit('\nCertaines adaptations sont absentes : nettoyage annule pour ne rien perdre.')

# 2) Fichiers indispensables (jamais deplaces)
INDISPENSABLES = {
    'app.py', 'bilans_tools.py', 'tableau_word.py', 'documents_obsrv.py', 'document_pdf_routes.py',
    'traitements_ttt.py', 'ttt_preview.py', 'videos_imageries.py', 'sortie_documents.py',
    'catalogue_traitements.json', 'ordre_traitements.json', 'normes_bilans.json',
    'modele_fiche_traitement.docx', 'sortie_modele.docx', 'requirements.txt', 'README.md', '.gitignore',
    'static/index.html', 'static/app.js', 'static/app.css', 'static/sortie-rdv-rappel.js',
    'static/logo.png', 'static/logo-mark.png',
}
for f in INDISPENSABLES:
    if not (root / f).exists():
        raise SystemExit('Fichier indispensable absent : ' + f + '. Nettoyage annule.')

# 3) Fichiers et dossiers devenus inutiles
a_deplacer = []
for motif in ['*.bak', 'static/*.bak']:
    a_deplacer += sorted(root.glob(motif))
for nom in [
    # scripts d'adaptation deja executes
    'adapter_menu_staffer.py', 'adapter_onglets_logs_admin.py', 'adapter_sortie_crh.py',
    'agrandir_date_imagerie.py', 'ajouter_autres_centrer_onglets.py', 'corriger_integration_word.py',
    'corriger_place_taille_onglets.py', 'installer_bilans_simples.py', 'installer_sortie.py',
    'installer_word_sortie.py', 'LIRE_MOI.txt',
    # sortie-crh-documents.js est maintenant integre DANS static/app.js (plus charge par index.html)
    'sortie-crh-documents.js', 'static/sortie-crh-documents.js',
    # dossiers des correctifs (leurs fichiers ont deja ete copies a la racine)
    'adaptation_ttt_v3', 'correctif_documents_v2', 'correction_style_fiche_ttt',
    'extension_documents_obsrv', 'extension_videos_imageries', 'imageries_petites_modifications',
    'videos_imageries_v2',
    # donnees de travail non utilisees par l'application
    'Fiche_normes.csv', '__pycache__',
]:
    p = root / nom
    if p.exists():
        a_deplacer.append(p)
a_deplacer += sorted(root.glob('Tableau_service_*.docx'))  # tableaux generes (donnees patients)

stamp = datetime.datetime.now().strftime('%Y%m%d_%H%M%S')
archive = root.parent / ('CVA_archive_' + stamp)
print('\n=== %d elements a deplacer vers %s ===' % (len(a_deplacer), archive))
for p in a_deplacer:
    rel = p.relative_to(root)
    print('  ' + str(rel))
    if not SIMULATION:
        cible = archive / rel
        cible.parent.mkdir(parents=True, exist_ok=True)
        shutil.move(str(p), str(cible))

# 4) requirements.txt : dependances reellement utilisees
REQUIREMENTS = 'Flask>=3.0,<4\ngunicorn\npython-docx\nPillow\nPyMuPDF\n'
# 5) .gitignore : ne jamais pousser la base, les fichiers patients ni les sauvegardes
GITIGNORE = """# Donnees (patients) : ne jamais pousser sur GitHub
cva.db
cva.db-*
uploads/
Tableau_service_*.docx

# Sauvegardes creees par les scripts d'adaptation
*.bak

# Python / environnements
__pycache__/
*.pyc
venv/
.venv/
.env

# Divers
dist/
server.log
CVA_archive_*/
"""
if not SIMULATION:
    (root / 'requirements.txt').write_text(REQUIREMENTS, encoding='utf-8')
    (root / '.gitignore').write_text(GITIGNORE, encoding='utf-8')
print('\nrequirements.txt et .gitignore mis a jour.' if not SIMULATION else '\n(Simulation : aucune modification effectuee.)')

print("""
=== Etapes suivantes ===
1. python -m pip install -r requirements.txt
2. python app.py  -> tester sur http://localhost:8000 (Ctrl+Shift+R)
3. git add -A
   git status            (verifier : ni cva.db, ni uploads/, ni .bak)
   git commit -m "Integration des adaptations + nettoyage du projet"
   git push origin main
""")
