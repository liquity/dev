import { LiquityStore } from "@liquity/lib-base";
import React, { createContext, useEffect, useState } from "react";

export const LiquityStoreContext = createContext<LiquityStore | undefined>(undefined);

type LiquityStoreProviderProps = {
  store: LiquityStore;
  loader?: React.ReactNode;
};

export const LiquityStoreProvider: React.FC<LiquityStoreProviderProps> = ({
  store,
  loader,
  children
}) => {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    store.onLoaded = () => setLoaded(true);
    return store.start();
  }, [store]);

  if (!loaded) {
    return <>{loader}</>;
  }

  return <LiquityStoreContext.Provider value={store}>{children}</LiquityStoreContext.Provider>;
};
