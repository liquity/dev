import { StabilioStore } from "@stabilio/lib-base";
import React, { createContext, useEffect, useState } from "react";

export const StabilioStoreContext = createContext<StabilioStore | undefined>(undefined);

type StabilioStoreProviderProps = {
  store: StabilioStore;
  loader?: React.ReactNode;
};

export const StabilioStoreProvider: React.FC<StabilioStoreProviderProps> = ({
  store,
  loader,
  children
}) => {
  const [loadedStore, setLoadedStore] = useState<StabilioStore>();

  useEffect(() => {
    store.onLoaded = () => setLoadedStore(store);
    const stop = store.start();

    return () => {
      store.onLoaded = undefined;
      setLoadedStore(undefined);
      stop();
    };
  }, [store]);

  if (!loadedStore) {
    return <>{loader}</>;
  }

  return <StabilioStoreContext.Provider value={loadedStore}>{children}</StabilioStoreContext.Provider>;
};
