/* tslint:disable */
/* eslint-disable */
// @generated
// This file was automatically generated and should not be edited.

// ====================================================
// GraphQL query operation: Price
// ====================================================

export interface Price_global_currentSystemState {
  __typename: "SystemState";
  price: any;
}

export interface Price_global {
  __typename: "Global";
  currentSystemState: Price_global_currentSystemState | null;
}

export interface Price {
  global: Price_global | null;
}
