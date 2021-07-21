import React, { useCallback, useState, useEffect } from "react";
import { Card, Heading, Box, Flex, Button, Container, Close, Paragraph } from "theme-ui";
import { InfoMessage } from "../InfoMessage";
import { useStabilityView } from "./context/StabilityViewContext";
import { RemainingLQTY } from "./RemainingLQTY";
import { Yield } from "./Yield";
import { LiquityStoreState } from "@liquity/lib-base";
import { useLiquitySelector } from "@liquity/lib-react";
import { useTransactionFunction } from "../Transaction";
import { useLiquity } from "./../../hooks/LiquityContext";

//create your forceUpdate hook
function useForceUpdate(){
  const [value, setValue] = useState(0); // integer state
  return () => setValue(value => value + 1); // update the state to force render
}

const selector = ( {bammAllowance}: any) => ({
  bammAllowance
});

interface BammAllowanceModalProps {
  sendTransaction: any,
  close: any,
}

const BammAllowanceModal: React.FC<BammAllowanceModalProps> = props => {
  return (
    <div style={{
      position: "fixed",
      width: "100%",
      height: "100%",
      top: 0,
      left: 0,
      backgroundColor: "rgba(0, 0, 0, 0.7)",
      zIndex: 2,
      overflow: "hidden",
    }}>
      <Flex sx={{ width: "100%", height: "100%", justifyContent: "center", alignItems: "center" }}>
          <Card sx={{ width: "33%", minWidth: "300px", height: "300px"}}>
          <Heading>
            Unlock BAMM
          <Flex sx={{ justifyContent: "flex-end" }}>
            <Close sx={{cursor: "pointer"}} onClick={props.close}/>
          </Flex>
          </Heading>
          <Box sx={{ p: [2, 3]}}>
            <Flex sx={{"flexDirection": "column", justifyContent: "space-between", height: "210px"}}>
              <InfoMessage title="You have no allowance.">
                In order to depsoit LUSD to try B.AMM you need to grant allowance
              </InfoMessage>
              <Button onClick={props.sendTransaction}>Unlock BAMM</Button>
            </Flex>
          </Box>
          </Card>
      </Flex>
    </div>
  )
}

export const NoDeposit: React.FC = props => {
  const { liquity } = useLiquity();
  const { bammAllowance } = useLiquitySelector(selector);
  const { dispatchEvent } = useStabilityView();
  const [allowanceSucceed, setAllowanceSucceed] = useState(false);
  const [showModal, setShowModal] = useState(false);

  const handleOpenTrove = useCallback(() => {
    dispatchEvent("DEPOSIT_PRESSED");
  }, [dispatchEvent]);

  const [sendTransaction, transactionState] = useTransactionFunction(
    "bamm-unlock",
    liquity.send.bammUnlock.bind(liquity.send)
  );

  useEffect(() => {
    if (transactionState.type === "waitingForConfirmation") {
      setShowModal(false);
    }
  }, [transactionState.type]);

  const hasAllowance = bammAllowance

  const modalProps = {
    close: ()=> setShowModal(false),
    sendTransaction,
  }
  return (
    <Card>
      <Heading>
        Stability Pool
        <Flex sx={{ justifyContent: "flex-end" }}>
          <RemainingLQTY />
        </Flex>
      </Heading>
      <Box sx={{ p: [2, 3] }}>
        <InfoMessage title="You have no LUSD in the Stability Pool.">
          You can earn ETH and LQTY rewards by depositing LUSD.
        </InfoMessage>

        <Flex variant="layout.actions">
          <Flex sx={{ justifyContent: "flex-start", flex: 1, alignItems: "center" }}>
            <Yield />
          </Flex>

          {hasAllowance  && 
            <Button onClick={handleOpenTrove}>Deposit</Button>
          }
          {!hasAllowance  && 
            <Button onClick={()=>setShowModal(true)}>Deposit</Button>
          }
          {showModal &&
            <BammAllowanceModal {...modalProps}/>
          }
        </Flex>
      </Box>
    </Card>
  );
};
