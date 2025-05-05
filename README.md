# FloDrama Scraper Relay

Serveur relais Python pour le scraping de FloDrama, permettant de contourner les limitations des Cloudflare Workers.

## Fonctionnalités

- Serveur FastAPI pour relayer les requêtes de scraping
- Contournement des protections anti-bot avec rotation des User-Agents
- Compatible avec MyDramaList et VoirAnime
- API REST simple pour récupérer le HTML des pages cibles

## Installation

```bash
pip install -r requirements.txt
```

## Démarrage

```bash
uvicorn main:app --reload
```

## Utilisation

Envoyez une requête POST à l'endpoint `/scrape` avec un JSON contenant l'URL à scraper :

```json
{
  "url": "https://mydramalist.com/shows/recent/"
}
```

Le serveur retournera le HTML de la page ainsi que des métadonnées utiles.

## Déploiement

Ce serveur est conçu pour être déployé sur Render ou tout autre service d'hébergement Python.

## Licence

MIT
