import { useState } from 'react';
import {
  Box,
  Stepper,
  Step,
  StepLabel,
  Typography,
  CircularProgress,
  Alert,
} from '@mui/material';
import type { FieldDefinition } from '../../types';
import { useMetadata } from '../../hooks/useMetadata';
import { useWizard } from '../../hooks/useWizard';
import { WizardStepForm } from './WizardStepForm';

export interface MetadataWizardProps {
  objectType: string;
  onComplete: (data: any) => Promise<void>;
  onCancel: () => void;
  initialValues?: Record<string, any>;
}

/**
 * MetadataWizard component that renders a multi-step wizard based on Object Definition
 * - Renders MUI Stepper with step indicators
 * - Displays current step fields using WizardStepForm
 * - Implements step navigation controls
 * - Validates step before allowing navigation
 * - Submits all data on completion
 * 
 * @example
 * ```tsx
 * <MetadataWizard
 *   objectType="customer"
 *   onComplete={async (data) => {
 *     await createInstance(data);
 *     navigate('/customers');
 *   }}
 *   onCancel={() => navigate('/customers')}
 * />
 * ```
 */
export function MetadataWizard({
  objectType,
  onComplete,
  onCancel,
  initialValues = {},
}: MetadataWizardProps): JSX.Element {
  const { objectDef, fields, loading, error } = useMetadata(objectType);
  const [allStepData, setAllStepData] = useState<Record<string, any>>(initialValues);

  // Check if wizard config exists
  if (!loading && objectDef && !objectDef.wizardConfig) {
    return (
      <Alert severity="error">
        Object type "{objectType}" does not have wizard configuration
      </Alert>
    );
  }

  const wizard = objectDef?.wizardConfig ? useWizard(objectDef.wizardConfig) : null;

  const handleStepSubmit = async (stepData: Record<string, any>) => {
    if (!wizard || !objectDef) return;

    // Update step data in wizard state
    wizard.updateStepData(wizard.currentStep, stepData);

    // Merge step data into all collected data
    const updatedData = { ...allStepData, ...stepData };
    setAllStepData(updatedData);

    if (wizard.isLastStep) {
      // Submit all collected data
      await onComplete(updatedData);
    } else {
      // Move to next step
      wizard.nextStep();
    }
  };

  const handleCancel = () => {
    if (!wizard) return;

    if (wizard.isFirstStep) {
      onCancel();
    } else {
      wizard.previousStep();
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error">
        Failed to load metadata: {error.message}
      </Alert>
    );
  }

  if (!objectDef || !fields || !wizard) {
    return (
      <Alert severity="error">
        Object definition or wizard configuration not found
      </Alert>
    );
  }

  // Sort wizard steps by order
  const sortedSteps = [...objectDef.wizardConfig!.steps].sort((a, b) => a.order - b.order);
  const currentStepConfig = sortedSteps[wizard.currentStep];

  // Get fields for current step
  const currentStepFields: FieldDefinition[] = fields.filter((f) =>
    currentStepConfig.fields.includes(f.shortName)
  );

  // Get initial values for current step from wizard state or initial values
  const currentStepInitialValues = wizard.stepData[wizard.currentStep] || {};

  return (
    <Box>
      <Typography variant="h5" gutterBottom>
        {objectDef.displayName}
      </Typography>

      {objectDef.description && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          {objectDef.description}
        </Typography>
      )}

      {/* Stepper showing all steps */}
      <Stepper activeStep={wizard.currentStep} sx={{ mb: 4 }}>
        {sortedSteps.map((step, index) => (
          <Step key={index} completed={wizard.completedSteps.has(index)}>
            <StepLabel>{step.name}</StepLabel>
          </Step>
        ))}
      </Stepper>

      {/* Current step content */}
      <Box>
        <Typography variant="h6" gutterBottom>
          {currentStepConfig.name}
        </Typography>
        
        {currentStepConfig.description && (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            {currentStepConfig.description}
          </Typography>
        )}

        <WizardStepForm
          fields={currentStepFields}
          objectDef={objectDef}
          initialValues={currentStepInitialValues}
          onSubmit={handleStepSubmit}
          onCancel={handleCancel}
          submitLabel={wizard.isLastStep ? 'Complete' : 'Next'}
          cancelLabel={wizard.isFirstStep ? 'Cancel' : 'Back'}
        />
      </Box>
    </Box>
  );
}
