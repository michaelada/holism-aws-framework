/**
 * Formatting utilities for data display
 */

import { format, parseISO, formatDistanceToNow } from 'date-fns';

/**
 * Format a date to a readable string
 * 
 * @param date - Date to format (Date object, ISO string, or timestamp)
 * @param formatString - Format string (default: 'dd/MM/yyyy')
 * @returns Formatted date string
 */
export const formatDate = (
  date: Date | string | number,
  formatString = 'dd/MM/yyyy'
): string => {
  if (!date) return '';
  
  try {
    const dateObj = typeof date === 'string' ? parseISO(date) : new Date(date);
    return format(dateObj, formatString);
  } catch {
    return '';
  }
};

/**
 * Format a date and time to a readable string
 * 
 * @param date - Date to format
 * @param formatString - Format string (default: 'dd/MM/yyyy HH:mm')
 * @returns Formatted date and time string
 */
export const formatDateTime = (
  date: Date | string | number,
  formatString = 'dd/MM/yyyy HH:mm'
): string => {
  return formatDate(date, formatString);
};

/**
 * Format a date as relative time (e.g., "2 hours ago")
 * 
 * @param date - Date to format
 * @returns Relative time string
 */
export const formatRelativeTime = (date: Date | string | number): string => {
  if (!date) return '';
  
  try {
    const dateObj = typeof date === 'string' ? parseISO(date) : new Date(date);
    return formatDistanceToNow(dateObj, { addSuffix: true });
  } catch {
    return '';
  }
};

/**
 * Format a currency amount
 * 
 * @param amount - Amount to format
 * @param currency - Currency code (default: 'GBP')
 * @param locale - Locale for formatting (default: 'en-GB')
 * @returns Formatted currency string
 */
export const formatCurrency = (
  amount: number,
  currency = 'GBP',
  locale = 'en-GB'
): string => {
  if (amount === null || amount === undefined) return '';
  
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
};

/**
 * Format a number with thousand separators
 * 
 * @param value - Number to format
 * @param decimals - Number of decimal places (default: 0)
 * @param locale - Locale for formatting (default: 'en-GB')
 * @returns Formatted number string
 */
export const formatNumber = (
  value: number,
  decimals = 0,
  locale = 'en-GB'
): string => {
  if (value === null || value === undefined) return '';
  
  try {
    return new Intl.NumberFormat(locale, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(value);
  } catch {
    return value.toFixed(decimals);
  }
};

/**
 * Format a percentage
 * 
 * @param value - Value to format (0-1 or 0-100)
 * @param decimals - Number of decimal places (default: 0)
 * @param isDecimal - Whether value is in decimal form (0-1) or percentage form (0-100)
 * @returns Formatted percentage string
 */
export const formatPercentage = (
  value: number,
  decimals = 0,
  isDecimal = true
): string => {
  if (value === null || value === undefined) return '';
  
  const percentage = isDecimal ? value * 100 : value;
  return `${percentage.toFixed(decimals)}%`;
};

/**
 * Format a file size in bytes to human-readable format
 * 
 * @param bytes - File size in bytes
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted file size string
 */
export const formatFileSize = (bytes: number, decimals = 2): string => {
  if (bytes === 0) return '0 Bytes';
  if (!bytes) return '';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(decimals))} ${sizes[i]}`;
};

/**
 * Format a phone number
 * 
 * @param phone - Phone number to format
 * @returns Formatted phone number
 */
export const formatPhone = (phone: string): string => {
  if (!phone) return '';
  
  // Remove all non-digit characters
  const cleaned = phone.replace(/\D/g, '');
  
  // Format based on length
  if (cleaned.length === 10) {
    // Format as (XXX) XXX-XXXX
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  } else if (cleaned.length === 11) {
    // Format as X (XXX) XXX-XXXX
    return `${cleaned[0]} (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
  }
  
  return phone; // Return original if format not recognized
};

/**
 * Truncate a string to a maximum length
 * 
 * @param text - Text to truncate
 * @param maxLength - Maximum length
 * @param suffix - Suffix to add when truncated (default: '...')
 * @returns Truncated string
 */
export const truncate = (text: string, maxLength: number, suffix = '...'): string => {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  
  return text.slice(0, maxLength - suffix.length) + suffix;
};

/**
 * Capitalize the first letter of a string
 * 
 * @param text - Text to capitalize
 * @returns Capitalized string
 */
export const capitalize = (text: string): string => {
  if (!text) return '';
  return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
};

/**
 * Convert a string to title case
 * 
 * @param text - Text to convert
 * @returns Title case string
 */
export const titleCase = (text: string): string => {
  if (!text) return '';
  
  return text
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

/**
 * Convert camelCase or PascalCase to readable text
 * 
 * @param text - Text to convert
 * @returns Readable text
 */
export const camelToReadable = (text: string): string => {
  if (!text) return '';
  
  return text
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, str => str.toUpperCase())
    .trim();
};

/**
 * Format a status string for display
 * 
 * @param status - Status to format
 * @returns Formatted status string
 */
export const formatStatus = (status: string): string => {
  if (!status) return '';
  
  return status
    .replace(/_/g, ' ')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};

/**
 * Format an array as a comma-separated list
 * 
 * @param items - Array of items
 * @param maxItems - Maximum number of items to show (default: all)
 * @returns Formatted list string
 */
export const formatList = (items: string[], maxItems?: number): string => {
  if (!items || items.length === 0) return '';
  
  const displayItems = maxItems ? items.slice(0, maxItems) : items;
  const remaining = items.length - displayItems.length;
  
  let result = displayItems.join(', ');
  if (remaining > 0) {
    result += ` and ${remaining} more`;
  }
  
  return result;
};
