import React from "react";
import { Button, Flex, Box } from "rimble-ui";

import { Trove, Liquity, Pool } from "@liquity/lib";
import { Decimalish } from "@liquity/lib/dist/utils";

type TroveManagerProps = {
  liquity: Liquity;
  trove?: Trove;
  price: Decimalish;
  pool: Pool;
};

export const TroveManager: React.FC<TroveManagerProps> = ({ liquity, trove, price, pool }) => {
  if (!trove) {
    return (
      <Button onClick={() => liquity.createTrove(new Trove({ collateral: 1, debt: 100 }), price)}>
        Open a new loan
      </Button>
    );
  }

  return (
    <Box>
      <Flex>
        <Button m={2} width={1 / 2} onClick={() => liquity.depositEther(trove, 1, price)}>
          Deposit ETH
        </Button>
        <Button
          m={2}
          width={1 / 2}
          onClick={() => liquity.withdrawEther(trove, 1, price)}
          disabled={
            pool.isRecoveryModeActiveAt(price) ||
            trove.subtractCollateral(1).isBelowMinimumCollateralRatioAt(price)
          }
        >
          Withdraw ETH
        </Button>
      </Flex>
      <Flex>
        <Button
          m={2}
          width={1 / 2}
          onClick={() => liquity.borrowQui(trove, 100, price)}
          disabled={
            pool.isRecoveryModeActiveAt(price) ||
            trove.addDebt(100).isBelowMinimumCollateralRatioAt(price)
          }
        >
          Borrow QUI
        </Button>
        <Button m={2} width={1 / 2} onClick={() => liquity.repayQui(trove, 100, price)}>
          Repay QUI
        </Button>
      </Flex>
    </Box>
  );
};
