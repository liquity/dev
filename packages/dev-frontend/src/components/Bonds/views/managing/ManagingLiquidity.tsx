import React, { useState } from "react";
import { Close, Flex, Heading, NavLink, NavLinkProps } from "theme-ui";
import { ReactModal } from "../../../ReactModal";
import { useBondView } from "../../context/BondViewContext";
import { DepositPane } from "./DepositPane";
import { WithdrawPane } from "./WithdrawPane";

interface LinkProps extends NavLinkProps {
  active?: boolean;
}

const Link: React.FC<LinkProps> = ({ active, children, ...props }) => (
  <NavLink {...props} sx={{ cursor: "pointer", ...(active ? { color: "primary" } : {}) }}>
    {children}
  </NavLink>
);

export const ManagingLiquidity: React.FC = () => {
  const { dispatchEvent } = useBondView();
  const [selectedPane, setSelectedPane] = useState<"deposit" | "withdraw">("deposit");

  const handleDismiss = () => {
    dispatchEvent("ABORT_PRESSED");
  };

  return (
    <ReactModal onDismiss={handleDismiss}>
      <Heading as="h2" sx={{ pt: 2, pb: 3, px: 2 }}>
        <Flex sx={{ justifyContent: "center" }}>Manage liquidity</Flex>
        <Close
          onClick={handleDismiss}
          sx={{
            position: "absolute",
            right: "24px",
            top: "24px"
          }}
        />
      </Heading>

      <Flex as="nav" sx={{ mb: 3 }}>
        <Link active={selectedPane === "deposit"} onClick={() => setSelectedPane("deposit")}>
          Deposit
        </Link>

        <Link active={selectedPane === "withdraw"} onClick={() => setSelectedPane("withdraw")}>
          Withdraw
        </Link>
      </Flex>

      {selectedPane === "deposit" ? <DepositPane /> : <WithdrawPane />}
    </ReactModal>
  );
};
