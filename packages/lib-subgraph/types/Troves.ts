/* tslint:disable */
/* eslint-disable */
// @generated
// This file was automatically generated and should not be edited.

import { OrderDirection, TroveStatus } from "./globalTypes";

// ====================================================
// GraphQL query operation: Troves
// ====================================================

export interface Troves_troves_owner {
  __typename: "User";
  /**
   * User's Ethereum address as a hex-string
   */
  id: string;
}

export interface Troves_troves {
  __typename: "Trove";
  /**
   * Owner's ID + '-' + an incremented integer
   */
  id: string;
  owner: Troves_troves_owner;
  status: TroveStatus;
  rawCollateral: any;
  rawDebt: any;
  rawStake: any;
  /**
   * The value of total redistributed per-stake collateral the last time rewards were applied
   */
  rawSnapshotOfTotalRedistributedCollateral: any;
  /**
   * The value of total redistributed per-stake debt the last time rewards were applied
   */
  rawSnapshotOfTotalRedistributedDebt: any;
}

export interface Troves {
  troves: Troves_troves[];
}

export interface TrovesVariables {
  orderDirection: OrderDirection;
  startingAt: number;
  first: number;
}
