// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;
pragma experimental ABIEncoderV2;

import "./TroveManager.sol";
import "./SortedCDPs.sol";

/*  Helper contract for grabbing CDP data for the front end. Not part of the core Liquity system. */
contract MultiCDPGetter {
    struct CombinedCDPData {
        address owner;

        uint debt;
        uint coll;
        uint stake;

        uint snapshotETH;
        uint snapshotCLVDebt;
    }

    TroveManager public cdpManager; // XXX CDPs missing from ITroveManager?
    ISortedCDPs public sortedCDPs;

    constructor(TroveManager _cdpManager, ISortedCDPs _sortedCDPs) public {
        cdpManager = _cdpManager;
        sortedCDPs = _sortedCDPs;
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
