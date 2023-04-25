// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;


/**
 * The purpose of this contract is to hold 1USD tokens for gas compensation:
 * https://github.com/liquity/dev#gas-compensation
 * When a borrower opens a trove, an additional 50 1USD debt is issued,
 * and 50 1USD is minted and sent to this contract.
 * When a borrower closes their active trove, this gas compensation is refunded:
 * 50 1USD is burned from the this contract's balance, and the corresponding
 * 50 1USD debt on the trove is cancelled.
 * See this issue for more context: https://github.com/liquity/dev/issues/186
 */
contract GasPool {
    // do nothing, as the core contracts have permission to send to and burn from this address
}
