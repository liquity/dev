import { createContext, useContext } from "react";
import type { TroveView, TroveEvent } from "./types";

type TroveViewContextType = {
  view: TroveView;
  dispatchEvent: (event: TroveEvent) => void;
};

export const TroveViewContext = createContext<TroveViewContextType | null>(null);

export const useTroveView = (): TroveViewContextType => {
  const context: TroveViewContextType | null = useContext(TroveViewContext);

  if (context === null) {
    throw new Error("You must add a <TroveViewProvider> into the React tree");
  }

  return context;
};
