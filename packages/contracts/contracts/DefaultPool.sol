pragma solidity 0.5.16;

import "./Dependencies/Pool.sol";


contract DefaultPool is Pool {
    address public stabilityPoolAddress;
    address public activePoolAddress;

    // --- Modifiers ---

    modifier onlyPoolManagerOrPool {
        require(
            _msgSender() == poolManagerAddress || 
            _msgSender() == stabilityPoolAddress || 
            _msgSender() == activePoolAddress, 
            "DefaultPool: Caller is neither the PoolManager nor a Pool");
        _;
    }

    // --- Dependency setters ---

    function setAddresses(
        address _poolManagerAddress,
        address _activePoolAddress,
        address _stabilityPoolAddress
    )
        external
        onlyOwner
    {
        poolManagerAddress = _poolManagerAddress;
        activePoolAddress = _activePoolAddress;
        stabilityPoolAddress = _stabilityPoolAddress;

        emit PoolManagerAddressChanged(poolManagerAddress);
        emit ActivePoolAddressChanged(activePoolAddress);
        emit StabilityPoolAddressChanged(stabilityPoolAddress);

        _renounceOwnership();
    }

    // --- Pool functionality ---

    function () external payable onlyPoolManagerOrPool {
        _fallback();
    }
}
