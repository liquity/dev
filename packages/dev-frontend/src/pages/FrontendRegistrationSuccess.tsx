import { Box, Flex, Heading, Paragraph, Button } from "theme-ui";

import { Icon } from "../components/Icon";

type FrontendRegistrationSuccessProps = {
  onDismiss: () => void;
};

export const FrontendRegistrationSuccess: React.FC<FrontendRegistrationSuccessProps> = ({
  onDismiss
}) => (
  <>
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-around",

        m: 3,
        mt: 4,
        mb: 4,
        p: 4,
        maxWidth: "500px",

        bg: "rgba(40, 192, 129, 0.05)",
        color: "success",

        border: 1,
        borderRadius: "8px",
        borderColor: "success",
        boxShadow: 2
      }}
    >
      <Flex sx={{ alignItems: "center", mx: 3, mb: 4, fontSize: 5 }}>
        <Icon name="check" />
        <Heading sx={{ ml: 3, fontSize: 4 }}>Success!</Heading>
      </Flex>

      <Paragraph sx={{ fontSize: 2 }}>Your frontend is now ready to receive LQTY rewards.</Paragraph>
    </Box>

    <Button onClick={onDismiss}>Go to Dashboard</Button>
  </>
);
