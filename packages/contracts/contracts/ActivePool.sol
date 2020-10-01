pragma solidity 0.5.16;

import "./Dependencies/Pool.sol";


contract ActivePool is Pool {

    address public stabilityPoolAddress;
    address public defaultPoolAddress;

    // --- Modifiers ---

    modifier onlyPoolManagerOrPool {
        require(
            _msgSender() == poolManagerAddress || 
            _msgSender() == stabilityPoolAddress || 
            _msgSender() == defaultPoolAddress, 
            "ActivePool: Caller is neither the PoolManager nor a Pool");
        _;
    }

    // --- Contract setters ---

    function setAddresses(
        address _poolManagerAddress,
        address _cdpManagerAddress,
        address _defaultPoolAddress,
        address _stabilityPoolAddress
    )
        external
        onlyOwner
    {
        poolManagerAddress = _poolManagerAddress;
        cdpManagerAddress = _cdpManagerAddress;
        defaultPoolAddress = _defaultPoolAddress;
        stabilityPoolAddress = _stabilityPoolAddress;

        emit PoolManagerAddressChanged(_poolManagerAddress);
        emit CDPManagerAddressChanged(_cdpManagerAddress);
        emit DefaultPoolAddressChanged(defaultPoolAddress);
        emit StabilityPoolAddressChanged(stabilityPoolAddress);

        _renounceOwnership();
    }

    // --- Pool functionality ---

    function sendETH(address _account, uint _amount) external onlyPoolManagerOrCDPManager {
        _sendETH(_account, _amount);
    }

    function () external payable onlyPoolManagerOrPool {
        require(msg.data.length == 0);
        ETH = ETH.add(msg.value);
    }
}
