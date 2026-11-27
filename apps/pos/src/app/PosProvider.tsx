import { createContext, type JSX, useContext } from "solid-js";

import { createPosStore, type PosStore } from "./store";

const PosContext = createContext<PosStore>();

export function PosProvider(props: {
  store?: PosStore;
  children: JSX.Element;
}) {
  const store = props.store ?? createPosStore();

  return (
    <PosContext.Provider value={store}>{props.children}</PosContext.Provider>
  );
}

export function usePos(): PosStore {
  const store = useContext(PosContext);
  if (!store) {
    throw new Error("usePos must be used inside PosProvider");
  }
  return store;
}
