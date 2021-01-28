import React, { useState } from "react";
import { Text, Flex, Label, Input } from "theme-ui";

import { Icon } from "./Icon";

type RowProps = {
  label: string;
  labelFor?: string;
  unit?: string;
};

const Row: React.FC<RowProps> = ({ label, labelFor, unit, children }) => {
  return (
    <Flex sx={{ alignItems: "stretch" }}>
      <Label htmlFor={labelFor} sx={{ width: unit ? "106px" : "170px" }}>
        {label}
      </Label>
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
  inputId: string;
  amount: string;
  color?: string;
  pendingAmount?: string;
  pendingColor?: string;
  onClick?: () => void;
  invalid?: boolean;
};

const StaticAmounts: React.FC<StaticAmountsProps> = ({
  inputId,
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
      id={inputId}
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

        {pendingAmount ? (
          <Text sx={{ fontSize: 2, color: pendingColor }}>
            {pendingAmount === "++" ? (
              <Icon name="angle-double-up" />
            ) : pendingAmount === "--" ? (
              <Icon name="angle-double-down" />
            ) : pendingAmount?.startsWith("+") ? (
              <>
                <Icon name="angle-up" /> {pendingAmount.substr(1)}
              </>
            ) : pendingAmount?.startsWith("-") ? (
              <>
                <Icon name="angle-down" /> {pendingAmount.substr(1)}
              </>
            ) : (
              pendingAmount
            )}
          </Text>
        ) : onClick ? (
          <Text sx={{ display: "flex", alignItems: "center", ml: 1, fontSize: 1 }}>
            <Icon name="pen" />
          </Text>
        ) : undefined}
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
  inputId,
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

  return (
    <Row {...{ label, labelFor: inputId, unit }}>
      {editing === inputId ? (
        <Input
          autoFocus
          sx={invalid ? { backgroundColor: "invalid" } : {}}
          id={inputId}
          type="number"
          step="any"
          defaultValue={editedAmount}
          {...{ invalid }}
          onChange={e => {
            try {
              setEditedAmount(e.target.value);
              setInvalid(false);
            } catch {
              setInvalid(true);
            }
          }}
          onBlur={() => {
            setEditing(undefined);
            setInvalid(false);
          }}
        />
      ) : (
        <StaticAmounts
          {...{ inputId, amount, color, pendingAmount, pendingColor, invalid }}
          onClick={() => setEditing(inputId)}
        />
      )}
    </Row>
  );
};
