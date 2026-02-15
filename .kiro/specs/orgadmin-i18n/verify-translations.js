#!/usr/bin/env node

/**
 * Translation Verification Script
 * 
 * This script verifies:
 * 1. All translation files exist for all locales
 * 2. All locales have the same translation keys
 * 3. No missing translations
 * 4. No empty translation values
 */

const fs = require('fs');
const path = require('path');

const SUPPORTED_LOCALES = ['en-GB', 'fr-FR', 'es-ES', 'it-IT', 'de-DE', 'pt-PT'];
const LOCALES_DIR = path.join(process.cwd(), 'packages/orgadmin-shell/src/locales');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function getAllKeys(obj, prefix = '') {
  let keys = [];
  for (const key in obj) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (typeof obj[key] === 'object' && obj[key] !== null) {
      keys = keys.concat(getAllKeys(obj[key], fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  return keys;
}

function checkTranslationFile(locale) {
  const filePath = path.join(LOCALES_DIR, locale, 'translation.json');
  
  if (!fs.existsSync(filePath)) {
    return { exists: false, keys: [], content: null };
  }
  
  try {
    const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const keys = getAllKeys(content);
    return { exists: true, keys, content };
  } catch (error) {
    return { exists: true, keys: [], content: null, error: error.message };
  }
}

function findEmptyValues(obj, prefix = '') {
  let emptyKeys = [];
  for (const key in obj) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (typeof obj[key] === 'object' && obj[key] !== null) {
      emptyKeys = emptyKeys.concat(findEmptyValues(obj[key], fullKey));
    } else if (obj[key] === '' || obj[key] === null || obj[key] === undefined) {
      emptyKeys.push(fullKey);
    }
  }
  return emptyKeys;
}

function main() {
  log('\n=== Translation Verification Report ===\n', 'blue');
  
  let hasErrors = false;
  const localeData = {};
  
  // Step 1: Check all translation files exist
  log('1. Checking translation files exist...', 'blue');
  for (const locale of SUPPORTED_LOCALES) {
    const data = checkTranslationFile(locale);
    localeData[locale] = data;
    
    if (!data.exists) {
      log(`   ✗ ${locale}: Translation file missing`, 'red');
      hasErrors = true;
    } else if (data.error) {
      log(`   ✗ ${locale}: Error parsing JSON - ${data.error}`, 'red');
      hasErrors = true;
    } else {
      log(`   ✓ ${locale}: Found (${data.keys.length} keys)`, 'green');
    }
  }
  
  // Step 2: Check all locales have same keys
  log('\n2. Checking translation key consistency...', 'blue');
  const enKeys = localeData['en-GB'].keys || [];
  
  if (enKeys.length === 0) {
    log('   ✗ English translation file is empty or missing', 'red');
    hasErrors = true;
  } else {
    log(`   English (en-GB) has ${enKeys.length} keys`, 'blue');
    
    for (const locale of SUPPORTED_LOCALES) {
      if (locale === 'en-GB') continue;
      
      const data = localeData[locale];
      if (!data.exists || data.error) continue;
      
      const missingKeys = enKeys.filter(key => !data.keys.includes(key));
      const extraKeys = data.keys.filter(key => !enKeys.includes(key));
      
      if (missingKeys.length > 0) {
        log(`   ✗ ${locale}: Missing ${missingKeys.length} keys`, 'red');
        if (missingKeys.length <= 10) {
          missingKeys.forEach(key => log(`      - ${key}`, 'red'));
        } else {
          log(`      First 10: ${missingKeys.slice(0, 10).join(', ')}`, 'red');
        }
        hasErrors = true;
      }
      
      if (extraKeys.length > 0) {
        log(`   ⚠ ${locale}: Has ${extraKeys.length} extra keys not in English`, 'yellow');
        if (extraKeys.length <= 10) {
          extraKeys.forEach(key => log(`      - ${key}`, 'yellow'));
        }
      }
      
      if (missingKeys.length === 0 && extraKeys.length === 0) {
        log(`   ✓ ${locale}: All keys match English`, 'green');
      }
    }
  }
  
  // Step 3: Check for empty values
  log('\n3. Checking for empty translation values...', 'blue');
  for (const locale of SUPPORTED_LOCALES) {
    const data = localeData[locale];
    if (!data.exists || data.error || !data.content) continue;
    
    const emptyKeys = findEmptyValues(data.content);
    
    if (emptyKeys.length > 0) {
      log(`   ✗ ${locale}: ${emptyKeys.length} empty values`, 'red');
      if (emptyKeys.length <= 10) {
        emptyKeys.forEach(key => log(`      - ${key}`, 'red'));
      } else {
        log(`      First 10: ${emptyKeys.slice(0, 10).join(', ')}`, 'red');
      }
      hasErrors = true;
    } else {
      log(`   ✓ ${locale}: No empty values`, 'green');
    }
  }
  
  // Step 4: Summary
  log('\n=== Summary ===\n', 'blue');
  
  const completedLocales = SUPPORTED_LOCALES.filter(locale => {
    const data = localeData[locale];
    if (!data.exists || data.error) return false;
    
    const missingKeys = enKeys.filter(key => !data.keys.includes(key));
    const emptyKeys = findEmptyValues(data.content);
    
    return missingKeys.length === 0 && emptyKeys.length === 0;
  });
  
  log(`Locales fully translated: ${completedLocales.length}/${SUPPORTED_LOCALES.length}`, 
    completedLocales.length === SUPPORTED_LOCALES.length ? 'green' : 'yellow');
  
  if (completedLocales.length === SUPPORTED_LOCALES.length) {
    log('✓ All locales are complete!', 'green');
  } else {
    const incompleteLocales = SUPPORTED_LOCALES.filter(l => !completedLocales.includes(l));
    log(`Incomplete locales: ${incompleteLocales.join(', ')}`, 'yellow');
  }
  
  if (hasErrors) {
    log('\n✗ Translation verification failed - issues found', 'red');
    process.exit(1);
  } else {
    log('\n✓ Translation verification passed', 'green');
    process.exit(0);
  }
}

main();
