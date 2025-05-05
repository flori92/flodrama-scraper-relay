/**
 * Script de déploiement automatisé pour Render
 * 
 * Ce script utilise l'API Render pour déployer le serveur relais de scraping
 * sans avoir besoin d'utiliser l'interface web.
 */

const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');

// Configuration
const RENDER_API_KEY = 'rnd_JbhmArsV7suqDq7Ehr2sJ8RXL4fZ'; // Clé API Render
const SERVICE_NAME = 'flodrama-scraper';
const REPO_BRANCH = 'main';

// Fonction principale de déploiement
async function deployToRender() {
  console.log('🚀 Déploiement du serveur relais sur Render...');
  
  try {
    // 1. Vérifier si le service existe déjà
    console.log('📋 Vérification de l\'existence du service...');
    const existingService = await checkServiceExists();
    
    if (existingService) {
      console.log(`✅ Service trouvé avec l'ID: ${existingService.id}`);
      await triggerDeploy(existingService.id);
    } else {
      console.log('🆕 Création d\'un nouveau service...');
      await createService();
    }
    
    console.log('✨ Déploiement terminé avec succès!');
    console.log('📝 N\'oubliez pas de mettre à jour l\'URL dans relay-client.js');
  } catch (error) {
    console.error('❌ Erreur lors du déploiement:', error.message);
    if (error.response) {
      const errorBody = await error.response.text();
      console.error('Détails de l\'erreur:', errorBody);
    }
  }
}

// Vérifier si le service existe déjà
async function checkServiceExists() {
  const response = await fetch('https://api.render.com/v1/services', {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${RENDER_API_KEY}`,
      'Content-Type': 'application/json'
    }
  });
  
  if (!response.ok) {
    throw new Error(`Erreur lors de la récupération des services: ${response.status}`);
  }
  
  const services = await response.json();
  return services.find(service => service.name === SERVICE_NAME);
}

// Déclencher un nouveau déploiement pour un service existant
async function triggerDeploy(serviceId) {
  console.log(`🔄 Déclenchement d'un nouveau déploiement pour le service ${serviceId}...`);
  
  const response = await fetch(`https://api.render.com/v1/services/${serviceId}/deploys`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RENDER_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      clearCache: 'clear'
    })
  });
  
  if (!response.ok) {
    throw new Error(`Erreur lors du déclenchement du déploiement: ${response.status}`);
  }
  
  const deployData = await response.json();
  console.log(`✅ Déploiement déclenché avec succès! ID: ${deployData.id}`);
  
  // Attendre que le déploiement soit terminé
  await waitForDeployment(serviceId, deployData.id);
}

// Créer un nouveau service
async function createService() {
  const serviceConfig = {
    name: SERVICE_NAME,
    type: 'web_service',
    env: 'python',
    region: 'frankfurt',
    plan: 'free',
    buildCommand: 'pip install -r requirements.txt',
    startCommand: 'uvicorn main:app --host 0.0.0.0 --port $PORT',
    envVars: [
      { key: 'PYTHON_VERSION', value: '3.9.0' }
    ],
    autoDeploy: 'yes'
  };
  
  const response = await fetch('https://api.render.com/v1/services', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RENDER_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(serviceConfig)
  });
  
  if (!response.ok) {
    throw new Error(`Erreur lors de la création du service: ${response.status}`);
  }
  
  const serviceData = await response.json();
  console.log(`✅ Service créé avec succès! ID: ${serviceData.id}`);
  console.log(`🌐 URL du service: ${serviceData.serviceDetails.url}`);
  
  // Mettre à jour le fichier relay-client.js avec la nouvelle URL
  updateRelayClient(serviceData.serviceDetails.url);
  
  return serviceData;
}

// Attendre que le déploiement soit terminé
async function waitForDeployment(serviceId, deployId) {
  console.log('⏳ Attente de la fin du déploiement...');
  
  let isDeployed = false;
  let attempts = 0;
  
  while (!isDeployed && attempts < 30) {
    await new Promise(resolve => setTimeout(resolve, 10000)); // Attendre 10 secondes
    
    const response = await fetch(`https://api.render.com/v1/services/${serviceId}/deploys/${deployId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${RENDER_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Erreur lors de la vérification du déploiement: ${response.status}`);
    }
    
    const deployData = await response.json();
    console.log(`État du déploiement: ${deployData.status}`);
    
    if (deployData.status === 'live') {
      isDeployed = true;
      console.log('✅ Déploiement terminé avec succès!');
      
      // Récupérer l'URL du service
      const serviceResponse = await fetch(`https://api.render.com/v1/services/${serviceId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${RENDER_API_KEY}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (serviceResponse.ok) {
        const serviceData = await serviceResponse.json();
        console.log(`🌐 URL du service: ${serviceData.serviceDetails.url}`);
        
        // Mettre à jour le fichier relay-client.js avec la nouvelle URL
        updateRelayClient(serviceData.serviceDetails.url);
      }
    }
    
    attempts++;
  }
  
  if (!isDeployed) {
    console.log('⚠️ Le déploiement prend plus de temps que prévu. Vérifiez manuellement l\'état sur le tableau de bord Render.');
  }
}

// Mettre à jour le fichier relay-client.js avec la nouvelle URL
function updateRelayClient(serviceUrl) {
  const relayClientPath = path.join(__dirname, '..', 'src', 'relay-client.js');
  
  if (fs.existsSync(relayClientPath)) {
    console.log('📝 Mise à jour du fichier relay-client.js avec la nouvelle URL...');
    
    let content = fs.readFileSync(relayClientPath, 'utf8');
    
    // Remplacer l'URL du serveur relais
    content = content.replace(
      /constructor\(relayUrl = '.*?',/,
      `constructor(relayUrl = '${serviceUrl}',`
    );
    
    fs.writeFileSync(relayClientPath, content);
    console.log('✅ Fichier relay-client.js mis à jour avec succès!');
  } else {
    console.log('⚠️ Fichier relay-client.js non trouvé. Mise à jour manuelle requise.');
  }
}

// Exécuter le script
deployToRender().catch(console.error);
