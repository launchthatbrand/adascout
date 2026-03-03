"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import { Check, ChevronLeft, ChevronRight } from "lucide-react";

import { cn } from "./lib/utils";
import { Button } from "./button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./dialog";
import { Progress } from "./progress";

// === IMPROVED TYPES ===

export interface StepConfig<TData = Record<string, unknown>> {
  id: string;
  title: string;
  description?: string;
  component: React.ComponentType<StepProps<TData>>;
  validation?: (data: TData) => Promise<boolean> | boolean;
  canSkip?: boolean;
  showNext?: boolean;
  showPrevious?: boolean;
  nextLabel?: string;
  previousLabel?: string;
}

export interface StepProps<TData = Record<string, unknown>> {
  data: TData;
  updateData: (updates: Partial<TData>) => void;
  // Navigation
  goNext: () => Promise<void>;
  goPrevious: () => void;
  goToStep: (stepId: string) => void;
  // Step management
  insertStepAfter: (afterStepId: string, step: StepConfig<TData>) => void;
  insertStepBefore: (beforeStepId: string, step: StepConfig<TData>) => void;
  removeStep: (stepId: string) => void;
  updateStep: (stepId: string, updates: Partial<StepConfig<TData>>) => void;
  replaceStepsAfter: (
    afterStepId: string,
    newSteps: StepConfig<TData>[],
  ) => void;
  // State info
  currentStepIndex: number;
  totalSteps: number;
  isFirstStep: boolean;
  isLastStep: boolean;
  allSteps: StepConfig<TData>[];
}

export interface DialogConfig<TData = Record<string, unknown>> {
  title: string;
  description?: string;
  initialSteps: StepConfig<TData>[];
  initialData?: TData;
  onComplete?: (data: TData) => Promise<void> | void;
  onCancel?: () => void;
  size?: "sm" | "md" | "lg" | "xl" | "full";
  showProgress?: boolean;
  showStepIndicator?: boolean;
  closeOnComplete?: boolean;
}

// === CONTEXT ===

interface DialogContextValue<TData = Record<string, unknown>> {
  // State
  data: TData;
  currentStepIndex: number;
  steps: StepConfig<TData>[];
  isProcessing: boolean;

  // Actions
  updateData: (updates: Partial<TData>) => void;
  goNext: () => Promise<void>;
  goPrevious: () => void;
  goToStep: (stepId: string) => void;

  // Step management
  insertStepAfter: (afterStepId: string, step: StepConfig<TData>) => void;
  insertStepBefore: (beforeStepId: string, step: StepConfig<TData>) => void;
  removeStep: (stepId: string) => void;
  updateStep: (stepId: string, updates: Partial<StepConfig<TData>>) => void;
  replaceStepsAfter: (
    afterStepId: string,
    newSteps: StepConfig<TData>[],
  ) => void;

  // Computed state
  isFirstStep: boolean;
  isLastStep: boolean;

  // Config
  config: DialogConfig<TData>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const DialogContext = createContext<DialogContextValue<any> | null>(null);

export function useDialog<TData = Record<string, unknown>>() {
  const context = useContext(DialogContext);
  if (!context) {
    throw new Error("useDialog must be used within a DialogProvider");
  }
  return context as DialogContextValue<TData>;
}

// === IMPROVED DIALOG PROVIDER ===

function DialogProvider<TData = Record<string, unknown>>({
  config,
  children,
}: {
  config: DialogConfig<TData>;
  children: React.ReactNode;
}) {
  // === STATE ===
  const [data, setData] = useState<TData>(
    () =>
      ({
        ...config.initialData,
      }) as TData,
  );

  const [steps, setSteps] = useState<StepConfig<TData>[]>(config.initialSteps);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);

  // === DATA MANAGEMENT ===
  const updateData = useCallback((updates: Partial<TData>) => {
    setData((prev) => ({ ...prev, ...updates }));
  }, []);

  // === STEP MANAGEMENT ===
  const insertStepAfter = useCallback(
    (afterStepId: string, step: StepConfig<TData>) => {
      setSteps((prev) => {
        const afterIndex = prev.findIndex((s) => s.id === afterStepId);
        if (afterIndex === -1) return prev;

        const newSteps = [...prev];
        newSteps.splice(afterIndex + 1, 0, step);
        return newSteps;
      });
    },
    [],
  );

  const insertStepBefore = useCallback(
    (beforeStepId: string, step: StepConfig<TData>) => {
      setSteps((prev) => {
        const beforeIndex = prev.findIndex((s) => s.id === beforeStepId);
        if (beforeIndex === -1) return prev;

        const newSteps = [...prev];
        newSteps.splice(beforeIndex, 0, step);
        return newSteps;
      });
    },
    [],
  );

  const removeStep = useCallback(
    (stepId: string) => {
      setSteps((prev) => {
        const stepIndex = prev.findIndex((s) => s.id === stepId);
        if (stepIndex === -1) return prev;

        // Adjust current step index if necessary
        if (stepIndex <= currentStepIndex && currentStepIndex > 0) {
          setCurrentStepIndex((curr) => curr - 1);
        }

        return prev.filter((s) => s.id !== stepId);
      });
    },
    [currentStepIndex],
  );

  const updateStep = useCallback(
    (stepId: string, updates: Partial<StepConfig<TData>>) => {
      setSteps((prev) =>
        prev.map((step) =>
          step.id === stepId ? { ...step, ...updates } : step,
        ),
      );
    },
    [],
  );

  const replaceStepsAfter = useCallback(
    (afterStepId: string, newSteps: StepConfig<TData>[]) => {
      setSteps((prev) => {
        const afterIndex = prev.findIndex((s) => s.id === afterStepId);
        if (afterIndex === -1) return prev;

        // Keep steps up to and including the target step, replace everything after
        return [...prev.slice(0, afterIndex + 1), ...newSteps];
      });
    },
    [],
  );

  // === NAVIGATION ===
  const goToStep = useCallback(
    (stepId: string) => {
      const stepIndex = steps.findIndex((step) => step.id === stepId);
      if (stepIndex !== -1) {
        setCurrentStepIndex(stepIndex);
      }
    },
    [steps],
  );

  const goNext = useCallback(async () => {
    const currentStep = steps[currentStepIndex];
    if (!currentStep) return;

    setIsProcessing(true);
    try {
      // Run validation if exists
      if (currentStep.validation) {
        const isValid = await currentStep.validation(data);
        if (!isValid) {
          setIsProcessing(false);
          return;
        }
      }

      // Check if this is the last step
      if (currentStepIndex >= steps.length - 1) {
        // Complete the dialog
        if (config.onComplete) {
          await config.onComplete(data);
        }
      } else {
        // Move to next step
        setCurrentStepIndex((prev) => prev + 1);
      }
    } catch (error) {
      console.error("Error during navigation:", error);
    } finally {
      setIsProcessing(false);
    }
  }, [steps, currentStepIndex, data, config]);

  const goPrevious = useCallback(() => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex((prev) => prev - 1);
    }
  }, [currentStepIndex]);

  // === CONTEXT VALUE ===
  const contextValue = useMemo(
    () => ({
      data,
      currentStepIndex,
      steps,
      isProcessing,
      updateData,
      goNext,
      goPrevious,
      goToStep,
      insertStepAfter,
      insertStepBefore,
      removeStep,
      updateStep,
      replaceStepsAfter,
      isFirstStep: currentStepIndex === 0,
      isLastStep: currentStepIndex === steps.length - 1,
      config,
    }),
    [
      data,
      currentStepIndex,
      steps,
      isProcessing,
      updateData,
      goNext,
      goPrevious,
      goToStep,
      insertStepAfter,
      insertStepBefore,
      removeStep,
      updateStep,
      replaceStepsAfter,
      config,
    ],
  );

  return (
    <DialogContext.Provider value={contextValue}>
      {children}
    </DialogContext.Provider>
  );
}

// === DIALOG COMPONENTS ===

function StepIndicator() {
  const { steps, currentStepIndex } = useDialog();

  if (!steps.length) return null;

  return (
    <div className="mb-6 flex items-center justify-center space-x-2">
      {steps.map((step, index) => (
        <div key={step.id} className="flex items-center">
          <div
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-full border-2 text-sm font-medium",
              index < currentStepIndex
                ? "border-primary bg-primary text-primary-foreground"
                : index === currentStepIndex
                  ? "border-primary bg-background text-primary"
                  : "border-muted bg-background text-muted-foreground",
            )}
          >
            {index < currentStepIndex ? (
              <Check className="h-4 w-4" />
            ) : (
              index + 1
            )}
          </div>
          {index < steps.length - 1 && (
            <div
              className={cn(
                "mx-2 h-0.5 w-8",
                index < currentStepIndex ? "bg-primary" : "bg-muted",
              )}
            />
          )}
        </div>
      ))}
    </div>
  );
}

function StepContent() {
  const {
    steps,
    currentStepIndex,
    data,
    updateData,
    goNext,
    goPrevious,
    goToStep,
    insertStepAfter,
    insertStepBefore,
    removeStep,
    updateStep,
    replaceStepsAfter,
  } = useDialog();

  const currentStep = steps[currentStepIndex];

  if (!currentStep) {
    return <div>No step found</div>;
  }

  const StepComponent = currentStep.component;

  const stepProps: StepProps = {
    data,
    updateData,
    goNext,
    goPrevious,
    goToStep,
    insertStepAfter,
    insertStepBefore,
    removeStep,
    updateStep,
    replaceStepsAfter,
    currentStepIndex,
    totalSteps: steps.length,
    isFirstStep: currentStepIndex === 0,
    isLastStep: currentStepIndex === steps.length - 1,
    allSteps: steps,
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold">{currentStep.title}</h3>
        {currentStep.description && (
          <p className="text-sm text-muted-foreground">
            {currentStep.description}
          </p>
        )}
      </div>
      <StepComponent {...stepProps} />
    </div>
  );
}

function DialogNavigation() {
  const { steps, currentStepIndex, goNext, goPrevious, isProcessing } =
    useDialog();

  const currentStep = steps[currentStepIndex];
  const isFirstStep = currentStepIndex === 0;
  const isLastStep = currentStepIndex === steps.length - 1;

  const showPrevious = currentStep?.showPrevious !== false && !isFirstStep;
  const showNext = currentStep?.showNext !== false;

  return (
    <div className="flex items-center justify-between border-t pt-4">
      <div>
        {showPrevious && (
          <Button
            variant="outline"
            onClick={goPrevious}
            disabled={isProcessing}
          >
            <ChevronLeft className="mr-1 h-4 w-4" />
            {currentStep?.previousLabel ?? "Previous"}
          </Button>
        )}
      </div>

      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">
          Step {currentStepIndex + 1} of {steps.length}
        </span>
      </div>

      <div>
        {showNext && (
          <Button onClick={goNext} disabled={isProcessing}>
            {isLastStep ? "Complete" : (currentStep?.nextLabel ?? "Next")}
            {!isLastStep && <ChevronRight className="ml-1 h-4 w-4" />}
          </Button>
        )}
      </div>
    </div>
  );
}

function DialogProgress() {
  const { steps, currentStepIndex } = useDialog();

  if (!steps.length) return null;

  const progress = ((currentStepIndex + 1) / steps.length) * 100;

  return (
    <div className="mb-4">
      <Progress value={progress} className="h-2" />
    </div>
  );
}

// === MAIN DIALOG COMPONENT ===

export function ImprovedMultiPageDialog<TData = Record<string, unknown>>({
  config,
  open,
  onOpenChange,
  trigger,
}: {
  config: DialogConfig<TData>;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: React.ReactNode;
}) {
  const [internalOpen, setInternalOpen] = useState(false);

  const isOpen = open ?? internalOpen;
  const setIsOpen = onOpenChange ?? setInternalOpen;

  const sizeClasses = {
    sm: "max-w-md",
    md: "max-w-lg",
    lg: "max-w-2xl",
    xl: "max-w-4xl",
    full: "max-w-7xl h-full",
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      {trigger}
      <DialogContent
        className={cn(
          "max-h-[90vh] overflow-y-auto",
          sizeClasses[config.size ?? "md"],
        )}
      >
        <DialogProvider config={config}>
          <DialogHeader>
            <DialogTitle>{config.title}</DialogTitle>
            {config.description && (
              <p className="text-sm text-muted-foreground">
                {config.description}
              </p>
            )}
          </DialogHeader>

          <div className="space-y-6">
            {config.showProgress && <DialogProgress />}
            {config.showStepIndicator && <StepIndicator />}
            <StepContent />
            <DialogNavigation />
          </div>
        </DialogProvider>
      </DialogContent>
    </Dialog>
  );
}

// === UTILITY HOOKS ===

export function useStepData<TData = Record<string, unknown>>() {
  const { data, updateData } = useDialog<TData>();
  return { data, updateData };
}

export function useStepNavigation() {
  const {
    goNext,
    goPrevious,
    goToStep,
    currentStepIndex,
    isFirstStep,
    isLastStep,
  } = useDialog();
  return {
    goNext,
    goPrevious,
    goToStep,
    currentStepIndex,
    isFirstStep,
    isLastStep,
  };
}

export function useStepManagement<TData = Record<string, unknown>>() {
  const {
    insertStepAfter,
    insertStepBefore,
    removeStep,
    updateStep,
    replaceStepsAfter,
    steps,
  } = useDialog<TData>();

  return {
    insertStepAfter,
    insertStepBefore,
    removeStep,
    updateStep,
    replaceStepsAfter,
    steps,
  };
}
