// SPDX-License-Identifier: GPL-3.0-or-later
// From: https://github.com/dapphub/ds-auth/blob/8035510b0bdfe90de9e29cac2c538f5ce0d89aea/src/auth.sol

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

interface DSAuthority {
    function canCall(address src, address dst, bytes4 sig) external view returns (bool);
}


interface IDSAuth {
    function authority() external view returns(DSAuthority);

    function owner() external view returns(address);

    function setOwner(address owner_) external;

    function setAuthority(DSAuthority authority_) external;
}
