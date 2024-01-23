import { memo, useState, useEffect } from "react";
import { Flex, Box, Text, ThemeUIStyleObject } from "theme-ui";
import { CircularProgressbarWithChildren } from "react-circular-progressbar";
import { buildStyles } from "react-circular-progressbar";
import "react-circular-progressbar/dist/styles.css";
import { Icon } from "./Icon";
import type { TransactionState } from "./Transaction";

const strokeWidth = 10;

const circularProgressbarStyle = {
  strokeLinecap: "butt",
  pathColor: "white",
  trailColor: "rgba(255, 255, 255, 0.33)"
};

const slowProgress = {
  strokeWidth,
  styles: buildStyles({
    ...circularProgressbarStyle,
    pathTransitionDuration: 30
  })
};

const fastProgress = {
  strokeWidth,
  styles: buildStyles({
    ...circularProgressbarStyle,
    pathTransitionDuration: 0.75
  })
};

export type TransactionStateType = TransactionState["type"];

const Donut = memo(
  CircularProgressbarWithChildren,
  ({ value: prev }, { value: next }) => prev === next
);

type TransactionProgressDonutProps = {
  state: TransactionStateType;
};

const TransactionProgressDonut: React.FC<TransactionProgressDonutProps> = ({ state }) => {
  const [value, setValue] = useState(0);
  const maxValue = 1;

  useEffect(() => {
    if (state === "confirmed") {
      setTimeout(() => setValue(maxValue), 40);
    } else {
      setTimeout(() => setValue(maxValue * 0.67), 20);
    }
  }, [state]);

  return state === "confirmed" ? (
    <Donut {...{ value, maxValue, ...fastProgress }}>
      <Icon name="check" color="white" size="lg" />
    </Donut>
  ) : state === "failed" || state === "cancelled" ? (
    <Donut value={0} {...{ maxValue, ...fastProgress }}>
      <Icon name="times" color="white" size="lg" />
    </Donut>
  ) : (
    <Donut {...{ value, maxValue, ...slowProgress }}>
      <Icon name="cog" color="white" size="lg" spin />
    </Donut>
  );
};

type TransactionStatusProps = {
  state: TransactionStateType;
  message?: string;
  style?: ThemeUIStyleObject;
};

export const TransactionStatus: React.FC<TransactionStatusProps> = ({ state, message, style }) => {
  if (state === "idle" || state === "waitingForApproval") {
    return null;
  }

  return (
    <Flex
      sx={{
        alignItems: "center",
        bg:
          state === "confirmed"
            ? "success"
            : state === "cancelled"
            ? "warning"
            : state === "failed"
            ? "danger"
            : "primary",
        p: 3,
        pl: 4,
        position: "fixed",
        width: "100vw",
        bottom: 0,
        overflow: "hidden",
        ...style
      }}
    >
      <Box sx={{ mr: 3, width: "40px", height: "40px" }}>
        <TransactionProgressDonut state={state} />
      </Box>

      <Text sx={{ fontSize: 3, color: "white" }}>
        {state === "waitingForConfirmation"
          ? "Waiting for confirmation"
          : state === "cancelled"
          ? "Cancelled"
          : state === "failed"
          ? message || "Transaction failed. Please try again."
          : "Confirmed"}
      </Text>
    </Flex>
  );
};
