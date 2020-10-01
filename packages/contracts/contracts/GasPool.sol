pragma solidity 0.5.16;

import "./Dependencies/IERC20.sol";
import "./Dependencies/Ownable.sol";


// TODO:
contract GasPool is Ownable {
    address public poolManagerAddress;
    IERC20 CLV;

    // --- Events ---

    event PoolManagerAddressChanged(address _poolManagerAddress);
    event CLVTokenAddressChanged(address _CLVAddress);

    // --- Modifiers ---

    modifier onlyPoolManager {
        require(_msgSender() == poolManagerAddress, "Pool: Caller is not the PoolManager");
        _;
    }

    // --- Contract setters ---

    function setAddresses(
        address _poolManagerAddress,
        IERC20 _CLV
    )
    external
    onlyOwner
    {
        poolManagerAddress = _poolManagerAddress;
        CLV = _CLV;

        emit PoolManagerAddressChanged(_poolManagerAddress);
        emit CLVTokenAddressChanged(address(_CLV));

        _renounceOwnership();
    }
}
