import React, { useState, useRef, useEffect } from "react";
import { Text, Heading, Flex, Box, Card } from "rimble-ui";

import { Trove } from "@liquity/lib";
import { Decimal, Percent, Difference } from "@liquity/lib/dist/utils";
import { Label, StaticCell, EditableCell } from "./EditorCell";

type RowProps = {
  label: string;
  unit?: string;
};

const Row: React.FC<RowProps> = ({ label, unit, children }) => {
  return (
    <Flex width="500px" alignItems="stretch">
      <Label width={unit ? 0.25 : 0.4}>{label}</Label>
      {unit && (
        <StaticCell bg="#eee" width={0.15}>
          {unit}
        </StaticCell>
      )}
      <Box width={0.6}>{children}</Box>
    </Flex>
  );
};

type StaticAmountsProps = {
  amount: string;
  color?: string;
  pendingAmount?: string;
  pendingColor?: string;
  onClick?: () => void;
  edited: boolean;
  invalid?: boolean;
};

const StaticAmounts: React.FC<StaticAmountsProps> = ({
  amount,
  color,
  pendingAmount,
  pendingColor,
  onClick,
  edited,
  invalid
}) => {
  return (
    <StaticCell {...{ onClick, invalid }}>
      <Flex justifyContent="space-between" alignItems="center">
        <Text fontSize={StaticCell.defaultProps?.fontSize} {...{ color }}>
          {amount}
        </Text>

        <Text fontSize={2} color={pendingColor} opacity={edited ? 1 : 0.5}>
          {pendingAmount &&
            `${pendingAmount
              .replace("++", "▲▲")
              .replace("--", "▼▼")
              .replace("+", "▲ ")
              .replace("-", "▼ ")}`}
        </Text>
      </Flex>
    </StaticCell>
  );
};

type StaticRowProps = RowProps & StaticAmountsProps;

const StaticRow: React.FC<StaticRowProps> = props => {
  return (
    <Row {...props}>
      <StaticAmounts {...props} />
    </Row>
  );
};

type EditableRowProps = Omit<
  StaticRowProps & {
    editingState: [string | undefined, (editing: string | undefined) => void];
    editedAmount: string;
    setEditedAmount: (editedAmount: string) => void;
  },
  "valid"
>;

const EditableRow: React.FC<EditableRowProps> = ({
  label,
  unit,
  amount,
  color,
  pendingAmount,
  pendingColor,
  editingState,
  editedAmount,
  setEditedAmount,
  edited
}) => {
  const [editing, setEditing] = editingState;
  const [invalid, setInvalid] = useState<boolean>(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (editing === label && inputRef.current) {
      inputRef.current.focus();
    }
  }, [editing, label]);

  useEffect(() => {
    setInvalid(false);
  }, [editedAmount]);

  return (
    <Row {...{ label, unit }}>
      {editing === label ? (
        <EditableCell
          ref={inputRef}
          type="number"
          step="any"
          defaultValue={editedAmount}
          {...{ invalid }}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
            try {
              setEditedAmount(e.target.value);
            } catch {
              setInvalid(true);
            }
          }}
          onBlur={() => setEditing(undefined)}
        />
      ) : (
        <StaticAmounts
          {...{ amount, color, pendingAmount, pendingColor, edited, invalid }}
          onClick={() => setEditing(label)}
        />
      )}
    </Row>
  );
};

type TroveEditorProps = {
  originalTrove: Trove;
  editedTrove: Trove;
  setEditedTrove: (trove: Trove | undefined) => void;
  price: Decimal;
};

export const TroveEditor: React.FC<TroveEditorProps> = ({
  originalTrove,
  editedTrove,
  setEditedTrove,
  price
}) => {
  const editingState = useState<string>();

  const pendingCollateralChange = Difference.between(
    editedTrove.collateralAfterReward,
    originalTrove.collateral
  );
  const pendingDebtChange = Difference.between(editedTrove.debtAfterReward, originalTrove.debt);

  const collateralRatioAfterRewards = editedTrove.collateralRatioAfterRewardsAt(price);
  const collateralRatioPctAfterRewards = new Percent(collateralRatioAfterRewards);
  const pendingCollateralRatioChange = Difference.between(
    editedTrove.collateralRatioAfterRewardsAt(price),
    originalTrove.collateralRatioAt(price)
  );
  const pendingCollateralRatioChangePct = new Percent(pendingCollateralRatioChange);

  const edited = originalTrove.whatChanged(editedTrove) !== undefined;

  return (
    <Card p={0}>
      <Heading p={3} bg="lightgrey">
        Your Liquity Trove
      </Heading>

      <Box p={2}>
        <EditableRow
          label="Collateral"
          amount={editedTrove.collateralAfterReward.prettify()}
          pendingAmount={pendingCollateralChange.nonZero?.prettify()}
          pendingColor={pendingCollateralChange.positive ? "success" : "danger"}
          unit="ETH"
          {...{ edited }}
          {...{ editingState }}
          editedAmount={editedTrove.collateralAfterReward.toString(2)}
          setEditedAmount={(editedCollateral: string) =>
            setEditedTrove(editedTrove.setCollateral(editedCollateral))
          }
        ></EditableRow>

        <EditableRow
          label="Debt"
          amount={editedTrove.debtAfterReward.prettify()}
          pendingAmount={pendingDebtChange.nonZero?.prettify()}
          pendingColor={pendingDebtChange.positive ? "danger" : "success"}
          unit="QUI"
          {...{ edited }}
          {...{ editingState }}
          editedAmount={editedTrove.debtAfterReward.toString(2)}
          setEditedAmount={(editedDebt: string) => setEditedTrove(editedTrove.setDebt(editedDebt))}
        />

        <StaticRow
          label="Collateral ratio"
          amount={
            collateralRatioAfterRewards.gt(10)
              ? "× " + collateralRatioAfterRewards.shorten()
              : collateralRatioPctAfterRewards.prettify()
          }
          color={
            collateralRatioAfterRewards.gt(1.5)
              ? "success"
              : collateralRatioAfterRewards.gt(1.1)
              ? "warning"
              : "danger"
          }
          pendingAmount={
            pendingCollateralRatioChange.positive?.absoluteValue?.gt(10)
              ? "++"
              : pendingCollateralRatioChange.negative?.absoluteValue?.gt(10)
              ? "--"
              : pendingCollateralRatioChangePct.nonZero(2)?.prettify()
          }
          pendingColor={pendingCollateralRatioChange.positive ? "success" : "danger"}
          {...{ edited }}
        />
      </Box>
    </Card>
  );
};
