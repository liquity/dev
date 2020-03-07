import React, { createContext, useRef, useContext } from "react";
import { ToastMessage } from "rimble-ui";

const ToastContext = createContext<React.MutableRefObject<any> | undefined>(undefined);

export const ToastProvider: React.FC = ({ children }) => {
  const providerRef = useRef<any>();

  return (
    <>
      <ToastMessage.Provider ref={providerRef} />
      <ToastContext.Provider value={providerRef}>{children}</ToastContext.Provider>
    </>
  );
};

type ToastMessageData = {
  secondaryMessage?: string;
  actionHref?: string;
  actionText?: string;
  variant?: "default" | "success" | "failure" | "processing";
  icon?: string;
  colorTheme?: "light" | "dark";
  closeElem?: boolean;
};

export const useToast = (): { addMessage: (message: string, data: ToastMessageData) => void } => {
  const toast = useContext(ToastContext);

  return {
    addMessage: (
      message: string,
      {
        secondaryMessage,
        actionHref,
        actionText,
        variant = "default",
        icon,
        colorTheme = "light",
        closeElem = true
      }: ToastMessageData
    ) => {
      toast?.current?.addMessage(message, {
        secondaryMessage,
        actionHref,
        actionText,
        variant,
        icon,
        colorTheme,
        closeElem
      });
    }
  };
};
