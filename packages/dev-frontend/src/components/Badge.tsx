import React from "react";
import { Flex } from "theme-ui";

export const Badge: React.FC = ({ children }) => {
  return <Flex variant="badges.primary">{children}</Flex>;
};
