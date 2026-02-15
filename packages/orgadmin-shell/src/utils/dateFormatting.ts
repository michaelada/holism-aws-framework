import { format, parse, Locale } from 'date-fns';
import { enGB, fr, es, it, de, pt } from 'date-fns/locale';
import { SupportedLocale } from '../i18n/config';

/**
 * Map of supported locales to date-fns locale objects
 */
const localeMap: Record<SupportedLocale, Locale> = {
  'en-GB': enGB,
  'fr-FR': fr,
  'es-ES': es,
  'it-IT': it,
  'de-DE': de,
  'pt-PT': pt,
};

/**
 * Cache for memoized date formatting results
 * Key format: `${timestamp}|${formatString}|${locale}`
 */
const dateFormatCache = new Map<string, string>();

/**
 * Maximum cache size to prevent memory leaks
 */
const MAX_CACHE_SIZE = 1000;

/**
 * Get the date-fns locale object for a given locale code
 * @param locale - The locale code (e.g., 'en-GB', 'fr-FR')
 * @returns The date-fns Locale object
 */
export function getDateFnsLocale(locale: string): Locale {
  try {
    const dateFnsLocale = localeMap[locale as SupportedLocale];
    if (!dateFnsLocale) {
      console.warn(`Unsupported locale for date formatting: ${locale}, falling back to en-GB`);
      return enGB;
    }
    return dateFnsLocale;
  } catch (error) {
    console.error('Error getting date-fns locale:', error);
    return enGB;
  }
}

/**
 * Clear the date formatting cache
 * Useful for testing or memory management
 */
export function clearDateFormatCache(): void {
  dateFormatCache.clear();
}

/**
 * Get the current size of the date format cache
 * @returns Number of cached entries
 */
export function getDateFormatCacheSize(): number {
  return dateFormatCache.size;
}

/**
 * Evict oldest entries from cache when it exceeds max size
 */
function evictOldestCacheEntries(): void {
  if (dateFormatCache.size > MAX_CACHE_SIZE) {
    const entriesToRemove = dateFormatCache.size - MAX_CACHE_SIZE;
    const iterator = dateFormatCache.keys();
    for (let i = 0; i < entriesToRemove; i++) {
      const key = iterator.next().value;
      if (key) {
        dateFormatCache.delete(key);
      }
    }
  }
}

/**
 * Format a date according to the specified locale (memoized)
 * @param date - The date to format
 * @param formatString - The format string (date-fns format)
 * @param locale - The locale code
 * @returns Formatted date string
 * 
 * @example
 * formatDate(new Date('2024-02-14'), 'PP', 'en-GB') // "14 February 2024"
 * formatDate(new Date('2024-02-14'), 'PP', 'fr-FR') // "14 février 2024"
 */
export function formatDate(date: Date | string | number, formatString: string, locale: string): string {
  try {
    const dateObj = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
    if (isNaN(dateObj.getTime())) {
      console.error('Invalid date provided to formatDate:', date);
      return String(date);
    }

    // Create cache key
    const timestamp = dateObj.getTime();
    const cacheKey = `${timestamp}|${formatString}|${locale}`;

    // Check cache
    if (dateFormatCache.has(cacheKey)) {
      return dateFormatCache.get(cacheKey)!;
    }

    // Format date
    const formatted = format(dateObj, formatString, { locale: getDateFnsLocale(locale) });

    // Store in cache
    dateFormatCache.set(cacheKey, formatted);
    evictOldestCacheEntries();

    return formatted;
  } catch (error) {
    console.error('Error formatting date:', error);
    return String(date);
  }
}

/**
 * Format a time according to the specified locale (memoized)
 * @param date - The date/time to format
 * @param locale - The locale code
 * @returns Formatted time string (HH:mm format)
 * 
 * @example
 * formatTime(new Date('2024-02-14T15:30:00'), 'en-GB') // "15:30"
 */
export function formatTime(date: Date | string | number, locale: string): string {
  try {
    const dateObj = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
    if (isNaN(dateObj.getTime())) {
      console.error('Invalid date provided to formatTime:', date);
      return String(date);
    }

    // Create cache key
    const timestamp = dateObj.getTime();
    const cacheKey = `${timestamp}|HH:mm|${locale}`;

    // Check cache
    if (dateFormatCache.has(cacheKey)) {
      return dateFormatCache.get(cacheKey)!;
    }

    // Format time
    const formatted = format(dateObj, 'HH:mm', { locale: getDateFnsLocale(locale) });

    // Store in cache
    dateFormatCache.set(cacheKey, formatted);
    evictOldestCacheEntries();

    return formatted;
  } catch (error) {
    console.error('Error formatting time:', error);
    return String(date);
  }
}

/**
 * Format a date and time according to the specified locale (memoized)
 * @param date - The date/time to format
 * @param locale - The locale code
 * @returns Formatted date and time string
 * 
 * @example
 * formatDateTime(new Date('2024-02-14T15:30:00'), 'en-GB') // "14/02/2024 15:30"
 * formatDateTime(new Date('2024-02-14T15:30:00'), 'fr-FR') // "14/02/2024 15:30"
 */
export function formatDateTime(date: Date | string | number, locale: string): string {
  try {
    const dateObj = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
    if (isNaN(dateObj.getTime())) {
      console.error('Invalid date provided to formatDateTime:', date);
      return String(date);
    }

    // Create cache key
    const timestamp = dateObj.getTime();
    const cacheKey = `${timestamp}|dd/MM/yyyy HH:mm|${locale}`;

    // Check cache
    if (dateFormatCache.has(cacheKey)) {
      return dateFormatCache.get(cacheKey)!;
    }

    // Format datetime
    const formatted = format(dateObj, 'dd/MM/yyyy HH:mm', { locale: getDateFnsLocale(locale) });

    // Store in cache
    dateFormatCache.set(cacheKey, formatted);
    evictOldestCacheEntries();

    return formatted;
  } catch (error) {
    console.error('Error formatting datetime:', error);
    return String(date);
  }
}

/**
 * Parse a date string according to the specified locale
 * @param dateString - The date string to parse
 * @param formatString - The format string (date-fns format)
 * @param locale - The locale code
 * @returns Parsed Date object
 * @throws Error if parsing fails
 * 
 * @example
 * parseDate('14/02/2024', 'dd/MM/yyyy', 'en-GB') // Date object for Feb 14, 2024
 */
export function parseDate(dateString: string, formatString: string, locale: string): Date {
  try {
    if (!dateString || typeof dateString !== 'string') {
      throw new Error('Invalid date string provided');
    }
    
    const referenceDate = new Date();
    const parsed = parse(dateString, formatString, referenceDate, { locale: getDateFnsLocale(locale) });
    
    // Check if the parsed date is valid
    if (isNaN(parsed.getTime())) {
      throw new Error(`Failed to parse date string: ${dateString}`);
    }
    
    return parsed;
  } catch (error) {
    console.error('Error parsing date:', error);
    throw error;
  }
}
