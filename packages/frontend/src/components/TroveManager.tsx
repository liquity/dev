import React from "react";
import { Button, Flex, Box } from "rimble-ui";

import { Trove, Liquity } from "@liquity/lib";
import { Decimalish } from "@liquity/lib/dist/utils";

type TroveManagerProps = {
  liquity: Liquity;
  trove?: Trove;
  price: Decimalish;
  recoveryModeActive: boolean;
};

export const TroveManager: React.FC<TroveManagerProps> = ({
  liquity,
  trove,
  price,
  recoveryModeActive
}) => {
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
            recoveryModeActive ||
            trove
              .subtractCollateral(1)
              .collateralRatioAfterRewardsAt(price)
              .lt(1.1)
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
            recoveryModeActive ||
            trove
              .addDebt(100)
              .collateralRatioAfterRewardsAt(price)
              .lt(1.1)
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
