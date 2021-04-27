import { createContext, useContext } from "react";

export const TroveViewContext = createContext(null);

export const useTroveView = () => {
  const context = useContext(TroveViewContext);

  if (context === null) {
    throw new Error("You must add a <TroveViewProvider> into the React tree");
  }

  return context;
};

export default useTroveView;
