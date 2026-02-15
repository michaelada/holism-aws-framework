/**
 * Cache for memoized currency formatting results
 * Key format: `${amount}|${currency}|${locale}`
 */
const currencyFormatCache = new Map<string, string>();

/**
 * Maximum cache size to prevent memory leaks
 */
const MAX_CACHE_SIZE = 1000;

/**
 * Clear the currency formatting cache
 * Useful for testing or memory management
 */
export function clearCurrencyFormatCache(): void {
  currencyFormatCache.clear();
}

/**
 * Get the current size of the currency format cache
 * @returns Number of cached entries
 */
export function getCurrencyFormatCacheSize(): number {
  return currencyFormatCache.size;
}

/**
 * Evict oldest entries from cache when it exceeds max size
 */
function evictOldestCacheEntries(): void {
  if (currencyFormatCache.size > MAX_CACHE_SIZE) {
    const entriesToRemove = currencyFormatCache.size - MAX_CACHE_SIZE;
    const iterator = currencyFormatCache.keys();
    for (let i = 0; i < entriesToRemove; i++) {
      const key = iterator.next().value;
      if (key) {
        currencyFormatCache.delete(key);
      }
    }
  }
}

/**
 * Format a currency value according to the specified locale (memoized)
 * Uses the Intl.NumberFormat API for locale-aware formatting
 * 
 * @param amount - The numeric amount to format
 * @param currency - The currency code (e.g., 'EUR', 'GBP', 'USD')
 * @param locale - The locale code (e.g., 'en-GB', 'fr-FR')
 * @returns Formatted currency string
 * 
 * @example
 * formatCurrency(1234.56, 'EUR', 'en-GB') // "€1,234.56"
 * formatCurrency(1234.56, 'EUR', 'fr-FR') // "1 234,56 €"
 * formatCurrency(1234.56, 'EUR', 'de-DE') // "1.234,56 €"
 */
export function formatCurrency(amount: number, currency: string, locale: string): string {
  try {
    // Handle edge cases
    if (typeof amount !== 'number' || isNaN(amount)) {
      console.error('Invalid amount provided to formatCurrency:', amount);
      return `${currency} 0.00`;
    }

    // Create cache key (round to 2 decimal places for consistent caching)
    const roundedAmount = Math.round(amount * 100) / 100;
    const cacheKey = `${roundedAmount}|${currency}|${locale}`;

    // Check cache
    if (currencyFormatCache.has(cacheKey)) {
      return currencyFormatCache.get(cacheKey)!;
    }

    // Format currency
    const formatter = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

    const formatted = formatter.format(amount);

    // Store in cache
    currencyFormatCache.set(cacheKey, formatted);
    evictOldestCacheEntries();

    return formatted;
  } catch (error) {
    console.error('Error formatting currency:', error);
    // Fallback to simple format
    return `${currency} ${amount.toFixed(2)}`;
  }
}

/**
 * Parse a currency string to a number
 * Handles locale-specific decimal and thousand separators
 * 
 * @param currencyString - The currency string to parse
 * @param locale - The locale code
 * @returns Parsed numeric value
 * 
 * @example
 * parseCurrency('€1,234.56', 'en-GB') // 1234.56
 * parseCurrency('1 234,56 €', 'fr-FR') // 1234.56
 * parseCurrency('1.234,56 €', 'de-DE') // 1234.56
 */
export function parseCurrency(currencyString: string, locale: string): number {
  try {
    // Remove currency symbols and whitespace
    let cleanString = currencyString.replace(/[^\d,.-]/g, '');

    // Determine decimal separator based on locale
    const decimalSeparator = getDecimalSeparator(locale);
    const thousandSeparator = decimalSeparator === ',' ? '.' : ',';

    // Remove thousand separators
    cleanString = cleanString.replace(new RegExp(`\\${thousandSeparator}`, 'g'), '');

    // Replace decimal separator with standard dot
    if (decimalSeparator !== '.') {
      cleanString = cleanString.replace(decimalSeparator, '.');
    }

    const parsed = parseFloat(cleanString);

    if (isNaN(parsed)) {
      console.error('Failed to parse currency string:', currencyString);
      return 0;
    }

    return parsed;
  } catch (error) {
    console.error('Error parsing currency:', error);
    return 0;
  }
}

/**
 * Get the decimal separator for a given locale
 * @param locale - The locale code
 * @returns The decimal separator character ('.' or ',')
 */
function getDecimalSeparator(locale: string): string {
  try {
    // Use Intl.NumberFormat to determine the decimal separator
    const formatter = new Intl.NumberFormat(locale);
    const parts = formatter.formatToParts(1.1);
    const decimalPart = parts.find(part => part.type === 'decimal');
    return decimalPart?.value || '.';
  } catch (error) {
    console.error('Error getting decimal separator:', error);
    return '.'; // Default to period
  }
}
