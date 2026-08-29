import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  debounce,
  throttle,
  measureRender,
  measurePageLoad,
  lazyLoadImages,
  getWebVitals,
} from '../performance';

/**
 * The shell's performance helpers.
 *
 * `debounce` and `throttle` are the two that carry weight, because pages use
 * them on search boxes and scroll handlers where the difference is one request
 * per keystroke against one per pause. They look interchangeable and are not:
 * debounce runs *after* the storm and only once; throttle runs immediately and
 * then at most once per interval. Swapping them either fires a request per
 * character or drops the last one the user typed.
 *
 * The measuring helpers only log, so what is worth pinning is that they are
 * safe: they must not throw in an environment that lacks the APIs they read.
 */

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  delete (window as unknown as Record<string, unknown>).gtag;
});

describe('debounce', () => {
  it('waits for the calls to stop before running', () => {
    const run = vi.fn();
    const debounced = debounce(run, 300);

    debounced();
    expect(run).not.toHaveBeenCalled();
    vi.advanceTimersByTime(300);

    expect(run).toHaveBeenCalledTimes(1);
  });

  it('collapses a burst into a single call', () => {
    const run = vi.fn();
    const debounced = debounce(run, 300);

    'search'.split('').forEach(() => {
      debounced();
      vi.advanceTimersByTime(50);
    });
    vi.advanceTimersByTime(300);

    // One request for the word typed, not one per letter.
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('runs with the most recent arguments, not the first', () => {
    const run = vi.fn();
    const debounced = debounce(run, 300);

    debounced('sea');
    debounced('search');
    vi.advanceTimersByTime(300);

    // Searching for what the user typed first is worse than not searching.
    expect(run).toHaveBeenCalledWith('search');
  });

  it('runs again for a genuinely separate burst', () => {
    const run = vi.fn();
    const debounced = debounce(run, 300);

    debounced();
    vi.advanceTimersByTime(300);
    debounced();
    vi.advanceTimersByTime(300);

    expect(run).toHaveBeenCalledTimes(2);
  });
});

describe('throttle', () => {
  it('runs immediately, unlike debounce', () => {
    const run = vi.fn();
    const throttled = throttle(run, 300);

    throttled();

    // A throttled scroll handler that waited would leave the page unresponsive.
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('ignores everything else inside the interval', () => {
    const run = vi.fn();
    const throttled = throttle(run, 300);

    throttled();
    throttled();
    throttled();

    expect(run).toHaveBeenCalledTimes(1);
  });

  it('runs again once the interval has passed', () => {
    const run = vi.fn();
    const throttled = throttle(run, 300);

    throttled();
    vi.advanceTimersByTime(300);
    throttled();

    expect(run).toHaveBeenCalledTimes(2);
  });

  it('passes its arguments through', () => {
    const run = vi.fn();
    const throttled = throttle(run, 300);

    throttled({ scrollY: 120 });

    expect(run).toHaveBeenCalledWith({ scrollY: 120 });
  });
});

describe('measureRender', () => {
  it('reports an ordinary render quietly', () => {
    measureRender('MembersDatabasePage', performance.now());

    expect(console.log).toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
  });

  it('warns about a render slow enough for a person to notice', () => {
    measureRender('MembersDatabasePage', performance.now() - 500);

    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('slow'));
  });

  it('names the component, so the warning points somewhere', () => {
    measureRender('MembersDatabasePage', performance.now() - 500);

    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('MembersDatabasePage'));
  });
});

describe('measurePageLoad', () => {
  /** jsdom has no `performance.timing`; a browser that still has it looks like this. */
  const withLegacyTiming = (timing: Record<string, number>) =>
    Object.defineProperty(window.performance, 'timing', { value: timing, configurable: true });

  const TIMING = {
    navigationStart: 0,
    requestStart: 100,
    responseEnd: 400,
    domLoading: 200,
    domComplete: 900,
    domContentLoadedEventEnd: 800,
    loadEventEnd: 1200,
  };

  it('reports the timings once the page has loaded', () => {
    withLegacyTiming(TIMING);

    measurePageLoad();

    window.dispatchEvent(new Event('load'));
    vi.advanceTimersByTime(0);

    expect(console.log).toHaveBeenCalledWith('Performance Metrics:');
  });

  it('passes the load time to analytics when analytics is present', () => {
    withLegacyTiming(TIMING);
    const gtag = vi.fn();
    (window as unknown as Record<string, unknown>).gtag = gtag;

    measurePageLoad();
    window.dispatchEvent(new Event('load'));
    vi.advanceTimersByTime(0);

    expect(gtag).toHaveBeenCalledWith('event', 'timing_complete', expect.objectContaining({
      name: 'page_load',
    }));
  });

  it('warns when a page took longer than the three-second target', () => {
    withLegacyTiming({ ...TIMING, loadEventEnd: 5000 });

    measurePageLoad();
    window.dispatchEvent(new Event('load'));
    vi.advanceTimersByTime(0);

    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('exceeds 3 second target'));
  });

  it('gives up quietly where the deprecated timing API has been removed', () => {
    Object.defineProperty(window.performance, 'timing', { value: undefined, configurable: true });

    // Throwing here is an uncaught error inside a `load` listener on every page.
    measurePageLoad();
    expect(() => {
      window.dispatchEvent(new Event('load'));
      vi.advanceTimersByTime(0);
    }).not.toThrow();
  });

  it('does not fall over when there is no analytics to report to', () => {
    withLegacyTiming(TIMING);
    measurePageLoad();

    // Most environments have no gtag; throwing here would break page load.
    expect(() => {
      window.dispatchEvent(new Event('load'));
      vi.advanceTimersByTime(0);
    }).not.toThrow();
  });
});

describe('the browser-dependent helpers', () => {
  it('lazy-loads images without throwing where the observer exists', () => {
    const observe = vi.fn();
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        observe = observe;
        unobserve = vi.fn();
        disconnect = vi.fn();
      }
    );
    document.body.innerHTML = '<img class="lazy" data-src="/a.png" /><img src="/b.png" />';

    lazyLoadImages();

    // Only the images asking to be lazy-loaded are watched.
    expect(observe).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
  });

  it('does nothing at all where the observer is unavailable', () => {
    const original = window.IntersectionObserver;
    // @ts-expect-error deliberately removing it, as an older browser would
    delete window.IntersectionObserver;

    expect(() => lazyLoadImages()).not.toThrow();

    window.IntersectionObserver = original;
  });

  it('skips web vitals when the library was never loaded', async () => {
    // The import inside is dynamic, and the package is not a dependency here;
    // the guard is what stops that becoming a runtime failure.
    await expect(getWebVitals()).resolves.toBeUndefined();
  });
});
