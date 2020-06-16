import React from "react";
import { Heading, Flex, Card, Link, Box } from "theme-ui";

import { Icon } from "./Icon";

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
      return <Icon name="check-circle" color="success" aria-label="Success" />;
    case "warning":
      return <Icon name="exclamation-triangle" color="warning" aria-label="Warning" />;
    case "danger":
      return <Icon name="exclamation-triangle" color="danger" aria-label="Danger" />;
    case "info":
      return <Icon name="info-circle" color="info" aria-label="Info" />;
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
  <Card sx={{ p: 0, borderRadius: 1 }}>
    {intent ? <Box sx={{ height: "4px", bg: intent, borderRadius: "1rem 1rem 0 0" }} /> : null}
    <Flex
      sx={{
        justifyContent: "space-between",
        alignItems: "center",
        borderBottom: 1,
        borderColor: "muted",
        p: [3, 4],
        pb: 3
      }}
    >
      {icon || iconFromIntent(intent)}
      <Heading as="h1" sx={{ textAlign: "center", fontSize: [2, 3], px: [3, 0] }}>
        {title}
      </Heading>
      <Link onClick={onCancel}>
        <Icon name="times" color="moon-gray" aria-label={cancelLabel || "Cancel"} />
      </Link>
    </Flex>
    {children}
  </Card>
);
