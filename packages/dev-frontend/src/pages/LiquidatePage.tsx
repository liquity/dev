import React from "react";
import { Container, Flex, } from "theme-ui";
import { LiquidationManager } from "../components/LiquidationManager";
import { RiskyTroves } from "../components/RiskyTroves";
import { TopSystemStats } from "../components/TopSystemStats";

export const LiquidatePage: React.FC = () => (
    <Container variant="columns">
        <TopSystemStats filterStats={["troves", "tcr", "lusd-sp"]} />
        <RiskyTroves pageSize={10} />
        <Container sx={{
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-end"
        }}>
            <Flex sx={{ width: ["100%", "50%"] }}>
                <LiquidationManager />
            </Flex>
        </Container>
    </Container>
);
