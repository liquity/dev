import React from "react";
import { Box, SxProps, Label as ThemeUILabel, LabelProps, Flex, Input } from "theme-ui";

import { partition, isElement } from "../utils/children";

export const Label: React.FC<React.PropsWithoutRef<LabelProps> & SxProps> = ({
  sx,
  children,
  ...labelProps
}) => (
  <ThemeUILabel {...labelProps} sx={{ ml: 1, ...sx }}>
    {children}
  </ThemeUILabel>
);

type UnitProps = SxProps & {
  id?: string;
};

export const Unit: React.FC<UnitProps> = ({ id, sx, children }) => (
  <Flex variant="forms.unit" {...{ id, sx }}>
    {children}
  </Flex>
);

type FieldProps = SxProps & {
  id: string;
};

export const Field: React.FC<FieldProps> = ({ id, sx, children }) => {
  const arrayOfChildren = React.Children.toArray(children);
  const [[label, ...extraLabels], restOfChildren] = partition(arrayOfChildren, isElement(Label));
  const unit = restOfChildren.find(isElement(Unit));
  const unitId = unit && (unit.props.id ?? `${id}-unit`);

  if (!label) {
    throw new Error("<Field> must have a <Label> child");
  }

  if (extraLabels.length > 0) {
    throw new Error("<Field> mustn't have more than one <Label>");
  }

  return (
    <Box {...{ sx }}>
      {React.cloneElement(label, { htmlFor: id })}

      <Flex>
        {restOfChildren.map(child =>
          isElement(Input)(child)
            ? React.cloneElement(child, { id, "aria-describedby": unitId })
            : isElement(Unit)(child)
            ? React.cloneElement(child, { id: unitId })
            : child
        )}
      </Flex>
    </Box>
  );
};
