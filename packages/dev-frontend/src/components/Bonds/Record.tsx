import { ThemeUIStyleObject, Flex, Card, Text } from "theme-ui";
import { InfoIcon } from "../InfoIcon";
import { Placeholder } from "../Placeholder";

type RecordType = {
  name: string;
  description: string;
  value?: string;
  type: string;
  style?: ThemeUIStyleObject;
};

export const Record: React.FC<RecordType> = ({ name, description, value, type, style }) => {
  return (
    <Flex sx={{ flexDirection: "column", ...style }}>
      <Flex as="h4" sx={{ fontWeight: "300", alignItems: "baseline", justifyContent: "center" }}>
        {name} <InfoIcon size="xs" tooltip={<Card variant="tooltip">{description}</Card>} />
      </Flex>
      <Text as="h3" sx={{ display: "flex", justifyContent: "center" }}>
        {value ? (
          <Text sx={{ fontWeight: "400" }}>{value}</Text>
        ) : (
          <Placeholder style={{ mx: "20%" }} />
        )}
        &nbsp;
        {value && <Text sx={{ fontWeight: "light", opacity: 0.8 }}>{type}</Text>}
      </Text>
    </Flex>
  );
};
