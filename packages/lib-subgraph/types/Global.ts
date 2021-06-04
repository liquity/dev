/* tslint:disable */
/* eslint-disable */
// @generated
// This file was automatically generated and should not be edited.

// ====================================================
// GraphQL query operation: Global
// ====================================================

export interface Global_global_currentSystemState {
  __typename: "SystemState";
  /**
   * Sequence number as an ID (string)
   */
  id: string;
  price: any | null;
  totalCollateral: any;
  totalDebt: any;
  tokensInStabilityPool: any;
}

export interface Global_global {
  __typename: "Global";
  /**
   * There should be only one System entity with an ID of 'only'
   */
  id: string;
  numberOfOpenTroves: number;
  /**
   * Total redistributed per-stake collateral
   */
  rawTotalRedistributedCollateral: any;
  /**
   * Total redistributed per-stake debt
   */
  rawTotalRedistributedDebt: any;
  currentSystemState: Global_global_currentSystemState | null;
}

export interface Global {
  global: Global_global | null;
}
