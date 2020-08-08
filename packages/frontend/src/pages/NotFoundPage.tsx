import React from "react";
import { Text, Flex } from "theme-ui";
import { useLocation, Redirect, RedirectProps } from "react-router-dom";

import { Icon } from "../components/Icon";

export const NotFoundPage: React.FC = () => {
  const { pathname, search } = useLocation();
  const resource = new URLSearchParams(search).get("resource");

  return (
    <>
      <Flex sx={{ alignItems: "center", fontSize: 5, mt: 9 }}>
        <Icon name="search" />

        <Text sx={{ ml: 5, fontSize: 3, maxWidth: "320px" }}>
          Couldn't find <strong>{resource || pathname}</strong>
        </Text>
      </Flex>
    </>
  );
};

export const NotFoundRedirect: React.FC<RedirectProps> = ({ to, ...redirectProps }) => {
  const { pathname } = useLocation();

  return <Redirect to={`${to}?resource=${pathname}`} {...redirectProps} />;
};
