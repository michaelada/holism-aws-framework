#!/usr/bin/env node
/**
 * Script to add Memberships translations to all locale files
 */

const fs = require('fs');
const path = require('path');

const localesDir = path.join(__dirname, '../packages/orgadmin-shell/src/locales');

// Read the English memberships translations as the source
const enTranslationPath = path.join(localesDir, 'en-GB/translation.json');
const enTranslations = JSON.parse(fs.readFileSync(enTranslationPath, 'utf8'));
const membershipTranslations = enTranslations.memberships;

// Read the Spanish memberships translations
const esTranslationPath = path.join(localesDir, 'es-ES/memberships-translations.json');
const esTranslations = JSON.parse(fs.readFileSync(esTranslationPath, 'utf8'));

// Locale mappings
const locales = {
  'es-ES': esTranslations.memberships,
  'it-IT': {
    // Italian translations will be added here
  },
  'de-DE': {
    // German translations will be added here
  },
  'pt-PT': {
    // Portuguese translations will be added here
  }
};

// Update each locale file
Object.keys(locales).forEach(locale => {
  const translationPath = path.join(localesDir, `${locale}/translation.json`);
  
  try {
    let translations = {};
    if (fs.existsSync(translationPath)) {
      translations = JSON.parse(fs.readFileSync(translationPath, 'utf8'));
    }
    
    // Add memberships section
    translations.memberships = locales[locale];
    
    // Write back
    fs.writeFileSync(translationPath, JSON.stringify(translations, null, 2) + '\n', 'utf8');
    console.log(`✓ Updated ${locale}/translation.json`);
  } catch (error) {
    console.error(`✗ Failed to update ${locale}/translation.json:`, error.message);
  }
});

console.log('\nDone!');
