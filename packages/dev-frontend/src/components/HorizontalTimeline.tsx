import React from "react";
import { Flex, Box, Text } from "theme-ui";
import type { ThemeUIStyleObject } from "theme-ui";
import { InfoIcon } from "./InfoIcon";
import { Placeholder } from "./Placeholder";

const mutedGray = "#d9d9d9";

const defaultCircleStyle = {
  height: "12px",
  width: "12px",
  mx: "-1px",
  borderRadius: "50%",
  border: "2px solid",
  borderColor: mutedGray,
  background: "none",
  zIndex: 1
};
const solidCircleStyle = {
  backgroundColor: "gray",
  borderColor: "gray"
};
const transparentCircleStyle = {
  width: "0px",
  mx: "-2px",
  opacity: 0
};
const defaultLineStyle = {
  height: 4,
  flexGrow: 1,
  border: 0,
  backgroundColor: mutedGray,
  margin: 0,
  padding: 0
};

const solidLineStyle = {
  backgroundColor: "gray",
  opacity: 1
};

const fadeLineStyle = (leftColor: string, rightColor: string) => ({
  background: `linear-gradient(to right, ${leftColor}, ${rightColor})`
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
  isEndOfLife?: boolean;
  isMilestone?: boolean;
  isLoading?: boolean;
};

type EventProps = EventType & {
  isFirst: boolean;
  isLast: boolean;
  isPast: boolean;
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
      {description ? <InfoIcon size="xs" tooltip={description} /> : null}
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
  isPast,
  date,
  label,
  isEndOfLife,
  isMilestone = true,
  isLoading
}) => {
  if (isLoading) return <LoadingEvent label={label} />;

  const isToday = date.toLocaleDateString() === new Date().toLocaleDateString();
  const isUnknownDate = date.toDateString() === UNKNOWN_DATE.toDateString();

  let circleStyle: ThemeUIStyleObject = { ...defaultCircleStyle };
  let leftLineStyle: ThemeUIStyleObject = { ...defaultLineStyle };
  let rightLineStyle: ThemeUIStyleObject = { ...defaultLineStyle };

  if (isPast || isEndOfLife) {
    circleStyle = { ...solidCircleStyle };
    leftLineStyle = { ...solidLineStyle };
  }

  if (isPast) {
    rightLineStyle = { ...solidLineStyle };
  }

  if (!isMilestone) {
    circleStyle = { ...transparentCircleStyle };
  }

  if (isFirst) {
    leftLineStyle = { ...leftLineStyle, ...fadeLineStyle("white", "gray") };
  }

  if (isLast) {
    rightLineStyle = { ...rightLineStyle, ...fadeLineStyle(mutedGray, "white") };
  }

  const dateText =
    isToday && isEndOfLife
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
      ? Number(a.isEndOfLife) - Number(b.isEndOfLife)
      : a.date.getTime() > b.date.getTime()
      ? 1
      : -1
  );

  const endOfLifeIdx = orderedEvents.findIndex(event => event.isEndOfLife);

  return (
    <Flex sx={{ flexGrow: 1, ...style }}>
      {orderedEvents.map((event, idx) => (
        <Event
          key={idx}
          isFirst={idx === 0}
          isLast={idx === orderedEvents.length - 1}
          isPast={idx < endOfLifeIdx}
          date={event.date}
          label={event.label}
          isEndOfLife={event.isEndOfLife}
          isMilestone={event.isMilestone}
          isLoading={event.isLoading}
        />
      ))}
    </Flex>
  );
};
