// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

import "./Interfaces/ICollSurplusPool.sol";
import "./Dependencies/SafeMath.sol";
import "./Dependencies/Ownable.sol";
import "./Dependencies/console.sol";


contract CollSurplusPool is Ownable, ICollSurplusPool {
    using SafeMath for uint256;

    address public borrowerOperationsAddress;
    address public cdpManagerAddress;
    address public activePoolAddress;

    // deposited ether tracker
    uint256 internal ETH;
    // Collateral surplus claimable by trove owners
    mapping (address => uint) internal balances;

    // --- Contract setters ---

    function setAddresses(
        address _borrowerOperationsAddress,
        address _cdpManagerAddress,
        address _activePoolAddress
    )
        external
        override
        onlyOwner
    {
        borrowerOperationsAddress = _borrowerOperationsAddress;
        cdpManagerAddress = _cdpManagerAddress;
        activePoolAddress = _activePoolAddress;

        emit BorrowerOperationsAddressChanged(_borrowerOperationsAddress);
        emit CDPManagerAddressChanged(_cdpManagerAddress);
        emit ActivePoolAddressChanged(_activePoolAddress);

        _renounceOwnership();
    }

    /* Returns the ETH state variable at ActivePool address.
       Not necessarily equal to the raw ether balance - ether can be forcibly sent to contracts. */
    function getETH() external view override returns (uint) {
        return ETH;
    }

    function getCollateral(address _account) external view override returns (uint) {
        return balances[_account];
    }

    // --- Pool functionality ---

    function accountSurplus(address _account, uint _amount) external override {
        _requireCallerIsCDPManager();

        uint newAmount = balances[_account].add(_amount);
        balances[_account] = newAmount;

        emit CollBalanceUpdated(_account, newAmount);
    }

    function claimColl(address _account) external override {
        _claimColl(_account, _account);
    }

    function useCollateralToReopenTrove(address _account) external override returns (uint) {
        return _claimColl(_account, borrowerOperationsAddress);
    }

    function _claimColl(address _account, address _recipient) internal returns (uint) {
        _requireCallerIsBorrowerOperations();

        uint claimableColl = balances[_account];

        if (claimableColl > 0) {
            balances[_account] = 0;
            emit CollBalanceUpdated(_account, 0);
        } else {
            // this will only happen if it’s a regular claim, not if it’s called from openLoan
            require(_account != _recipient, "CollSurplus: No collateral available to claim");
        }

        ETH = ETH.sub(claimableColl);
        emit EtherSent(_recipient, claimableColl);

        (bool success, ) = _recipient.call{ value: claimableColl }("");
        require(success, "CollSurplusPool: sending ETH failed");

        return claimableColl;
    }

    // --- 'require' functions ---

    function _requireCallerIsBorrowerOperations() internal view {
        require(
            msg.sender == borrowerOperationsAddress,
            "CollSurplusPool: Caller is not Borrower Operations");
    }

    function _requireCallerIsCDPManager() internal view {
        require(
            msg.sender == cdpManagerAddress,
            "CollSurplusPool: Caller is not CDPManager");
    }

    function _requireCallerIsActivePool() internal view {
        require(
            msg.sender == activePoolAddress,
            "CollSurplusPool: Caller is not Active Pool");
    }

    // --- Fallback function ---

    receive() external payable {
        _requireCallerIsActivePool();
        ETH = ETH.add(msg.value);
    }
}
