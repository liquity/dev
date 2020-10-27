pragma solidity 0.5.16;


contract Destructible {
    function () external payable {}
    function destruct(address payable _receiver) external {
        selfdestruct(_receiver);
    }
}
