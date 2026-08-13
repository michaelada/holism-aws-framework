import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { MODULE_IDS } from '../../context/OnboardingContext';

/**
 * The front end's modules and the backend's allow-list must be the same set.
 *
 * `PUT /api/user-preferences/onboarding` validates `modulesVisited` against its
 * own copy of this list and rejects the whole request — 400 — if it contains a
 * name it does not know. `OnboardingProvider` catches that, reverts its
 * optimistic update, and says nothing. The user ticked "Don't show this again",
 * watched the dialog close, and gets it back on their next visit.
 *
 * That is not hypothetical: the backend list was written with seven modules and
 * never grew, so dismissals for **merchandise, registrations, ticketing and
 * settings** were silently discarded for as long as those modules existed. No
 * test failed, because both sides were internally consistent.
 *
 * The list is read out of the backend source rather than imported: this package
 * does not depend on the backend, and a cross-package import would be a worse
 * coupling than reading a file in a test.
 */
describe('onboarding module ids', () => {
  const backendSource = readFileSync(
    join(__dirname, '../../../../backend/src/utils/onboarding-modules.ts'),
    'utf-8'
  );

  /** The string literals of `ONBOARDING_MODULE_IDS`, in order. */
  const backendModuleIds = (): string[] => {
    const declaration = backendSource.match(
      /export const ONBOARDING_MODULE_IDS = \[([\s\S]*?)\] as const;/
    );
    expect(declaration, 'ONBOARDING_MODULE_IDS not found in the backend source').toBeTruthy();

    return Array.from(declaration![1].matchAll(/'([^']+)'/g)).map((match) => match[1]);
  };

  it('are the same set on both sides', () => {
    expect([...backendModuleIds()].sort()).toEqual([...MODULE_IDS].sort());
  });

  it('include every module added since the backend list was written', () => {
    // Named explicitly: these four are the ones the drift actually cost.
    for (const moduleId of ['merchandise', 'registrations', 'ticketing', 'settings']) {
      expect(MODULE_IDS).toContain(moduleId);
      expect(backendModuleIds()).toContain(moduleId);
    }
  });

  it('has no duplicates on either side', () => {
    expect(new Set(MODULE_IDS).size).toBe(MODULE_IDS.length);
    expect(new Set(backendModuleIds()).size).toBe(backendModuleIds().length);
  });
});
