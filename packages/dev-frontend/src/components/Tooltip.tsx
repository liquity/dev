import Tippy from "@tippyjs/react";
import type { TippyProps } from "@tippyjs/react";
import React from "react";
import { Box, Card, Flex, Link } from "theme-ui";
import { Icon } from "./Icon";

export type TooltipProps = Pick<TippyProps, "placement"> & {
  message: React.ReactNode;
  link?: string;
};

export const Tooltip: React.FC<TooltipProps> = ({ children, message, placement = "top", link }) => {
  return (
    <Tippy
      interactive={true}
      placement={placement}
      content={
        <Card variant="tooltip">
          {message}
          {link && (
            <Box mt={1}>
              <Link href={link} target="_blank">
                Learn more <Icon size="xs" name="external-link-alt" />
              </Link>
            </Box>
          )}
        </Card>
      }
    >
      <span>{children}</span>
    </Tippy>
  );
};
