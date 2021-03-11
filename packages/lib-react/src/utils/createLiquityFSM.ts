import { LiquityStoreListenerParams } from "@liquity/lib-base";

import { LiquityReducer } from "../hooks/useLiquityReducer";

export type LiquityFSMTransitions<S extends string, E extends string> = Record<
  S,
  Partial<Record<E, S>>
>;

export type LiquityFSMEvent<E extends string> = {
  type: "fireFSMEvent";
  event: E;
};

export type LiquityFSMReducer<S extends string, E extends string, T = unknown> = LiquityReducer<
  S,
  LiquityFSMEvent<E>,
  T
>;

const lookupNextState = <S extends string>(
  transitions: Record<S, Partial<Record<string, S>>>,
  currentState: S,
  event: string
): S => transitions[currentState][event] ?? currentState;

export const createLiquityFSMReducer = <S extends string, E extends string, T = unknown>(
  transitions: LiquityFSMTransitions<S, E>,
  mapStoreUpdateToEvent: (params: LiquityStoreListenerParams<T>) => E | undefined
): LiquityFSMReducer<S, E, T> => (state, action) => {
  switch (action.type) {
    case "fireFSMEvent":
      return lookupNextState(transitions, state, action.event);

    case "updateStore": {
      const mappedEvent = mapStoreUpdateToEvent(action);
      return mappedEvent !== undefined ? lookupNextState(transitions, state, mappedEvent) : state;
    }
  }
};
