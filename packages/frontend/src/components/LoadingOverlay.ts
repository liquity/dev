import styled from "styled-components";
import { space, SpaceProps } from "styled-system";

export const LoadingOverlay = styled.div<SpaceProps>`
  ${space}

  position: absolute;
  width: 100%;
  height: 100%;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 2;

  background-color: rgba(255, 255, 255, 0.5);

  display: flex;
  justify-content: end;
  align-items: start;
`;

LoadingOverlay.defaultProps = { p: 3 };
