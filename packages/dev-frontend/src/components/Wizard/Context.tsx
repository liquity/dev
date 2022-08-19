import { createContext, useContext, useState } from "react";

type ReactComponent = Function & (React.FC<any> | React.ComponentClass);

export type WizardContextType = {
  next: (() => void) | null;
  back: (() => void) | null;
  go: ((component: ReactComponent) => void) | null;
};

export const WizardContext = createContext<WizardContextType | null>(null);

export const useWizard = (): WizardContextType => {
  const context: WizardContextType | null = useContext(WizardContext);

  if (context === null) {
    return {
      next: null,
      back: null,
      go: null
    };
  }

  return context;
};

export type WizardProviderProps = {
  children: React.ReactComponentElement<any>[];
  onCancel?: () => void;
  onFinish?: () => void;
};

export const WizardProvider: React.FC<WizardProviderProps> = ({ children, onCancel, onFinish }) => {
  const [step, setStep] = useState<number>(0);
  const [history, setHistory] = useState<number[]>([]);

  const next = () => {
    if (step === children.length - 1 && onFinish) return onFinish();
    const nextStep = Math.min(children.length - 1, step + 1);
    setStep(nextStep);
    setHistory(history.concat(step));
  };

  const back = () => {
    if (step === 0 && onCancel) return onCancel();
    const prev = history.slice(history.length - 1)[0] ?? 0;
    setStep(prev);
    setHistory(history.slice(0, history.length - 1));
  };

  const go = (component: ReactComponent) => {
    const idx = children.findIndex(child => child.type.name === component.name);
    if (idx === -1) return;
    setStep(idx);
    setHistory(history.concat(step));
  };

  const provider: WizardContextType = {
    next,
    back,
    go
  };

  return <WizardContext.Provider value={provider}>{children[step]}</WizardContext.Provider>;
};
