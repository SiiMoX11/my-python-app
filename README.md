# Chirurgie Viscérale A — CHU Oujda : plateforme du service

Prototype web pour l'équipe du service. Backend en Python (Flask + SQLite). Interface en HTML/CSS/JS, servie directement par Flask.

## Lancer en local

```bash
pip install -r requirements.txt
python app.py            # puis ouvrir http://localhost:8000
```

Au premier lancement, la base `cva.db` est créée avec des comptes et des patients de démonstration :

| Identifiant | Mot de passe | Rôle |
|---|---|---|
| admin | admin123 | Administrateur (utilisateurs + journal global) |
| dr.alami | medecin123 | Médecin |
| inf.sara | infirmier123 | Infirmier(e) |

Pour repartir d'une base vide, supprimer `cva.db` puis relancer.

## Structure

```
app.py              API REST + base SQLite + authentification par jeton
static/index.html   Page unique
static/app.css      Styles (fidèles aux maquettes)
static/app.js       Écrans : login, plan du service, chambres, hors service, dossier patient
uploads/            Vidéos et images importées
```

## Fonctions

- Connexion (mots de passe hachés, jeton de session).
- Plan du service vu de haut : 18 chambres (201 à 218), table des dossiers hors service au centre, effet zoom au survol, couleur selon l'occupation.
- Fenêtre de chambre (fond flou) avec les lits F (fenêtre) et P (porte). Un clic sur un lit libre permet d'admettre un patient.
- Fenêtre hors service : patients hébergés dans d'autres services.
- Dossier patient avec 7 onglets :
  - MAJ : consignes à cocher, identité, motif + ATCDs, clinique (gestes, surveillance, constantes, drains), bilans par date (le plus récent en haut), examens complémentaires avec détails dépliables, avis spécialisés. Bouton (+) partout ; un clic sur un élément permet de le modifier ou de le supprimer.
  - OBSRV, TTT, VIDEOS (lien ou fichier), ANAPATH, SORTIE (fiche de sortie, impression, libération du lit), LOGS (qui a fait quoi, et quand).
- Recherche par nom ou IP, archives des patients sortis, réadmission, gestion des utilisateurs.

## Hébergement pour l'équipe

Option 1, serveur interne du CHU (recommandé pour des données de santé) : une machine Linux ou Windows sur le réseau du service.

```bash
pip install -r requirements.txt
gunicorn -w 2 -b 0.0.0.0:8000 app:app      # Linux
# Sous Windows : pip install waitress && waitress-serve --port=8000 app:app
```

L'équipe se connecte ensuite à `http://IP-DU-SERVEUR:8000`. Mettez un HTTPS devant (Nginx ou Caddy).

Option 2, cloud (Render, Railway, PythonAnywhere ou un VPS) :
- Commande de démarrage : `gunicorn -w 2 -b 0.0.0.0:$PORT app:app`
- Variables : `CVA_DB=/chemin/persistant/cva.db`, `CVA_UPLOADS=/chemin/persistant/uploads`
- Le disque doit être persistant, sinon la base SQLite est effacée à chaque redéploiement.

## Avant une utilisation réelle

- Changez tous les mots de passe de démonstration et supprimez les patients fictifs.
- Utilisez HTTPS. Faites une sauvegarde quotidienne de `cva.db` et du dossier `uploads/`.
- Au Maroc, les données de santé relèvent de la loi 09-08 (CNDP). Il faut l'accord de l'établissement avant d'y mettre de vrais patients.
- Si plusieurs dizaines d'utilisateurs écrivent en même temps, passez à PostgreSQL.
