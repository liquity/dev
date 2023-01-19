import Tippy from "@tippyjs/react";
import type { TippyProps } from "@tippyjs/react";
import React from "react";
import { Box, Card, Link } from "theme-ui";
import { Icon } from "./Icon";

export type TooltipProps = Pick<TippyProps, "placement"> & {
  message: React.ReactNode;
  link?: string;
};

export type LearnMoreLinkProps = Pick<TooltipProps, "link">;

export const LearnMoreLink: React.FC<LearnMoreLinkProps> = ({ link }) => {
  return (
    <Link href={link} target="_blank">
      Learn more <Icon size="xs" name="external-link-alt" />
    </Link>
  );
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
              <LearnMoreLink link={link} />
            </Box>
          )}
        </Card>
      }
    >
      <span>{children}</span>
    </Tippy>
  );
};
