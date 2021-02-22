// SPDX-License-Identifier: GPL-3.0-or-later
// From: https://github.com/dapphub/ds-guard/blob/d0579dcd514404de2308641e3a5c185a0202a8f1/src/guard.sol

// guard.sol -- simple whitelist implementation of DSAuthority

// Copyright (C) 2017  DappHub, LLC

// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.

// You should have received a copy of the GNU General Public License
// along with this program.  If not, see <http://www.gnu.org/licenses/>.

pragma solidity >=0.4.23;


interface IDSGuard {
    function canCall(address src_, address dst_, bytes4 sig) external view returns (bool);

    function permit(bytes32 src, bytes32 dst, bytes32 sig) external;

    function forbid(bytes32 src, bytes32 dst, bytes32 sig) external;

    function permit(address src, address dst, bytes32 sig) external;

    function forbid(address src, address dst, bytes32 sig) external;
}


interface IDSGuardFactory {
    function newGuard() external returns (IDSGuard guard);
}
