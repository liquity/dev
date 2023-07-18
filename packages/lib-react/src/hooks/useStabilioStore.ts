import { useContext } from "react";

import { StabilioStore } from "@stabilio/lib-base";

import { StabilioStoreContext } from "../components/StabilioStoreProvider";

export const useStabilioStore = <T>(): StabilioStore<T> => {
  const store = useContext(StabilioStoreContext);

  if (!store) {
    throw new Error("You must provide a StabilioStore via StabilioStoreProvider");
  }

  return store as StabilioStore<T>;
};
