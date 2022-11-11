import { Box, Card, Flex } from "theme-ui";
import { InfoIcon } from "../../../InfoIcon";
import { StaticRow } from "../../../Trove/Editor";
import { useBondView } from "../../context/BondViewContext";

export const PendingRewards: React.FC = () => {
  const { lpRewards } = useBondView();

  return (
    <>
      <Box as="summary" sx={{ cursor: "pointer", mt: 1, mb: 2, ml: 3 }}>
        Rewards
      </Box>

      <Flex>
        {lpRewards?.map(reward => {
          return (
            <StaticRow
              amount={reward.amount.shorten()}
              label={
                <Flex>
                  {reward.name}
                  <InfoIcon
                    placement="right"
                    size="xs"
                    tooltip={<Card variant="tooltip">Reward token address: {reward.address}</Card>}
                  />
                </Flex>
              }
            />
          );
        })}
        {(lpRewards === undefined || lpRewards?.length === 0) && (
          <Flex>You have no pending rewards</Flex>
        )}
      </Flex>
    </>
  );
};
