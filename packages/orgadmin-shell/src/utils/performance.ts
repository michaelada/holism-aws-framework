/**
 * Performance Monitoring Utilities
 * 
 * Provides utilities for monitoring and optimizing application performance
 */

/**
 * Measure and log page load performance
 */
export function measurePageLoad(): void {
  if (typeof window === 'undefined' || !window.performance) {
    return;
  }

  window.addEventListener('load', () => {
    // Wait for all resources to load
    setTimeout(() => {
      const perfData = window.performance.timing;
      const pageLoadTime = perfData.loadEventEnd - perfData.navigationStart;
      const connectTime = perfData.responseEnd - perfData.requestStart;
      const renderTime = perfData.domComplete - perfData.domLoading;
      const domReadyTime = perfData.domContentLoadedEventEnd - perfData.navigationStart;

      console.log('Performance Metrics:');
      console.log(`  Page Load Time: ${pageLoadTime}ms`);
      console.log(`  DOM Ready Time: ${domReadyTime}ms`);
      console.log(`  Connect Time: ${connectTime}ms`);
      console.log(`  Render Time: ${renderTime}ms`);

      // Log warning if page load is slow
      if (pageLoadTime > 3000) {
        console.warn(`Page load time (${pageLoadTime}ms) exceeds 3 second target`);
      }

      // Report to analytics if available
      if (window.gtag) {
        window.gtag('event', 'timing_complete', {
          name: 'page_load',
          value: pageLoadTime,
          event_category: 'Performance',
        });
      }
    }, 0);
  });
}

/**
 * Measure component render time
 */
export function measureRender(componentName: string, startTime: number): void {
  const endTime = performance.now();
  const renderTime = endTime - startTime;

  if (renderTime > 100) {
    console.warn(`${componentName} render time: ${renderTime.toFixed(2)}ms (slow)`);
  } else {
    console.log(`${componentName} render time: ${renderTime.toFixed(2)}ms`);
  }
}

/**
 * Debounce function for performance optimization
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;

  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null;
      func(...args);
    };

    if (timeout) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(later, wait);
  };
}

/**
 * Throttle function for performance optimization
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;

  return function executedFunction(...args: Parameters<T>) {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

/**
 * Lazy load images with Intersection Observer
 */
export function lazyLoadImages(): void {
  if ('IntersectionObserver' in window) {
    const imageObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const img = entry.target as HTMLImageElement;
          if (img.dataset.src) {
            img.src = img.dataset.src;
            img.classList.remove('lazy');
            observer.unobserve(img);
          }
        }
      });
    });

    document.querySelectorAll('img.lazy').forEach(img => {
      imageObserver.observe(img);
    });
  }
}

/**
 * Get Web Vitals metrics
 */
export async function getWebVitals(): Promise<void> {
  if ('web-vital' in window) {
    const { getCLS, getFID, getFCP, getLCP, getTTFB } = await import('web-vitals');

    getCLS(console.log);
    getFID(console.log);
    getFCP(console.log);
    getLCP(console.log);
    getTTFB(console.log);
  }
}

// Declare gtag for TypeScript
declare global {
  interface Window {
    gtag?: (...args: any[]) => void;
  }
}
