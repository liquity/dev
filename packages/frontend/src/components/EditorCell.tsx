//import React from "react";
import styled, { css } from "styled-components";
import { theme } from "rimble-ui";
import {
  compose,
  color,
  ColorProps,
  space,
  SpaceProps,
  layout,
  LayoutProps,
  position,
  PositionProps,
  flexbox,
  FlexboxProps,
  border,
  BorderProps,
  typography,
  TypographyProps,
  shadow,
  ShadowProps
} from "styled-system";

const styleProps = compose(color, space, layout, position, flexbox, border, typography, shadow);

type EditorCellProps = ColorProps &
  SpaceProps &
  LayoutProps &
  PositionProps &
  FlexboxProps &
  BorderProps &
  TypographyProps &
  ShadowProps;

export const Label = styled.div<EditorCellProps>`
  box-sizing: border-box;
  ${styleProps}
`;

export const StaticCell = styled.div<EditorCellProps & { invalid?: boolean }>`
  box-sizing: border-box;
  ${styleProps}
  ${props =>
    props.invalid &&
    css`
      background-color: pink;
    `}
`;

export const EditableCell = styled.input<EditorCellProps & { invalid?: boolean }>`
  box-sizing: border-box;
  ${styleProps}
  ${props =>
    props.invalid &&
    css`
      background-color: pink;
    `}
`;

(() => {
  const position = "relative";
  const p = 2;
  const fontSize = 4;
  const lineHeight = "copy";
  const bg = "white";
  const border = 1;
  const borderColor = "light-gray";
  const boxShadow = 2;

  Label.defaultProps = {
    theme,

    p,
    position,
    fontSize,
    lineHeight
  };

  StaticCell.defaultProps = {
    theme,

    p,
    position,
    fontSize,
    lineHeight,

    bg,
    border,
    borderColor,
    boxShadow,

    height: "100%"
  };

  EditableCell.defaultProps = {
    theme,

    p,
    position,
    fontSize,
    lineHeight,

    bg,
    border,
    borderColor,
    boxShadow,

    width: "100%"
  };
})();
