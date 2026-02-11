import { useState, useCallback, useEffect } from 'react';
import type { WizardConfiguration } from '../types';

export interface WizardState {
  currentStep: number;
  totalSteps: number;
  stepData: Record<number, any>;
  completedSteps: Set<number>;
}

export interface UseWizardResult {
  currentStep: number;
  totalSteps: number;
  isFirstStep: boolean;
  isLastStep: boolean;
  completedSteps: Set<number>;
  stepData: Record<number, any>;
  goToStep: (stepIndex: number) => void;
  nextStep: () => void;
  previousStep: () => void;
  updateStepData: (stepIndex: number, data: any) => void;
  getAllData: () => any;
}

/**
 * Hook for managing wizard state and navigation
 * 
 * @param wizardConfig - Wizard configuration from Object Definition
 * @returns Wizard state and navigation functions
 * 
 * @example
 * ```tsx
 * const wizard = useWizard(objectDef.wizardConfig);
 * 
 * const handleNext = (data: any) => {
 *   wizard.updateStepData(wizard.currentStep, data);
 *   wizard.nextStep();
 * };
 * 
 * const handleComplete = (data: any) => {
 *   wizard.updateStepData(wizard.currentStep, data);
 *   const allData = wizard.getAllData();
 *   await onSubmit(allData);
 * };
 * ```
 */
export function useWizard(wizardConfig: WizardConfiguration): UseWizardResult {
  const totalSteps = wizardConfig.steps.length;
  
  const [state, setState] = useState<WizardState>({
    currentStep: 0,
    totalSteps: totalSteps,
    stepData: {},
    completedSteps: new Set(),
  });

  // Update totalSteps when wizardConfig changes
  useEffect(() => {
    setState((prev) => ({
      ...prev,
      totalSteps: totalSteps,
    }));
  }, [totalSteps]);

  const goToStep = useCallback((stepIndex: number) => {
    if (stepIndex >= 0 && stepIndex < state.totalSteps) {
      setState((prev) => ({ ...prev, currentStep: stepIndex }));
    }
  }, [state.totalSteps]);

  const nextStep = useCallback(() => {
    setState((prev) => {
      if (prev.currentStep < prev.totalSteps - 1) {
        return {
          ...prev,
          currentStep: prev.currentStep + 1,
          completedSteps: new Set([...prev.completedSteps, prev.currentStep]),
        };
      }
      return prev;
    });
  }, []);

  const previousStep = useCallback(() => {
    setState((prev) => {
      if (prev.currentStep > 0) {
        return {
          ...prev,
          currentStep: prev.currentStep - 1,
        };
      }
      return prev;
    });
  }, []);

  const updateStepData = useCallback((stepIndex: number, data: any) => {
    setState((prev) => ({
      ...prev,
      stepData: {
        ...prev.stepData,
        [stepIndex]: data,
      },
    }));
  }, []);

  const getAllData = useCallback(() => {
    return Object.values(state.stepData).reduce(
      (acc, data) => ({ ...acc, ...data }),
      {}
    );
  }, [state.stepData]);

  return {
    currentStep: state.currentStep,
    totalSteps: state.totalSteps,
    isFirstStep: state.currentStep === 0,
    isLastStep: state.currentStep === state.totalSteps - 1,
    completedSteps: state.completedSteps,
    stepData: state.stepData,
    goToStep,
    nextStep,
    previousStep,
    updateStepData,
    getAllData,
  };
}
