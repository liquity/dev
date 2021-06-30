// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;

import "./BAMM.sol";

interface PickleJarLike {
    function depositAll() external;
}

contract PBAMM is BAMM {
    PickleJarLike public immutable pickleJar;

    constructor(
        address _priceAggregator,
        address payable _SP,
        address _LUSD,
        address _LQTY,
        uint _maxDiscount,
        address payable _feePool,
        address _frontEndTag,
        address _pLQTY,
        address _pickleJar)
        public
        BAMM(_priceAggregator, _SP, _LUSD, _pLQTY, _maxDiscount, _feePool, _frontEndTag)
    {
        pickleJar = PickleJarLike(_pickleJar);

        require(IERC20(_LQTY).approve(_pickleJar, type(uint).max), "constructor: approve failed");
    }

    // callable by anyone
    function depositLqty() external {
        SP.withdrawFromSP(0);
        pickleJar.depositAll();
    }
    
    function mint(address to, uint value) override internal {
        pickleJar.depositAll();
        super.mint(to, value);
    }

    function burn(address owner, uint value) override internal {        
        pickleJar.depositAll();
        super.burn(owner, value);
    }
}
