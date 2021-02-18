# Slither custom scripts provided by Trail of Bits after their audit

We will use Trail of Bits docker image, so in case you don’t have it already downloaded to your local images, run:

```
docker pull trailofbits/eth-security-toolbox
```

## Find paths callable by external actors that lead to the system receiving or sending Ether

Trail of Bits used Slither, a Solidity static analysis framework, to automatically find and display where Ether is received and sent in the Liquity system. For the cases where Ether is sent, the externally callable paths leading to these were also detected with some limitations. These areas of code are especially sensitive.

Run the script:
```bash
$ docker run -v PATH/TO/liquity/dev/:/share trailofbits/eth-security-toolbox sh -c "cd /share/packages/contracts/ && python3 slitherTests/find_ether_egress_ingress.py"
```
The script takes around one minute to run because Slither takes a while to analyze large projects like Liquity.

Excerpt of output from the script:
```markdown
# ETH Egress

## StabilityPool._sendETHGainToDepositor(uint256) internal can send ETH

### in externally callable paths

- `StabilityPool.withdrawFromSP(uint256)` *external* -> `StabilityPool._sendETHGainToDepositor(uint256)` *internal*
- `StabilityPool.provideToSP(uint256,address)` *external* -> `StabilityPool._sendETHGainToDepositor(uint256)` *internal*
```

Note that this currently finds some but not all external paths that indirectly can lead to the sending of Ether.
It should find all locations where Ether can be received and sent.

See the script at [slitherTests/find_ether_egress_ingress.py](slitherTests/find_ether_egress_ingress.py).

## Find uses of integers smaller than 256 bits

Trail of Bits used Slither, a Solidity static analysis framework, to automatically find and display uses of integer types smaller than `uint256` and `int256`. Examples of such integers used in the Liquity system are `uint8`, `uint80`, and `uint128`.

Run the script:
```bash
$ docker run -v PATH/TO/liquity/dev/:/share trailofbits/eth-security-toolbox sh -c "cd /share/packages/contracts/ && python3 slitherTests/find_small_ints.py"
```
The script takes around one minute to run because Slither takes a while to analyze large projects like Liquity.

Excerpt of output from the script:
```markdown
- PriceFeed
  - getPrice() public
    - [ ]   40: produces uint80: priceAggregator.latestRoundData()
    - [ ]   45: produces uint8: priceAggregator.decimals()
    - [ ]   49: reads uint8: answerDigits > TARGET_DIGITS
h        - NOTE: TARGET_DIGITS could have type u8
    - [ ]   50: reads uint8 and produces uint8: answerDigits - TARGET_DIGITS
    - [ ]   52: reads uint8: answerDigits < TARGET_DIGITS
    - [ ]   53: reads uint8: TARGET_DIGITS - answerDigits
```

Note that this produces finds false positives where small integers are used indirectly.
It should not produce false negatives.

See the script at [slitherTests/find_small_ints.py](slitherTests/find_small_ints.py).

