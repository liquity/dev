import { createContext, useContext } from "react";

export const FarmViewContext = createContext(null);

export const useFarmView = () => {
  const context = useContext(FarmViewContext);

  if (context === null) {
    throw new Error("You must add a <FarmViewProvider> into the React tree");
  }

  return context;
};
