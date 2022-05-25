import React, { ReactElement } from "react";
import { Box, Text } from "theme-ui";
import { Decimal, Percent, LiquityStoreState } from "@fluidity/lib-base";
import { useLiquitySelector } from "@fluidity/lib-react";
import { COIN, GT } from "../strings";
import { BigStatistic } from "./BigStatistic";

// const GitHubCommit: React.FC<{ children?: string }> = ({ children }) =>
//     children?.match(/[0-9a-f]{40}/) ? (
//         <Link href={`https://github.com/goldmandao/fluidity/commit/${children}`}>{children.substr(0, 7)}</Link>
//     ) : (
//             <>unknown</>
//         );

type Stat = {
    name: string,
    tooltip?: string,
    body: ReactElement | string
}

type ProtocolStatsProps = {
    filterStats?: string[];
}

const select = ({
    numberOfTroves,
    price,
    total,
    lusdInStabilityPool,
    borrowingRate,
    redemptionRate,
    totalStakedLQTY,
    accountBalance,
    lusdBalance,
    lqtyBalance
}: LiquityStoreState) => ({
    numberOfTroves,
    price,
    total,
    lusdInStabilityPool,
    borrowingRate,
    redemptionRate,
    totalStakedLQTY,
    accountBalance,
    lusdBalance,
    lqtyBalance
});

const ProtocolStats: React.FC<ProtocolStatsProps> = ({ filterStats }) => {

    const {
        numberOfTroves,
        price,
        lusdInStabilityPool,
        total,
        borrowingRate,
        redemptionRate,
        totalStakedLQTY,
        accountBalance,
        lusdBalance,
        lqtyBalance,
    } = useLiquitySelector(select);

    const lusdInStabilityPoolPct =
        total.debt.nonZero && new Percent(lusdInStabilityPool.div(total.debt));
    const totalCollateralRatioPct = new Percent(total.collateralRatio(price));
    const borrowingFeePct = new Percent(borrowingRate);
    const redemptionFeePct = new Percent(redemptionRate);

    // const showStat = (statSection: string): boolean => {
    //     return filterStats ? filterStats.includes(statSection) : true;
    // }

    const statSelector = (stat: string): Stat => {
        switch (stat) {
            case "borrow-fee":
                return {
                    "name": "Borrowing Fee", 
                    "tooltip": "The Borrowing Fee is a one-off fee charged as a percentage of the borrowed amount (in OUSD) and is part of a Trove's debt. The fee varies between 0.5% and 5% depending on OUSD redemption volumes.",

                    "body": borrowingFeePct.toString(2)
                    }
            case "redeem-fee":
                return {
                    "name": "Redemption fee",
                    "tooltip": "The Redemption Fee is a one-off fee charged as a percentage of the redeemed amount (in AUT). The fee varies from 0.5% depending on OUSD redemption volumes.",
                    "body": redemptionFeePct.toString(2)
                }
            case "tvl":
                return {
                    "name": "TVL",
                    "tooltip": "The Total Value Locked (TVL) is the total value of AUT locked as collateral in the system, given in AUT and USD.",
                    "body": <>{total.collateral.shorten()} <Text sx={{ fontSize: 2 }}>&nbsp;AUT</Text></>
                }
            case "troves":
                return {
                    "name": "Opened Troves",
                    "tooltip": "The total number of active Troves in the system.",
                    "body": Decimal.from(numberOfTroves).prettify(0)
                }
            case "lusd-supply":
                return {
                    "name": "OUSD supply",
                    "tooltip": "The total OUSD minted by the Opal Protocol.",
                    "body": total.debt.shorten()
                }
            case "lusd-sp":
                return {
                    "name": "OUSD in Stability Pool",
                    "tooltip": "The total OUSD currently held in the Stability Pool, expressed as an amount and a fraction of the OUSD supply.",
                    "body": <>{lusdInStabilityPool.shorten()}<Text sx={{ fontSize: 1 }}>&nbsp;({lusdInStabilityPoolPct?.toString(1)})</Text></>
                }
            case "staked-lqty":
                return {
                    "name": "Staked OPAL",
                    "tooltip": "The total amount of OPAL that is staked for earning fee revenue.",
                    "body": totalStakedLQTY.shorten()
                }
            case "tcr":
                return {
                    "name": "TCR",
                    "tooltip": "The ratio of the Dollar value of the entire system collateral at the current AUT:USD price, to the entire system debt.",
                    "body": totalCollateralRatioPct.prettify()
                }
            case "recovery":
                return {
                    "name": "Recovery Mode",
                    "tooltip": "Recovery Mode is activated when the Total Collateral Ratio (TCR) falls below 150%. When active, your Trove can be liquidated if its collateral ratio is below the TCR. The maximum collateral you can lose from liquidation is capped at 110% of your Trove's debt. Operations are also restricted that would negatively impact the TCR.",
                    "body": <>{total.collateralRatioIsBelowCritical(price) ? <Box color="danger">Yes</Box> : "No"}</>
                }
            case "aut-balance":
                return {
                    "name": "AUT",
                    "body": accountBalance.prettify(4)
                    }
            case "lusd-balance":
                return {
                    "name": COIN,
                    "body": lusdBalance.prettify()
                }
            case "lqty-balance":
                return {
                    "name": GT,
                    "body": lqtyBalance.prettify()
                }
            case "aut-price":
                return {
                    "name": "AUT",
                    "body": <>{price.prettify()}<Text sx={{ fontSize: 2 }}>&nbsp;USD</Text></>
                    }
            case "lqty-price":
                return {
                    "name": "OPAL",
                    "body": <>80.0<Text sx={{ fontSize: 2 }}>&nbsp;USD</Text></>
                }
            default:
                return { "name": "Stat", "body": <></> };
        }
    }

    return (
        <>
            {
                filterStats?.map((statFilter) => {
                    const stat = statSelector(statFilter);
                    return (<BigStatistic name={stat.name} tooltip={stat.tooltip}>{stat.body}</BigStatistic>);
                })
            }
        </>
    );
};

type SystemStatsProps = {
    variant?: string;
    showBalances?: boolean;
    showProtocol?: boolean;
    showPriceFeed?: boolean;
    filterStats?: string[];
};

export const TopSystemStats: React.FC<SystemStatsProps> = (
    { filterStats }) => {

    /*
    const {
        liquity: {
            connection: { version: contractsVersion, deploymentDate, frontendTag }
        }
    } = useLiquity();
    */

    const statSections = () => (
        <Box sx={{
            display: "flex",
            flexFlow: "row wrap-reverse",
            justifyContent: "space-between",
            flexGrow: 1,
            gap: 2,
            py: 3,
        }}>
            <ProtocolStats filterStats={filterStats} />
        </Box>
    )

    return (
        <>
            {statSections()}
        </>
    )
}

