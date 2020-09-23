/* tslint:disable */
/* eslint-disable */
// @generated
// This file was automatically generated and should not be edited.

// ====================================================
// GraphQL query operation: TotalRedistributed
// ====================================================

export interface TotalRedistributed_global {
  __typename: "Global";
  /**
   * Total redistributed per-stake debt
   */
  rawTotalRedistributedDebt: any;
  /**
   * Total redistributed per-stake collateral
   */
  rawTotalRedistributedCollateral: any;
}

export interface TotalRedistributed {
  global: TotalRedistributed_global | null;
}
