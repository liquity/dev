import React from "react";
import { Heading, Flex, Card, Link, Icon, Box } from "rimble-ui";
import {} from "rimble-ui";

type DialogIntent = "success" | "warning" | "danger" | "info";

type DialogProps = {
  intent?: DialogIntent;
  title: string;
  icon?: React.ReactNode;
  cancelLabel?: string;
  onCancel: () => void;
};

const iconFromIntent = (intent: DialogIntent | undefined) => {
  switch (intent) {
    case "success":
      return <Icon name="Success" color="success" aria-label="Success" />;
    case "warning":
      return <Icon name="Warning" color="warning" aria-label="Warning" />;
    case "danger":
      return <Icon name="Danger" color="danger" aria-label="Danger" />;
    case "info":
      return <Icon name="Info" color="info" aria-label="Info" />;
  }
  return null;
};

export const Dialog: React.FC<DialogProps> = ({
  intent,
  title,
  icon,
  cancelLabel,
  onCancel,
  children
}) => (
  <Card p={0} borderRadius={1}>
    {intent ? <Box height="4px" bg={intent} borderRadius={["1rem 1rem 0 0"]} /> : null}
    <Flex
      justifyContent="space-between"
      alignItems="center"
      borderBottom={1}
      borderColor="near-white"
      p={[3, 4]}
      pb={3}
    >
      {icon || iconFromIntent(intent)}
      <Heading textAlign="center" as="h1" fontSize={[2, 3]} px={[3, 0]}>
        {title}
      </Heading>
      <Link onClick={onCancel}>
        <Icon name="Close" color="moon-gray" aria-label={cancelLabel || "Cancel"} />
      </Link>
    </Flex>
    {children}
  </Card>
);
