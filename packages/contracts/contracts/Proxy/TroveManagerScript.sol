// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

import "../Interfaces/ITroveManager.sol";


contract TroveManagerScript {
    ITroveManager immutable troveManager;

    constructor(ITroveManager _troveManager) public {
        troveManager = _troveManager;
    }

    function redeemCollateral(
        uint _LUSDAmount,
        address _firstRedemptionHint,
        address _upperPartialRedemptionHint,
        address _lowerPartialRedemptionHint,
        uint _partialRedemptionHintNICR,
        uint _maxIterations,
        uint _maxFee
    ) external returns (uint) {
        troveManager.redeemCollateral(
            _LUSDAmount,
            _firstRedemptionHint,
            _upperPartialRedemptionHint,
            _lowerPartialRedemptionHint,
            _partialRedemptionHintNICR,
            _maxIterations,
            _maxFee
        );
    }
}
