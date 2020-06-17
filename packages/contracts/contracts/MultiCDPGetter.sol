pragma solidity ^0.5.16;
pragma experimental ABIEncoderV2;

import "./CDPManager.sol";
import "./SortedCDPs.sol";

contract MultiCDPGetter {
    struct CombinedCDPData {
        address owner;

        uint debt;
        uint coll;
        uint stake;

        uint snapshotETH;
        uint snapshotCLVDebt;
    }

    CDPManager cdpManager; // XXX CDPs missing from ICDPManager?
    ISortedCDPs sortedCDPs;

    constructor(CDPManager _cdpManager, ISortedCDPs _sortedCDPs) public {
        cdpManager = _cdpManager;
        sortedCDPs = _sortedCDPs;
    }

    function _min(uint a, uint b) internal pure returns (uint) {
        return a < b ? a : b;
    }

    function getMultipleSortedCDPs(int _startIdx, uint _count)
        external view returns (CombinedCDPData[] memory _cdps)
    {
        uint startIdx;
        bool descend;

        if (_startIdx >= 0) {
            startIdx = uint(_startIdx);
            descend = true;
        } else {
            startIdx = uint(-(_startIdx + 1));
            descend = false;
        }

        uint sortedCDPsSize = sortedCDPs.getSize();

        if (startIdx >= sortedCDPsSize) {
            _cdps = new CombinedCDPData[](0);
        } else {
            uint maxCount = sortedCDPsSize - startIdx;

            if (_count > maxCount) {
                _count = maxCount;
            }

            if (descend) {
                _cdps = _getMultipleSortedCDPsFromHead(startIdx, _count);
            } else {
                _cdps = _getMultipleSortedCDPsFromTail(startIdx, _count);
            }
        }
    }

    function _getMultipleSortedCDPsFromHead(uint _startIdx, uint _count)
        internal view returns (CombinedCDPData[] memory _cdps)
    {
        address currentCDPowner = sortedCDPs.getFirst();

        for (uint idx = 0; idx < _startIdx; ++idx) {
            currentCDPowner = sortedCDPs.getNext(currentCDPowner);
        }

        _cdps = new CombinedCDPData[](_count);

        for (uint idx = 0; idx < _count; ++idx) {
            _cdps[idx].owner = currentCDPowner;
            (
                _cdps[idx].debt,
                _cdps[idx].coll,
                _cdps[idx].stake,
                /* status */,
                /* arrayIndex */
            ) = cdpManager.CDPs(currentCDPowner);
            (
                _cdps[idx].snapshotETH,
                _cdps[idx].snapshotCLVDebt
            ) = cdpManager.rewardSnapshots(currentCDPowner);

            currentCDPowner = sortedCDPs.getNext(currentCDPowner);
        }
    }

    function _getMultipleSortedCDPsFromTail(uint _startIdx, uint _count)
        internal view returns (CombinedCDPData[] memory _cdps)
    {
        address currentCDPowner = sortedCDPs.getLast();

        for (uint idx = 0; idx < _startIdx; ++idx) {
            currentCDPowner = sortedCDPs.getPrev(currentCDPowner);
        }

        _cdps = new CombinedCDPData[](_count);

        for (uint idx = 0; idx < _count; ++idx) {
            _cdps[idx].owner = currentCDPowner;
            (
                _cdps[idx].debt,
                _cdps[idx].coll,
                _cdps[idx].stake,
                /* status */,
                /* arrayIndex */
            ) = cdpManager.CDPs(currentCDPowner);
            (
                _cdps[idx].snapshotETH,
                _cdps[idx].snapshotCLVDebt
            ) = cdpManager.rewardSnapshots(currentCDPowner);

            currentCDPowner = sortedCDPs.getPrev(currentCDPowner);
        }
    }
}
