import React, { useState, useRef, useEffect } from "react";
import { Text, Flex, Box } from "theme-ui";

import { Label, StaticCell, EditableCell } from "./EditorCell";

type RowProps = {
  label: string;
  hideLabel?: boolean;
  unit?: string;
};

const Row: React.FC<RowProps> = ({ label, hideLabel, unit, children }) => {
  return (
    <Flex sx={{ width: "450px", alignItems: "stretch" }}>
      {!hideLabel && <Label width={unit ? 0.25 : 0.4}>{label}</Label>}
      {unit && (
        <StaticCell bg="muted" width={0.15} textAlign="center">
          {unit}
        </StaticCell>
      )}
      <Box sx={{ width: !hideLabel ? 0.6 : 0.85 }}>{children}</Box>
    </Flex>
  );
};

type StaticAmountsProps = {
  label?: string;
  amount: string;
  color?: string;
  pendingAmount?: string;
  pendingColor?: string;
  onClick?: () => void;
  invalid?: boolean;
};

const StaticAmounts: React.FC<StaticAmountsProps> = ({
  label,
  amount,
  color,
  pendingAmount,
  pendingColor,
  onClick,
  invalid
}) => {
  return (
    <StaticCell data-testid={label} {...{ onClick, invalid }}>
      <Flex sx={{ justifyContent: "space-between", alignItems: "center" }}>
        <Text sx={{ fontSize: 3 }} {...{ color }}>
          {amount}
        </Text>

        <Text sx={{ fontSize: 2 }} color={pendingColor}>
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
  setEditedAmount
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
          data-testid={label}
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
          {...{ label, amount, color, pendingAmount, pendingColor, invalid }}
          onClick={() => setEditing(label)}
        />
      )}
    </Row>
  );
};
