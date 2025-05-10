# Service de Relais FloDrama pour le Scraping

Ce service permet de contourner les protections anti-bot en utilisant un serveur Render pour effectuer le scraping des sources de contenu pour FloDrama.

## Fonctionnalités

- Scraping de sites web avec protection anti-bot
- Authentification par clé API
- Extraction intelligente des données
- Support de la pagination
- Compatibilité avec diverses sources (Allociné, Senscritique, IMDB, etc.)

## Déploiement sur Render

### Prérequis

- Un compte [Render](https://render.com)
- Un dépôt Git contenant ce code

### Étapes de déploiement

1. Connectez-vous à votre compte Render
2. Cliquez sur "New" puis "Web Service"
3. Connectez votre dépôt GitHub ou utilisez l'option "Public Git repository"
4. Entrez l'URL du dépôt contenant ce service
5. Configurez le service avec les paramètres suivants :
   - **Name**: `flodrama-scraper`
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Plan**: Choisissez au moins le plan "Starter" (5$/mois) pour des performances acceptables

6. Dans la section "Environment Variables", ajoutez :
   - `API_KEY`: Votre clé API secrète (ex: `rnd_DJfpQC9gEu4KgTRvX8iQzMXxrteP`)
   - `PORT`: `3000` (ou laissez vide pour utiliser la valeur par défaut de Render)

7. Cliquez sur "Create Web Service"

Le déploiement prendra quelques minutes. Une fois terminé, Render vous fournira une URL (généralement sous la forme `https://flodrama-scraper.onrender.com`).

## Utilisation du service

### Vérifier le statut du service

```bash
curl -H "Authorization: Bearer votre_clé_api" https://flodrama-scraper.onrender.com/status
```

### Obtenir la liste des sources supportées

```bash
curl -H "Authorization: Bearer votre_clé_api" https://flodrama-scraper.onrender.com/sources
```

### Effectuer un scraping

```bash
curl -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer votre_clé_api" \
  -d '{
    "source": "allocine-films",
    "type": "film",
    "urls": ["https://www.allocine.fr/film/meilleurs/"],
    "selectors": {
      "main": ".card",
      "wait": ".cards"
    },
    "pagination": {
      "pattern": "page-{page}",
      "max": 3
    },
    "minItems": 20
  }' \
  https://flodrama-scraper.onrender.com/scrape
```

## Intégration avec FloDrama

Une fois le service déployé, mettez à jour la configuration dans le fichier `scraper-optimise.js` :

```javascript
// Configuration du service relais Render
RELAY_SERVICE: {
  ENABLED: process.env.USE_RELAY_SERVICE === 'true',
  BASE_URL: 'https://flodrama-scraper.onrender.com', // Remplacez par votre URL Render
  API_KEY: process.env.RENDER_API_KEY || 'votre_clé_api',
  TIMEOUT: 60000 // 60 secondes de timeout
}
```

## Maintenance

- Le service Render peut passer en mode "sleep" après une période d'inactivité sur les plans gratuits.
- Pour maintenir le service actif, vous pouvez configurer un ping régulier ou utiliser un plan payant.
- Surveillez l'utilisation des ressources dans le tableau de bord Render pour ajuster le plan si nécessaire.

## Dépannage

- **Erreur 404**: Vérifiez que le service est bien déployé et que l'URL est correcte
- **Erreur 401/403**: Vérifiez que la clé API est correcte
- **Erreur 422**: Vérifiez le format des données envoyées
- **Erreur 500**: Consultez les logs sur Render pour identifier le problème