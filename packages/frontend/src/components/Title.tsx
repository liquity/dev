import React from "react";
import { Heading, HeadingProps, SxProps } from "theme-ui";

type TitleProps = SxProps & Omit<HeadingProps, "variant">;

export const Title: React.FC<TitleProps> = ({ children, ...headingProps }) => (
  <Heading variant="title" {...headingProps}>
    {children}
  </Heading>
);
