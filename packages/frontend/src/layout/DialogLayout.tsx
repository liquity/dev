import React from "react";
import { Flex } from "theme-ui";

import { partition, isElement } from "../utils/children";
import { Nav } from "../components/Nav";
import { DialogNavBar } from "../components/DialogNavBar";
import { Title } from "../components/Title";
import { Main } from "../components/Main";

export const DialogLayout: React.FC = ({ children }) => {
  const arrayOfChildren = React.Children.toArray(children);
  const [[title, ...extraTitles], tmpChildren] = partition(arrayOfChildren, isElement(Title));
  const [[nav, ...extraNavs], restOfChildren] = partition(tmpChildren, isElement(Nav));

  if (extraTitles.length > 0) {
    throw new Error("<DialogLayout> mustn't have more than one <Title>");
  }

  if (extraNavs.length > 0) {
    throw new Error("<DialogLayout> mustn't have more than one <Nav>");
  }

  return (
    <Flex
      variant="styles.dialogBackground"
      sx={{
        flexDirection: "column",

        position: "relative",
        width: "100%",
        minHeight: "100%"
      }}
    >
      {nav && <DialogNavBar {...nav.props} />}

      <Main
        sx={{
          flexGrow: 1,
          position: ["unset", "absolute"],
          top: 9,
          bottom: 9,
          left: 0,
          right: 0,
          minHeight: ["450px", "580px"]
        }}
      >
        {title &&
          React.cloneElement(title, {
            sx: {
              mt: "-3px",
              mb: [0, 8],
              fontSize: ["19px", 4],
              textAlign: ["left", "center"]
            }
          })}

        {restOfChildren}
      </Main>
    </Flex>
  );
};
