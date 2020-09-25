/* tslint:disable */
/* eslint-disable */
// @generated
// This file was automatically generated and should not be edited.

// ====================================================
// GraphQL query operation: Total
// ====================================================

export interface Total_global_currentSystemState {
  __typename: "SystemState";
  totalCollateral: any;
  totalDebt: any;
}

export interface Total_global {
  __typename: "Global";
  currentSystemState: Total_global_currentSystemState | null;
}

export interface Total {
  global: Total_global | null;
}
