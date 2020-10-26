import { useContext } from "react";

import { LiquityStore } from "@liquity/lib-base";

import { LiquityStoreContext } from "../components/LiquityStoreProvider";

export const useLiquityStore = <T>(): LiquityStore<T> => {
  const store = useContext(LiquityStoreContext);

  if (!store) {
    throw new Error("You must provide a LiquityStore via LiquityStoreProvider");
  }

  return store as LiquityStore<T>;
};
