import { Flex, Spinner, Heading } from "theme-ui";

export const AppLoader = () => (
  <Flex sx={{ alignItems: "center", justifyContent: "center", height: "100vh" }}>
    <Spinner sx={{ m: 2, color: "text" }} size="32px" />
    <Heading>Loading...</Heading>
  </Flex>
);
