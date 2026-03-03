"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Check } from "lucide-react";

import { cn } from "./lib/utils";
import { Button } from "./button";
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogContent as ShadcnDialogContent,
} from "./dialog";
import { useMultiPageDialogStore } from "./multi-page-dialog-store";
import { Progress } from "./progress";

// Types
export interface MultiPageDialogStep<TData = Record<string, unknown>> {
  id: string;
  title: string;
  description?: string;
  component: React.ComponentType<MultiPageDialogStepProps<TData>>;
  optional?: boolean;
  validation?: (data: TData) => Promise<boolean> | boolean;
  onEnter?: (data: TData) => Promise<void> | void;
  onExit?: (data: TData) => Promise<void> | void;
  nextLabel?: string;
  previousLabel?: string;
  showNext?: boolean;
  showPrevious?: boolean;
  showProgress?: boolean;
}

export interface MultiPageDialogStepProps<TData = Record<string, unknown>> {
  data: TData;
  updateData: (updates: Partial<TData>) => void;
  goToStep: (stepId: string) => void;
  goNext: () => void;
  goPrevious: () => void;
  isFirstStep: boolean;
  isLastStep: boolean;
  currentStepIndex: number;
  totalSteps: number;
  // Dynamic step management
  addStep?: (step: MultiPageDialogStep<TData>, afterIndex?: number) => void;
  removeStep?: (stepId: string) => void;
  updateStep?: (
    stepId: string,
    updates: Partial<MultiPageDialogStep<TData>>,
  ) => void;
}

export interface MultiPageDialogConfig<TData = Record<string, unknown>> {
  title: string;
  description?: string;
  steps: MultiPageDialogStep<TData>[];
  initialData?: TData;
  onComplete?: (data: TData) => Promise<void> | void;
  onCancel?: () => void;
  showStepIndicator?: boolean;
  showProgress?: boolean;
  size?: "sm" | "md" | "lg" | "xl" | "full";
  closeOnComplete?: boolean;
  disableOutsideClick?: boolean;
  persistenceKey?: string; // Key for localStorage persistence
  dynamicSteps?: boolean; // Enable dynamic step management
}

// Context type
interface MultiPageDialogContextType<TData = Record<string, unknown>> {
  currentStepIndex: number;
  currentStep: MultiPageDialogStep<TData> | null;
  data: TData;
  config: MultiPageDialogConfig<TData>;
  updateData: (updates: Partial<TData>) => void;
  goToStep: (stepId: string) => void;
  goNext: () => void;
  goPrevious: () => void;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  isProcessing: boolean;
  setIsProcessing: (processing: boolean) => void;
  // Dynamic step management
  addStep: (step: MultiPageDialogStep<TData>, afterIndex?: number) => void;
  removeStep: (stepId: string) => void;
  updateStep: (
    stepId: string,
    updates: Partial<MultiPageDialogStep<TData>>,
  ) => void;
  dynamicSteps: MultiPageDialogStep<TData>[];
}

const MultiPageDialogContext = createContext<
  MultiPageDialogContextType | undefined
>(undefined);

export const useMultiPageDialog = () => {
  const context = useContext(MultiPageDialogContext);
  if (!context) {
    throw new Error(
      "useMultiPageDialog must be used within a MultiPageDialogProvider",
    );
  }
  return context;
};

function StepIndicator() {
  const { currentStepIndex, config, dynamicSteps } = useMultiPageDialog();

  if (!config.showStepIndicator) return null;

  return (
    <div className="flex items-center justify-center space-x-2">
      {dynamicSteps.map((step, index) => (
        <div key={step.id} className="flex items-center">
          <div
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium",
              index < currentStepIndex
                ? "bg-primary text-primary-foreground"
                : index === currentStepIndex
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground",
            )}
          >
            {index < currentStepIndex ? (
              <Check className="h-4 w-4" />
            ) : (
              index + 1
            )}
          </div>
          {index < dynamicSteps.length - 1 && (
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

function ProgressBar() {
  const { config, currentStepIndex, dynamicSteps } = useMultiPageDialog();

  if (!config.showProgress) return null;

  const progress = ((currentStepIndex + 1) / dynamicSteps.length) * 100;

  return (
    <div className="space-y-2">
      <div className="flex justify-between text-sm">
        <span>
          Step {currentStepIndex + 1} of {dynamicSteps.length}
        </span>
        <span>{Math.round(progress)}%</span>
      </div>
      <Progress value={progress} className="h-2" />
    </div>
  );
}

function DialogNavigation() {
  const {
    currentStep,
    currentStepIndex,
    data,
    config,
    goNext,
    goPrevious,
    isProcessing,
    setIsProcessing,
    setIsOpen,
    dynamicSteps, // Add this to get dynamic steps
  } = useMultiPageDialog();

  const isFirstStep = currentStepIndex === 0;
  const isLastStep = currentStepIndex === dynamicSteps.length - 1; // Use dynamicSteps instead of config.steps

  const handleComplete = async () => {
    if (!currentStep || isProcessing) return;

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

      // Run completion callback
      if (config.onComplete) {
        await config.onComplete(data);
      }

      // Close dialog if configured to do so
      if (config.closeOnComplete !== false) {
        setIsOpen(false);
      }
    } catch (error) {
      console.error("Error completing dialog:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleNext = async () => {
    if (!currentStep || isProcessing) return;

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

      // Run onExit callback
      if (currentStep.onExit) {
        await currentStep.onExit(data);
      }

      // Move to next step
      goNext();
    } catch (error) {
      console.error("Error moving to next step:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  const showNext = currentStep?.showNext !== false;
  const showPrevious = currentStep?.showPrevious !== false && !isFirstStep;

  return (
    <div className="flex justify-between pt-4">
      <div>
        {showPrevious && (
          <Button
            variant="outline"
            onClick={goPrevious}
            disabled={isProcessing}
          >
            {currentStep?.previousLabel ?? "Previous"}
          </Button>
        )}
      </div>

      <div className="flex gap-2">
        <Button variant="outline" onClick={() => setIsOpen(false)}>
          Cancel
        </Button>
        {isLastStep ? (
          <Button onClick={handleComplete} disabled={isProcessing}>
            {isProcessing ? "Processing..." : "Complete"}
          </Button>
        ) : (
          showNext && (
            <Button onClick={handleNext} disabled={isProcessing}>
              {isProcessing
                ? "Processing..."
                : (currentStep?.nextLabel ?? "Next")}
            </Button>
          )
        )}
      </div>
    </div>
  );
}

function StepContent() {
  const {
    currentStep,
    data,
    updateData,
    goToStep,
    goNext,
    goPrevious,
    currentStepIndex,
    config,
    addStep,
    removeStep,
    updateStep,
    dynamicSteps,
  } = useMultiPageDialog();

  if (!currentStep) return null;

  const StepComponent = currentStep.component;
  const isFirstStep = currentStepIndex === 0;
  const isLastStep = currentStepIndex === dynamicSteps.length - 1;

  const stepProps = {
    data,
    updateData,
    goToStep,
    goNext,
    goPrevious,
    isFirstStep,
    isLastStep,
    currentStepIndex,
    totalSteps: dynamicSteps.length,
    // Only pass dynamic step functions if dynamicSteps is enabled
    ...(config.dynamicSteps && {
      addStep,
      removeStep,
      updateStep,
    }),
  };

  return (
    <div className="flex-1">
      <StepComponent {...stepProps} />
    </div>
  );
}

function MultiPageDialogProvider({
  config,
  isOpen,
  setIsOpen,
  children,
}: {
  config: MultiPageDialogConfig;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  children: React.ReactNode;
}) {
  const store = useMultiPageDialogStore();
  const persistenceKey = config.persistenceKey ?? "default";

  // Dynamic steps state (local to this dialog instance)
  const [dynamicSteps, setDynamicSteps] = useState<MultiPageDialogStep[]>(
    config.steps,
  );

  // Initialize dialog when component mounts (only once)
  useEffect(() => {
    if (config.persistenceKey) {
      store.initDialog(persistenceKey, config.initialData);
    }
  }, [persistenceKey, store, config.persistenceKey]); // Remove config.initialData dependency to avoid infinite loop

  // Update dynamic steps when config.steps changes
  useEffect(() => {
    setDynamicSteps(config.steps);
  }, [config.steps]);

  // Get current state from store
  const storeState = store.getDialogState(persistenceKey);
  const currentStepIndex = isOpen ? storeState.currentStepIndex : 0;

  // Memoize the data object to prevent unnecessary re-renders
  const data = useMemo(() => {
    return { ...config.initialData, ...storeState.data };
  }, [config.initialData, storeState.data]);

  const currentStep = dynamicSteps[currentStepIndex] ?? null;

  const updateData = useCallback(
    (updates: Partial<Record<string, unknown>>) => {
      if (config.persistenceKey) {
        store.updateData(persistenceKey, updates);
      }
    },
    [persistenceKey, store, config.persistenceKey],
  );

  const goToStep = useCallback(
    (stepId: string) => {
      const stepIndex = dynamicSteps.findIndex((step) => step.id === stepId);
      if (stepIndex !== -1) {
        store.setStep(persistenceKey, stepIndex);
      }
    },
    [persistenceKey, store, dynamicSteps],
  );

  const goNext = useCallback(async () => {
    if (currentStepIndex < dynamicSteps.length - 1) {
      // Get the current step for validation
      const currentStep = dynamicSteps[currentStepIndex];

      // Run validation if exists
      if (currentStep?.validation) {
        try {
          const isValid = await currentStep.validation(data);
          if (!isValid) {
            console.log("🔍 VALIDATION FAILED: Step validation returned false");
            return;
          }
          console.log("🔍 VALIDATION PASSED: Step validation succeeded");
        } catch (error) {
          console.error("🔍 VALIDATION ERROR:", error);
          return;
        }
      }

      // If validation passes (or doesn't exist), move to next step
      store.setStep(persistenceKey, currentStepIndex + 1);
    }
  }, [persistenceKey, store, currentStepIndex, dynamicSteps, data]);

  const goPrevious = useCallback(() => {
    if (currentStepIndex > 0) {
      store.setStep(persistenceKey, currentStepIndex - 1);
    }
  }, [persistenceKey, store, currentStepIndex]);

  const handleSetIsOpen = useCallback(
    (open: boolean) => {
      setIsOpen(open);
      if (!open && config.persistenceKey) {
        // Don't clear dialog data immediately - let it persist for reopening
        // store.clearDialog(persistenceKey);
      }
    },
    [setIsOpen, config.persistenceKey],
  );

  const setProcessing = useCallback(
    (processing: boolean) => {
      if (config.persistenceKey) {
        store.setProcessing(persistenceKey, processing);
      }
    },
    [persistenceKey, store, config.persistenceKey],
  );

  // Dynamic step management functions
  const addStep = useCallback(
    (step: MultiPageDialogStep, afterIndex?: number) => {
      setDynamicSteps((prev) => {
        const newSteps = [...prev];
        const insertIndex =
          afterIndex !== undefined ? afterIndex + 1 : newSteps.length;
        newSteps.splice(insertIndex, 0, step);
        return newSteps;
      });
    },
    [],
  );

  const removeStep = useCallback((stepId: string) => {
    setDynamicSteps((prev) => prev.filter((step) => step.id !== stepId));
  }, []);

  const updateStep = useCallback(
    (stepId: string, updates: Partial<MultiPageDialogStep>) => {
      setDynamicSteps((prev) =>
        prev.map((step) =>
          step.id === stepId ? { ...step, ...updates } : step,
        ),
      );
    },
    [],
  );

  const contextValue = useMemo(
    () => ({
      currentStepIndex,
      currentStep,
      data,
      config: { ...config, steps: dynamicSteps }, // Use dynamic steps in config
      updateData,
      goToStep,
      goNext,
      goPrevious,
      isOpen,
      setIsOpen: handleSetIsOpen,
      isProcessing: storeState.isProcessing,
      setIsProcessing: setProcessing,
      // Dynamic step management
      addStep,
      removeStep,
      updateStep,
      dynamicSteps,
    }),
    [
      currentStepIndex,
      currentStep,
      data,
      config,
      dynamicSteps,
      updateData,
      goToStep,
      goNext,
      goPrevious,
      isOpen,
      handleSetIsOpen,
      storeState.isProcessing,
      setProcessing,
      addStep,
      removeStep,
      updateStep,
    ],
  );

  return (
    <MultiPageDialogContext.Provider value={contextValue}>
      {children}
    </MultiPageDialogContext.Provider>
  );
}

export function MultiPageDialog({
  config,
  trigger,
  open,
  onOpenChange,
}: {
  config: MultiPageDialogConfig;
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const store = useMultiPageDialogStore();

  const isOpen = open ?? internalIsOpen;
  const baseSetIsOpen = onOpenChange ?? setInternalIsOpen;

  // Auto-restore dialog if persistence indicates it should be open
  // But only if this dialog is not being controlled externally
  useEffect(() => {
    if (
      config.persistenceKey &&
      !isOpen &&
      open === undefined &&
      onOpenChange === undefined
    ) {
      const persistedState = store.getDialogState(config.persistenceKey);
      // Check if there's persisted data (indicating user was in middle of flow)
      // AND if the dialog wasn't explicitly closed (no wasExplicitlyClosed flag)
      if (
        Object.keys(persistedState.data).length > 0 &&
        !persistedState.wasExplicitlyClosed
      ) {
        baseSetIsOpen(true);
      }
    }
  }, [config.persistenceKey, isOpen, baseSetIsOpen, store, open, onOpenChange]);

  // Custom close handler that clears persistence on explicit close
  const handleOpenChange = (newOpen: boolean) => {
    baseSetIsOpen(newOpen);

    if (!newOpen && config.persistenceKey) {
      // Mark that this dialog was explicitly closed by the user
      store.setExplicitlyClosed(config.persistenceKey, true);
    } else if (newOpen && config.persistenceKey) {
      // Reset the explicitly closed flag when opening
      store.setExplicitlyClosed(config.persistenceKey, false);
    }
  };

  // Prevent closing on outside click if configured
  const dialogOpenChange = config.disableOutsideClick
    ? (open: boolean) => {
        // Only allow closing via explicit actions (buttons)
        if (!open) return;
        handleOpenChange(open);
      }
    : handleOpenChange;

  const sizeClasses = {
    sm: "max-w-md",
    md: "max-w-lg",
    lg: "max-w-2xl",
    xl: "max-w-4xl",
    full: "max-w-[95vw] max-h-[95vh]",
  };

  return (
    <MultiPageDialogProvider
      config={config}
      isOpen={isOpen}
      setIsOpen={handleOpenChange}
    >
      <Dialog open={isOpen} onOpenChange={dialogOpenChange}>
        {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}

        <ShadcnDialogContent
          className={cn(
            "overflow-y-auto",
            config.size === "full"
              ? "h-[95vh] max-h-[95vh] w-[95vw] max-w-[95vw]"
              : "h-full max-h-[90vh] w-full max-w-[90vw]",
            sizeClasses[config.size ?? "lg"],
          )}
        >
          <DialogHeader>
            <DialogTitle>{config.title}</DialogTitle>
            {config.description && (
              <p className="text-sm text-muted-foreground">
                {config.description}
              </p>
            )}
          </DialogHeader>

          <div className="space-y-6">
            <StepIndicator />
            <ProgressBar />
            <StepContentWithHeader />
            <DialogNavigation />
          </div>
        </ShadcnDialogContent>
      </Dialog>
    </MultiPageDialogProvider>
  );
}

// New component to show step content with dynamic header
function StepContentWithHeader() {
  const { currentStep } = useMultiPageDialog();

  if (!currentStep) return null;

  return (
    <div className="space-y-4">
      {/* Step Header */}
      <div>
        <h3 className="text-lg font-medium">{currentStep.title}</h3>
        {currentStep.description && (
          <p className="text-sm text-muted-foreground">
            {currentStep.description}
          </p>
        )}
      </div>

      {/* Step Content */}
      <div className="min-h-[200px]">
        <StepContent />
      </div>
    </div>
  );
}
