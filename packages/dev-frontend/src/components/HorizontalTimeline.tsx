import React from "react";
import { Flex, Box, Text, Card } from "theme-ui";
import type { ThemeUIStyleObject } from "theme-ui";
import { InfoIcon } from "./InfoIcon";
import { dateWithoutHours } from "./Bonds/utils";
import { Placeholder } from "./Placeholder";

const defaultCircleStyle = {
  height: 12,
  width: 12,
  borderRadius: "50%",
  border: "2px solid gray",
  background: "none",
  opacity: 0.3
};
const hollowCircleStyle = {
  opacity: 1
};
const solidCircleStyle = {
  backgroundColor: "gray",
  opacity: 1
};
const defaultLineStyle = {
  height: 4,
  flexGrow: 1,
  border: 0,
  backgroundColor: "gray",
  opacity: 0.3,
  margin: 0,
  padding: 0
};

const solidLineStyle = {
  backgroundColor: "gray",
  opacity: 1
};

const fadeLineStyle = (direction: "to left" | "to right") => ({
  background: `linear-gradient(${direction}, white, gray)`
});

type CircleProps = {
  style?: ThemeUIStyleObject;
};

const Circle: React.FC<CircleProps> = ({ style }) => {
  return <Box sx={{ ...defaultCircleStyle, ...style }} />;
};

type LineProps = {
  style?: ThemeUIStyleObject;
};

const Line: React.FC<LineProps> = ({ style }) => {
  return <Box sx={{ ...defaultLineStyle, ...style }} />;
};

// Use the maximum possible date to represent unknown
export const UNKNOWN_DATE = new Date(8640000000000000);

export type EventType = {
  date: Date;
  label: React.ReactNode;
  isSelected?: boolean;
  isLoading?: boolean;
};

type EventProps = EventType & {
  isFirst: boolean;
  isLast: boolean;
  selectedIdx: number;
  idx: number;
  isLoading?: boolean;
};

type LabelProps = {
  subLabel?: React.ReactNode;
  description?: React.ReactNode;
  style?: ThemeUIStyleObject;
};

type SubLabelProps = { style?: ThemeUIStyleObject };
export const SubLabel: React.FC<SubLabelProps> = ({ style, children }) => (
  <Flex
    sx={{
      fontWeight: 200,
      fontSize: "0.98em",
      alignSelf: "center",
      justifyContent: "center",
      flexGrow: 1,
      ...style
    }}
  >
    {children}
  </Flex>
);

export const Label: React.FC<LabelProps> = ({ children, description, style }) => {
  return (
    <Flex
      sx={{
        fontWeight: 300,
        alignSelf: "center",
        alignContent: "center",
        alignItems: "center",
        ...style
      }}
    >
      {children}
      &nbsp;
      {description ? (
        <InfoIcon
          size="xs"
          tooltip={
            <Card variant="tooltip" sx={{ width: "200px" }}>
              {description}
            </Card>
          }
        />
      ) : null}
    </Flex>
  );
};

const LoadingEvent: React.FC<{ label: React.ReactNode }> = ({ label }) => {
  return (
    <Flex sx={{ flexDirection: "column", flexGrow: 1 }}>
      <Flex sx={{ justifyContent: "center" }}>
        <Placeholder style={{ mx: "20%" }} />
      </Flex>
      <Flex sx={{ my: 1, alignItems: "center" }}>
        <Line style={defaultLineStyle} />
        <Circle style={defaultCircleStyle} />
        <Line style={defaultLineStyle} />
      </Flex>

      <Flex sx={{ flexDirection: "column" }}>{label}</Flex>
    </Flex>
  );
};
const Event: React.FC<EventProps> = ({
  isFirst,
  isLast,
  date,
  label,
  idx,
  selectedIdx,
  isLoading = false
}) => {
  if (isLoading) return <LoadingEvent label={label} />;
  const isPast = new Date(date.toDateString()) < dateWithoutHours(Date.now());
  const isToday = date.toLocaleDateString() === new Date(Date.now()).toLocaleDateString();
  const isSelected = idx === selectedIdx;
  const isBeforeSelected = idx < selectedIdx;
  const isUnknownDate = date.toDateString() === UNKNOWN_DATE.toDateString();

  let circleStyle: ThemeUIStyleObject = { ...defaultCircleStyle };
  let leftLineStyle: ThemeUIStyleObject = { ...defaultLineStyle };
  let rightLineStyle: ThemeUIStyleObject = { ...defaultLineStyle };

  if (isPast) {
    circleStyle = { ...hollowCircleStyle };
    leftLineStyle = { ...solidLineStyle };
    rightLineStyle = { ...solidLineStyle };
  }

  if (isSelected) {
    leftLineStyle = { ...solidLineStyle };
    circleStyle = { ...solidCircleStyle };
    rightLineStyle = { ...defaultLineStyle };
  }

  if (isFirst) {
    leftLineStyle = { ...leftLineStyle, ...fadeLineStyle("to right") };
  }

  if (isToday && isBeforeSelected) {
    leftLineStyle = { ...solidLineStyle };
    circleStyle = { ...hollowCircleStyle };
    rightLineStyle = { ...solidLineStyle };
  }

  if (isLast) {
    rightLineStyle = { ...rightLineStyle, ...fadeLineStyle("to left") };
  }

  const dateText =
    isToday && isSelected
      ? "Now"
      : isUnknownDate
      ? "Unknown"
      : date.toLocaleDateString("en-GB", { month: "short", day: "2-digit", year: "numeric" });

  return (
    <Flex sx={{ flexDirection: "column", flexGrow: 1 }}>
      <Flex sx={{ justifyContent: "center" }}>
        <Text sx={{ fontWeight: 400, alignSelf: "center" }}>{dateText}</Text>
      </Flex>
      <Flex sx={{ my: 1, alignItems: "center" }}>
        <Line style={leftLineStyle} />
        <Circle style={circleStyle} />
        <Line style={rightLineStyle} />
      </Flex>

      <Flex sx={{ flexDirection: "column" }}>{label}</Flex>
    </Flex>
  );
};

type HorizontalTimelineProps = {
  events: EventType[];
  style?: ThemeUIStyleObject;
};

export const HorizontalTimeline: React.FC<HorizontalTimelineProps> = ({ events, style }) => {
  // Order by date, then by whether its selected or not (selected is newer)
  const orderedEvents = [...events].sort((a, b) =>
    a.date.getTime() === b.date.getTime()
      ? Number(a.isSelected) - Number(b.isSelected)
      : a.date.getTime() > b.date.getTime()
      ? 1
      : -1
  );
  const selectedIdx = orderedEvents.findIndex(event => event.isSelected);

  return (
    <Flex sx={{ flexGrow: 1, ...style }}>
      {orderedEvents.map((event, idx) => (
        <Event
          key={idx}
          idx={idx}
          isFirst={idx === 0}
          isLast={idx === orderedEvents.length - 1}
          date={event.date}
          label={event.label}
          selectedIdx={selectedIdx}
          isLoading={event.isLoading}
        />
      ))}
    </Flex>
  );
};
