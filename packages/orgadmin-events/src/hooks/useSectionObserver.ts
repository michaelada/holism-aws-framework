/**
 * useSectionObserver Hook
 *
 * Uses the Intersection Observer API to track which section is currently
 * visible in the viewport. Returns the active section id, a ref map of
 * section elements, and a registration callback for wiring up section DOM
 * nodes.
 *
 * Used by EditEventPage to highlight the corresponding sidebar link as the
 * user scrolls through sections.
 */

import { useState, useRef, useCallback, useEffect } from 'react';

export interface UseSectionObserverReturn {
  /** The id of the section with the highest intersection ratio, or null if none are intersecting. */
  activeSectionId: string | null;
  /** A ref holding a Map from section id to its HTMLElement. */
  sectionRefs: React.MutableRefObject<Map<string, HTMLElement>>;
  /** Register (or unregister) a section element. Pass null to unregister. */
  registerSection: (id: string, element: HTMLElement | null) => void;
}

export function useSectionObserver(): UseSectionObserverReturn {
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
  const sectionRefs = useRef<Map<string, HTMLElement>>(new Map());
  const ratiosRef = useRef<Map<string, number>>(new Map());
  const observerRef = useRef<IntersectionObserver | null>(null);

  // Determine which observed section has the highest intersection ratio and
  // update activeSectionId accordingly.
  const updateActiveSection = useCallback(() => {
    let bestId: string | null = null;
    let bestRatio = 0;

    ratiosRef.current.forEach((ratio, id) => {
      if (ratio > 0 && ratio > bestRatio) {
        bestRatio = ratio;
        bestId = id;
      }
    });

    setActiveSectionId(bestId);
  }, []);

  // Create the IntersectionObserver once on mount and tear it down on unmount.
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const id = entry.target.getAttribute('id');
          if (id) {
            ratiosRef.current.set(id, entry.isIntersecting ? entry.intersectionRatio : 0);
          }
        });
        updateActiveSection();
      },
      {
        // Use multiple thresholds so the ratio updates smoothly as the user scrolls.
        threshold: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1],
      },
    );

    observerRef.current = observer;

    // Observe any sections that were registered before the observer was created.
    sectionRefs.current.forEach((element) => {
      observer.observe(element);
    });

    return () => {
      observer.disconnect();
      observerRef.current = null;
    };
  }, [updateActiveSection]);

  const registerSection = useCallback((id: string, element: HTMLElement | null) => {
    const observer = observerRef.current;

    if (element) {
      sectionRefs.current.set(id, element);
      observer?.observe(element);
    } else {
      const existing = sectionRefs.current.get(id);
      if (existing) {
        observer?.unobserve(existing);
      }
      sectionRefs.current.delete(id);
      ratiosRef.current.delete(id);
      updateActiveSection();
    }
  }, [updateActiveSection]);

  return { activeSectionId, sectionRefs, registerSection };
}
