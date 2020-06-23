import React, { useState, useRef, useEffect } from "react";
import { Text, Flex, Label, Input } from "theme-ui";

type RowProps = {
  label: string;
  unit?: string;
};

const Row: React.FC<RowProps> = ({ label, unit, children }) => {
  return (
    <Flex sx={{ alignItems: "stretch" }}>
      <Label sx={{ width: unit ? "106px" : "170px" }}>{label}</Label>
      {unit && (
        <Label variant="unit" sx={{ width: "64px", px: 0 }}>
          {unit}
        </Label>
      )}
      {children}
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
    <Label
      variant="input"
      data-testid={label}
      sx={{
        ...(invalid ? { backgroundColor: "invalid" } : {}),
        ...(onClick ? { cursor: "text" } : {})
      }}
      {...{ onClick, invalid }}
    >
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
    </Label>
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

  useEffect(() => {
    setInvalid(false);
  }, [editedAmount]);

  return (
    <Row {...{ label, unit }}>
      {editing === label ? (
        <Input
          autoFocus
          sx={{ ...(invalid ? { backgroundColor: "invalid" } : {}) }}
          data-testid={label}
          type="number"
          step="any"
          defaultValue={editedAmount}
          {...{ invalid }}
          onChange={e => {
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
