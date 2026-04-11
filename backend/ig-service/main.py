"""
ig-service — Microservice Python pour Instagram via instagrapi
Remplace instagram-private-api (Node.js) avec une lib maintenue activement.

Démarrage manuel  : uvicorn main:app --host 127.0.0.1 --port 3001
Via pm2           : pm2 start "uvicorn main:app --host 127.0.0.1 --port 3001" --name ig-service --cwd /chemin/backend/ig-service

Variables .env utilisées :
  IG_USERNAME       — identifiant Instagram
  IG_PASSWORD       — mot de passe Instagram
  IG_SERVICE_PORT   — port du service (défaut : 3001)
"""

import os
import sys
from pathlib import Path
from datetime import datetime, timezone

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from dotenv import load_dotenv

# Charger .env depuis la racine du projet (2 niveaux au-dessus de ig-service/)
load_dotenv(Path(__file__).parent.parent.parent / '.env')

from instagrapi import Client
from instagrapi.exceptions import (
    ChallengeRequired, LoginRequired, BadPassword,
    ReloginAttemptExceeded, ClientLoginRequired,
    TwoFactorRequired, ClientError,
)

# ── Config ────────────────────────────────────────────────────────────────────

USERNAME     = os.getenv('IG_USERNAME', '')
PASSWORD     = os.getenv('IG_PASSWORD', '')
SESSION_FILE = Path(__file__).parent / 'data' / 'session.json'

# ── État global ───────────────────────────────────────────────────────────────

cl = Client()
cl.delay_range = [1, 3]  # délai aléatoire entre requêtes (anti-détection)

_logged_in          = False
_checkpoint_pending = False
_username_connected = None

# ── Persistance session ───────────────────────────────────────────────────────

def save_session():
    SESSION_FILE.parent.mkdir(parents=True, exist_ok=True)
    cl.dump_settings(SESSION_FILE)

def load_session() -> bool:
    if SESSION_FILE.exists():
        try:
            cl.load_settings(SESSION_FILE)
            return True
        except Exception as e:
            print(f'[ig-service] Impossible de charger la session : {e}')
    return False

# ── Login ─────────────────────────────────────────────────────────────────────

def do_login(force_fresh: bool = False):
    global _logged_in, _checkpoint_pending, _username_connected

    if not USERNAME or not PASSWORD:
        raise RuntimeError('IG_USERNAME ou IG_PASSWORD non défini dans .env')

    if force_fresh and SESSION_FILE.exists():
        SESSION_FILE.unlink()

    # Charger session existante si disponible
    load_session()

    try:
        cl.login(USERNAME, PASSWORD)
        save_session()
        _logged_in          = True
        _checkpoint_pending = False
        _username_connected = cl.username
        print(f'[ig-service] Connecté en tant que @{cl.username}')

    except ChallengeRequired as e:
        _logged_in          = False
        _checkpoint_pending = True
        _username_connected = USERNAME
        print(f'[ig-service] Checkpoint requis pour @{USERNAME}')
        # Demander le code par email
        try:
            cl.challenge_resolve(cl.last_json)
            print('[ig-service] Code de vérification demandé (email/SMS)')
        except Exception as ce:
            print(f'[ig-service] Impossible de demander le code : {ce}')

    except (LoginRequired, BadPassword) as e:
        raise RuntimeError(f'Identifiants Instagram invalides : {e}')

    except TwoFactorRequired:
        raise RuntimeError('2FA activé sur ce compte — désactive-le ou utilise un code app')

    except Exception as e:
        raise RuntimeError(f'Erreur de connexion : {e}')

# ── App FastAPI ───────────────────────────────────────────────────────────────

app = FastAPI(title='EVA Instagram Service')

@app.on_event('startup')
async def startup():
    print('[ig-service] Démarrage…')
    try:
        do_login()
    except Exception as e:
        print(f'[ig-service] Erreur au démarrage : {e}')

# ── Modèles ───────────────────────────────────────────────────────────────────

class CodeBody(BaseModel):
    code: str

class ResendBody(BaseModel):
    method: str = 'email'  # 'email' | 'sms'

class ReplyCommentBody(BaseModel):
    media_id:   str
    comment_id: str
    text:       str

class ReplyDMBody(BaseModel):
    thread_id: str
    text:      str

# ── Routes ────────────────────────────────────────────────────────────────────

@app.get('/health')
def health():
    return {'ok': True}


@app.get('/status')
def status():
    return {
        'loggedIn':         _logged_in,
        'checkpointPending': _checkpoint_pending,
        'username':         _username_connected,
    }


@app.post('/login')
def login():
    try:
        do_login(force_fresh=True)
        return {
            'ok':               True,
            'loggedIn':         _logged_in,
            'checkpointPending': _checkpoint_pending,
            'username':         _username_connected,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post('/challenge/submit')
def challenge_submit(body: CodeBody):
    global _logged_in, _checkpoint_pending
    try:
        cl.challenge_send_code(body.code)
        save_session()
        _logged_in          = True
        _checkpoint_pending = False
        return {'ok': True}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post('/challenge/resend')
def challenge_resend(body: ResendBody):
    """Renvoyer le code : method = 'email' | 'sms'"""
    try:
        # Dans instagrapi : 1 = email, 0 = téléphone/SMS
        choice = 1 if body.method == 'email' else 0
        cl.challenge_resolve(cl.last_json, choice=choice)
        return {'ok': True}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get('/profile')
def profile():
    if not _logged_in:
        raise HTTPException(status_code=401, detail='Non connecté')
    try:
        user = cl.account_info()
        return {
            'username':       user.username,
            'fullName':       user.full_name,
            'profilePicUrl':  str(user.profile_pic_url) if user.profile_pic_url else None,
            'followersCount': user.follower_count,
            'mediaCount':     user.media_count,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get('/comments')
def get_comments(since_ts: int = 0):
    """Retourne les nouveaux commentaires depuis since_ts (epoch secondes)."""
    if not _logged_in:
        raise HTTPException(status_code=401, detail='Non connecté')
    try:
        nouveaux = []
        max_ts   = since_ts
        medias   = cl.user_medias(cl.user_id, amount=10)

        for media in medias:
            comments = cl.media_comments(media.pk, amount=50)
            for c in comments:
                ts = int(c.created_at_utc.timestamp())
                if ts <= since_ts:
                    continue
                if str(c.user.pk) == str(cl.user_id):
                    continue  # ignorer ses propres commentaires
                nouveaux.append({
                    'commentaireId': str(c.pk),
                    'mediaId':       str(media.pk),
                    'igAuteurId':    str(c.user.pk),
                    'igAuteurNom':   c.user.username,
                    'texte':         c.text,
                    'ts':            ts,
                })
                if ts > max_ts:
                    max_ts = ts

        return {'commentaires': nouveaux, 'maxTs': max_ts}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get('/dms')
def get_dms(since_ts: int = 0):
    """Retourne les nouveaux DMs depuis since_ts (epoch secondes)."""
    if not _logged_in:
        raise HTTPException(status_code=401, detail='Non connecté')
    try:
        nouveaux = []
        max_ts   = since_ts
        threads  = cl.direct_threads(amount=20)

        for thread in threads:
            if not thread.messages:
                continue
            msg = thread.messages[0]  # dernier message du fil
            ts  = int(msg.timestamp.timestamp()) if msg.timestamp else 0
            if ts <= since_ts:
                continue
            if str(msg.user_id) == str(cl.user_id):
                continue  # ignorer ses propres messages

            sender = thread.users[0] if thread.users else None
            nouveaux.append({
                'threadId':   str(thread.id),
                'igAuteurId': str(sender.pk) if sender else str(msg.user_id),
                'igAuteurNom': sender.username if sender else None,
                'texte':      msg.text or '(media)',
                'ts':         ts,
            })
            if ts > max_ts:
                max_ts = ts

        return {'dms': nouveaux, 'maxTs': max_ts}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get('/dms/list')
def list_dms(limit: int = 20):
    """Liste les DMs récents (lecture seule, sans màj timestamp)."""
    if not _logged_in:
        raise HTTPException(status_code=401, detail='Non connecté')
    try:
        threads = cl.direct_threads(amount=limit)
        result  = []
        for thread in threads:
            msg    = thread.messages[0] if thread.messages else None
            sender = thread.users[0] if thread.users else None
            ts     = int(msg.timestamp.timestamp()) if msg and msg.timestamp else 0
            result.append({
                'threadId':   str(thread.id),
                'igAuteurId': str(sender.pk) if sender else '',
                'igAuteurNom': sender.username if sender else None,
                'texte':      (msg.text or '(media)') if msg else '',
                'timestamp':  datetime.fromtimestamp(ts, tz=timezone.utc).isoformat() if ts else None,
                'isOwn':      str(msg.user_id) == str(cl.user_id) if msg else False,
            })
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post('/comments/reply')
def reply_comment(body: ReplyCommentBody):
    if not _logged_in:
        raise HTTPException(status_code=401, detail='Non connecté')
    try:
        cl.media_comment(body.media_id, body.text, replied_to_comment_id=body.comment_id)
        return {'ok': True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post('/dms/reply')
def reply_dm(body: ReplyDMBody):
    if not _logged_in:
        raise HTTPException(status_code=401, detail='Non connecté')
    try:
        cl.direct_send(body.text, thread_ids=[body.thread_id])
        return {'ok': True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post('/force-login')
def force_login():
    global _logged_in, _checkpoint_pending
    try:
        do_login(force_fresh=True)
        return {
            'ok':               True,
            'loggedIn':         _logged_in,
            'checkpointPending': _checkpoint_pending,
            'username':         _username_connected,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
