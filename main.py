from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import requests
from bs4 import BeautifulSoup
import random
import time
import uvicorn

app = FastAPI(title="FloDrama Scraping Relay")

# Activer CORS pour permettre les requêtes depuis Cloudflare Workers
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Liste des User-Agents pour simuler différents navigateurs
USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36 Edg/123.0.0.0',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/123.0'
]

def get_random_user_agent():
    """Retourne un User-Agent aléatoire de la liste"""
    return random.choice(USER_AGENTS)

class ScrapeRequest(BaseModel):
    url: str

@app.get("/")
async def root():
    """Page d'accueil du serveur relais"""
    return {"message": "FloDrama Scraping Relay - Serveur opérationnel"}

@app.get("/ping")
async def ping():
    """Endpoint de ping pour vérifier que le serveur est opérationnel"""
    return {"status": "ok", "message": "Le serveur relais est opérationnel", "timestamp": time.time()}

@app.post("/scrape")
async def scrape(request: ScrapeRequest):
    """
    Point d'entrée principal pour le scraping.
    Récupère le HTML d'une URL en contournant les protections anti-bot.
    """
    url = request.url
    
    if not url:
        raise HTTPException(status_code=400, detail="URL manquante")
    
    try:
        # Ajouter un délai aléatoire pour éviter la détection
        time.sleep(random.uniform(1, 3))
        
        # Configurer les headers pour simuler un navigateur réel
        headers = {
            'User-Agent': get_random_user_agent(),
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
            'Accept-Encoding': 'gzip, deflate, br',
            'Referer': 'https://www.google.com/',
            'DNT': '1',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'cross-site',
            'Sec-Fetch-User': '?1',
            'Cache-Control': 'max-age=0'
        }
        
        # Effectuer la requête HTTP
        response = requests.get(
            url, 
            headers=headers, 
            timeout=30,
            allow_redirects=True
        )
        response.raise_for_status()
        
        # Analyser le HTML avec BeautifulSoup
        soup = BeautifulSoup(response.text, 'html.parser')
        
        # Retourner le HTML et les métadonnées
        return {
            "html": response.text,
            "title": soup.title.text if soup.title else None,
            "status": response.status_code,
            "url": response.url,  # URL finale après redirections
            "content_type": response.headers.get('Content-Type')
        }
    
    except requests.RequestException as e:
        raise HTTPException(status_code=500, detail=f"Erreur de requête: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur: {str(e)}")

# Pour le développement local uniquement
if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)