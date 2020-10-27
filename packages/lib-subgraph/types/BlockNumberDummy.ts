/* tslint:disable */
/* eslint-disable */
// @generated
// This file was automatically generated and should not be edited.

// ====================================================
// GraphQL query operation: BlockNumberDummy
// ====================================================

export interface BlockNumberDummy_globals {
  __typename: "Global";
  /**
   * There should be only one System entity with an ID of 'only'
   */
  id: string;
}

export interface BlockNumberDummy {
  globals: BlockNumberDummy_globals[];
}

export interface BlockNumberDummyVariables {
  blockNumber: number;
}
