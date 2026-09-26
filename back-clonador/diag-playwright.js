// Diagnóstico do Playwright — rode no MESMO terminal onde você sobe o backend:
//   node diag-playwright.js
require('dotenv/config'); // carrega o .env, igual ao backend (PLAYWRIGHT_BROWSERS_PATH etc.)
const { chromium } = require('playwright');
const fs = require('fs');

console.log('--- ambiente ---');
console.log('LOCALAPPDATA        :', process.env.LOCALAPPDATA || '(não definido)');
console.log('PLAYWRIGHT_BROWSERS_PATH:', process.env.PLAYWRIGHT_BROWSERS_PATH || '(não definido)');
console.log('versão playwright   :', require('playwright/package.json').version);

const p = chromium.executablePath();
console.log('--- navegador ---');
console.log('executablePath      :', p);
console.log('esse arquivo existe :', fs.existsSync(p) ? 'SIM' : 'NÃO');

chromium
  .launch({ headless: true, args: ['--disable-dev-shm-usage'] })
  .then(async (b) => {
    console.log('LAUNCH             : OK');
    await b.close();
  })
  .catch((e) => {
    console.log('LAUNCH             : FALHOU ->', String(e.message).split('\n')[0]);
  });
