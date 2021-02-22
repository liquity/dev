// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

import "../Interfaces/IStabilityPool.sol";


contract StabilityPoolScript {
    IStabilityPool immutable stabilityPool;

    constructor(IStabilityPool _stabilityPool) public {
        stabilityPool = _stabilityPool;
    }

    function provideToSP(uint _amount, address _frontEndTag) external {
        stabilityPool.provideToSP(_amount, _frontEndTag);
    }

    function withdrawFromSP(uint _amount) external {
        stabilityPool.withdrawFromSP(_amount);
    }

    function withdrawETHGainToTrove(address _upperHint, address _lowerHint) external {
        stabilityPool.withdrawETHGainToTrove(_upperHint, _lowerHint);
    }
}
