import { createContext, useContext } from "react";
import type { MineView, MineEvent } from "./transitions";

type MineViewContextType = {
  view: MineView;
  dispatchEvent: (event: MineEvent) => void;
};

export const MineViewContext = createContext<MineViewContextType | null>(null);

export const useMineView = (): MineViewContextType => {
  const context: MineViewContextType | null = useContext(MineViewContext);

  if (context === null) {
    throw new Error("You must add a <MineViewProvider> into the React tree");
  }

  return context;
};
