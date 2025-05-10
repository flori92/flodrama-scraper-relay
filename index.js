/**
 * Service de relais pour le scraping FloDrama
 * 
 * Ce service permet de contourner les protections anti-bot en utilisant
 * un serveur Render pour effectuer le scraping.
 * 
 * @author FloDrama Team
 * @version 1.0.0
 */

const express = require('express');
const cors = require('cors');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const { executablePath } = require('puppeteer');
const app = express();
const PORT = process.env.PORT || 3000;

// Configuration
const API_KEY = process.env.API_KEY || 'rnd_DJfpQC9gEu4KgTRvX8iQzMXxrteP';
const TIMEOUT = 60000; // 60 secondes

// Middleware pour l'authentification
const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentification requise' });
  }
  
  const token = authHeader.split(' ')[1];
  
  if (token !== API_KEY) {
    return res.status(403).json({ error: 'Clé API invalide' });
  }
  
  next();
};

// Configuration de l'application
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Configurer puppeteer avec le plugin stealth
puppeteer.use(StealthPlugin());

// Route pour vérifier le statut du service
app.get('/status', authenticate, (req, res) => {
  const uptime = process.uptime();
  const uptimeFormatted = formatUptime(uptime);
  
  res.json({
    status: 'ok',
    version: '1.0.0',
    uptime: uptimeFormatted
  });
});

// Route pour lister les sources supportées
app.get('/sources', authenticate, (req, res) => {
  res.json({
    sources: [
      'allocine-films',
      'allocine-series',
      'senscritique-films',
      'senscritique-series',
      'imdb-films',
      'imdb-series',
      'tmdb-films',
      'tmdb-series'
    ]
  });
});

// Route principale pour le scraping
app.post('/scrape', authenticate, async (req, res) => {
  const startTime = Date.now();
  const { source, type, urls, selectors, pagination, minItems } = req.body;
  
  if (!source || !urls || !Array.isArray(urls) || urls.length === 0) {
    return res.status(422).json({
      error: 'Paramètres invalides',
      details: 'Les paramètres source, urls (array) sont requis'
    });
  }
  
  console.log(`📌 Démarrage du scraping pour ${source} (${type || 'inconnu'})`);
  console.log(`🔗 URLs: ${urls.join(', ')}`);
  
  try {
    // Lancer le navigateur
    const browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        '--window-size=1920,1080'
      ],
      executablePath: executablePath()
    });
    
    // Créer une nouvelle page
    const page = await browser.newPage();
    
    // Configurer la page
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 Safari/537.36');
    
    // Activer l'interception des requêtes pour bloquer les ressources inutiles
    await page.setRequestInterception(true);
    page.on('request', (request) => {
      const resourceType = request.resourceType();
      if (resourceType === 'image' || resourceType === 'font' || resourceType === 'media') {
        request.abort();
      } else {
        request.continue();
      }
    });
    
    // Tableau pour stocker les résultats
    const results = [];
    
    // Traiter chaque URL
    for (const url of urls) {
      console.log(`🔍 Traitement de l'URL: ${url}`);
      
      try {
        // Naviguer vers l'URL
        await page.goto(url, {
          waitUntil: 'networkidle2',
          timeout: TIMEOUT
        });
        
        // Attendre le sélecteur spécifié si fourni
        if (selectors && selectors.wait) {
          console.log(`⏳ Attente du sélecteur: ${selectors.wait}`);
          await page.waitForSelector(selectors.wait, { timeout: TIMEOUT });
        }
        
        // Faire défiler la page pour charger le contenu dynamique
        await autoScroll(page);
        
        // Extraire les données
        const items = await extractData(page, selectors && selectors.main);
        
        console.log(`✅ ${items.length} éléments extraits de ${url}`);
        
        // Ajouter les résultats au tableau
        results.push(...items.map(item => ({
          ...item,
          source,
          type,
          url
        })));
        
        // Pagination si configurée
        if (pagination && pagination.pattern && pagination.max > 1) {
          console.log(`📄 Pagination configurée: ${pagination.max} pages maximum`);
          
          for (let i = 2; i <= pagination.max; i++) {
            const pageUrl = url.replace(/(\d+)$/, (match, p1) => {
              const currentPage = parseInt(p1, 10);
              const nextPage = currentPage + (pagination.offsetMultiplier || 1);
              return nextPage.toString();
            });
            
            if (pageUrl === url) continue;
            
            console.log(`🔍 Traitement de la page ${i}: ${pageUrl}`);
            
            await page.goto(pageUrl, {
              waitUntil: 'networkidle2',
              timeout: TIMEOUT
            });
            
            if (selectors && selectors.wait) {
              await page.waitForSelector(selectors.wait, { timeout: TIMEOUT });
            }
            
            await autoScroll(page);
            
            const pageItems = await extractData(page, selectors && selectors.main);
            
            console.log(`✅ ${pageItems.length} éléments extraits de ${pageUrl}`);
            
            results.push(...pageItems.map(item => ({
              ...item,
              source,
              type,
              url: pageUrl
            })));
            
            // Si on a suffisamment d'éléments, on arrête
            if (minItems && results.length >= minItems) {
              console.log(`🛑 Nombre minimum d'éléments atteint (${minItems}), arrêt de la pagination`);
              break;
            }
          }
        }
      } catch (error) {
        console.error(`❌ Erreur lors du traitement de l'URL ${url}: ${error.message}`);
      }
    }
    
    // Fermer le navigateur
    await browser.close();
    
    // Calculer le temps d'exécution
    const executionTime = (Date.now() - startTime) / 1000;
    
    // Envoyer les résultats
    res.json({
      source,
      type,
      items: results,
      count: results.length,
      execution_time: executionTime,
      timestamp: new Date().toISOString()
    });
    
    console.log(`✅ Scraping terminé en ${executionTime.toFixed(2)}s - ${results.length} éléments récupérés`);
  } catch (error) {
    console.error(`❌ Erreur lors du scraping: ${error.message}`);
    res.status(500).json({
      error: 'Erreur lors du scraping',
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Fonction pour faire défiler automatiquement la page
async function autoScroll(page) {
  await page.evaluate(async () => {
    await new Promise((resolve) => {
      let totalHeight = 0;
      const distance = 100;
      const timer = setInterval(() => {
        const scrollHeight = document.body.scrollHeight;
        window.scrollBy(0, distance);
        totalHeight += distance;
        
        if (totalHeight >= scrollHeight) {
          clearInterval(timer);
          resolve();
        }
      }, 100);
    });
  });
}

// Fonction pour extraire les données de la page
async function extractData(page, selector) {
  if (!selector) {
    console.warn('⚠️ Aucun sélecteur principal fourni, utilisation du sélecteur par défaut');
    selector = '.card, .movie-card, .item';
  }
  
  return await page.evaluate((sel) => {
    const elements = document.querySelectorAll(sel);
    const items = [];
    
    elements.forEach((element) => {
      // Extraire le titre
      const titleElement = element.querySelector('h2, h3, .title, [class*="title"], [class*="Title"]');
      const title = titleElement ? titleElement.textContent.trim() : '';
      
      // Extraire l'URL
      const linkElement = element.querySelector('a[href]');
      const link = linkElement ? linkElement.href : '';
      
      // Extraire l'image
      const imgElement = element.querySelector('img');
      const imgSrc = imgElement ? (imgElement.src || imgElement.dataset.src) : '';
      
      // Extraire la description
      const descElement = element.querySelector('p, .description, [class*="description"], [class*="Description"]');
      const description = descElement ? descElement.textContent.trim() : '';
      
      // Extraire la note
      const ratingElement = element.querySelector('.rating, [class*="rating"], [class*="Rating"], .note, [class*="note"], [class*="Note"]');
      const rating = ratingElement ? ratingElement.textContent.trim() : '';
      
      // Extraire l'année
      const yearElement = element.querySelector('.year, [class*="year"], [class*="Year"], .date, [class*="date"], [class*="Date"]');
      const year = yearElement ? yearElement.textContent.trim() : '';
      
      // Créer l'objet item
      const item = {
        title,
        link,
        poster_url: imgSrc,
        description,
        rating,
        year,
        id: Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
      };
      
      // Ajouter l'item au tableau
      items.push(item);
    });
    
    return items;
  }, selector);
}

// Fonction pour formater le temps d'uptime
function formatUptime(uptime) {
  const days = Math.floor(uptime / 86400);
  const hours = Math.floor((uptime % 86400) / 3600);
  const minutes = Math.floor((uptime % 3600) / 60);
  const seconds = Math.floor(uptime % 60);
  
  return `${days}j ${hours}h ${minutes}m ${seconds}s`;
}

// Démarrer le serveur
app.listen(PORT, () => {
  console.log(`🚀 Service de relais FloDrama démarré sur le port ${PORT}`);
  console.log(`📅 Date de démarrage: ${new Date().toISOString()}`);
});