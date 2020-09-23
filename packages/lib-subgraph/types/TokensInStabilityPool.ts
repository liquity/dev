/* tslint:disable */
/* eslint-disable */
// @generated
// This file was automatically generated and should not be edited.

// ====================================================
// GraphQL query operation: TokensInStabilityPool
// ====================================================

export interface TokensInStabilityPool_global_currentSystemState {
  __typename: "SystemState";
  tokensInStabilityPool: any;
}

export interface TokensInStabilityPool_global {
  __typename: "Global";
  currentSystemState: TokensInStabilityPool_global_currentSystemState | null;
}

export interface TokensInStabilityPool {
  global: TokensInStabilityPool_global | null;
}
