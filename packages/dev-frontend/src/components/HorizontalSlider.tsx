import { Flex, Card, Text, Slider as ThemeUiSlider, Button } from "theme-ui";
import { Decimal } from "@liquity/lib-base";
import { toFloat } from "./Bonds/utils";
import { InfoIcon } from "./InfoIcon";

type SliderProps = {
  name: string;
  description: string;
  value: Decimal;
  type: string;
  min: string;
  max: string;
  step?: number;
  onSliderChange: (value: Decimal) => void;
  onReset?: () => void;
};

export const HorizontalSlider: React.FC<SliderProps> = ({
  name,
  description,
  value,
  type,
  min,
  max,
  step = 0.01,
  onSliderChange,
  onReset
}) => {
  return (
    <Flex mb={2} sx={{ flexDirection: "column" }}>
      <Flex
        as="h4"
        sx={{
          fontWeight: "300",
          alignItems: "center",
          justifyContent: "center"
        }}
      >
        {onReset && (
          <Button
            variant="icon"
            sx={{
              position: "absolute",
              left: "66%",
              mt: "6px",
              fontSize: 1
            }}
            onClick={onReset}
          >
            Reset
          </Button>
        )}
        {name}
        <InfoIcon size="xs" tooltip={<Card variant="tooltip">{description}</Card>} />
      </Flex>

      <Flex sx={{ flexGrow: 1, alignItems: "center" }}>
        <Text mr={2} sx={{ fontSize: 1 }}>
          {min}
        </Text>
        <ThemeUiSlider
          value={toFloat(value)}
          min={min}
          max={max}
          step={step}
          onChange={e => onSliderChange(Decimal.from(e.target.value))}
        ></ThemeUiSlider>
        <Text ml={2} sx={{ fontSize: 1 }}>
          {max}
        </Text>
      </Flex>
      <Flex sx={{ fontWeight: "400", justifyContent: "center", alignItems: "center" }}>
        <Text>
          {value.prettify(2)} {type}
        </Text>
      </Flex>
    </Flex>
  );
};
