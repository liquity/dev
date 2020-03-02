import React from "react";
import { Button, Flex, Box } from "rimble-ui";

import { Trove, Liquity } from "@liquity/lib";
import { useTroveState } from "../hooks/Liquity";

type TroveManagerProps = {
  liquity: Liquity;
};

export const TroveManager: React.FC<TroveManagerProps> = ({ liquity }) => {
  const troveState = useTroveState(liquity);

  if (!troveState?.loaded) {
    return null;
  }

  const trove = troveState.value;

  if (!trove) {
    return (
      <Button onClick={() => liquity.createTrove(new Trove({ collateral: 1, debt: 100 }))}>
        Open a new loan
      </Button>
    );
  }

  return (
    <Box>
      <Flex>
        <Button m={2} width={1 / 2} onClick={() => liquity.depositEther(trove, 1)}>
          Deposit ETH
        </Button>
        <Button m={2} width={1 / 2} onClick={() => liquity.withdrawEther(trove, 1)}>
          Withdraw ETH
        </Button>
      </Flex>
      <Flex>
        <Button m={2} width={1 / 2} onClick={() => liquity.borrowQui(trove, 100)}>
          Borrow QUI
        </Button>
        <Button m={2} width={1 / 2} onClick={() => liquity.repayQui(trove, 100)}>
          Repay QUI
        </Button>
      </Flex>
    </Box>
  );
};
