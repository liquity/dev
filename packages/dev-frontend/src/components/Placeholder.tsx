import { Flex } from "theme-ui";
import type { ThemeUIStyleObject } from "theme-ui";
import { keyframes } from "@emotion/react";

const loading = keyframes`
  from {
    left: -25%;
  }
  to {
    left: 100%;
  }
`;

type PlaceholderProps = { style?: ThemeUIStyleObject };

export const Placeholder: React.FC<PlaceholderProps> = ({ style }) => {
  return (
    <Flex
      sx={{
        position: "relative",
        backgroundColor: "rgb(225, 230, 230)",
        overflow: "hidden",
        borderRadius: "5px",
        height: "100%",
        width: "100%",
        ...style
      }}
    >
      <Flex
        sx={{
          position: "absolute",
          left: "-25%",
          height: "100%",
          width: "45%",
          backgroundImage:
            "linear-gradient(to left, rgba(251,251,251, .05), rgba(251,251,251, .3), rgba(251,251,251, .6), rgba(251,251,251, .3), rgba(251,251,251, .05))",
          animation: `${loading} 1s infinite`
        }}
      />
      &nbsp;
    </Flex>
  );
};
