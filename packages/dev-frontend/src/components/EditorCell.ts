import styled, { css } from "styled-components";
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

import theme from "../theme";

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
  ${props =>
    props.onClick &&
    css`
      cursor: text;
    `}
`;

export const EditableCell = styled.input<EditorCellProps & { invalid?: boolean }>`
  box-sizing: border-box;
  ${styleProps}
  ${({ invalid }) =>
    invalid &&
    css`
      background-color: pink;
    `}
`;

(() => {
  const position = "relative";
  const p = 2;
  const fontSize = 3;
  const lineHeight = "copy";
  const bg = "white";
  const border = 1;
  const borderColor = "muted";
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
    boxShadow
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
    boxShadow
  };
})();
