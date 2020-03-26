import React, { useState, useRef, useEffect } from "react";
import { Text, Flex, Box } from "rimble-ui";

import { Label, StaticCell, EditableCell } from "./EditorCell";

type RowProps = {
  label: string;
  hideLabel?: boolean;
  unit?: string;
};

const Row: React.FC<RowProps> = ({ label, hideLabel, unit, children }) => {
  return (
    <Flex width="450px" alignItems="stretch">
      {!hideLabel && <Label width={unit ? 0.25 : 0.4}>{label}</Label>}
      {unit && (
        <StaticCell bg="#eee" width={0.15} textAlign="center">
          {unit}
        </StaticCell>
      )}
      <Box width={!hideLabel ? 0.6 : 0.85}>{children}</Box>
    </Flex>
  );
};

type StaticAmountsProps = {
  amount: string;
  color?: string;
  pendingAmount?: string;
  pendingColor?: string;
  onClick?: () => void;
  edited?: boolean;
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

export const StaticRow: React.FC<StaticRowProps> = props => {
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

export const EditableRow: React.FC<EditableRowProps> = ({
  label,
  hideLabel,
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
    <Row {...{ label, hideLabel, unit }}>
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
