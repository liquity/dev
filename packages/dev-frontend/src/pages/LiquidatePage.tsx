import React from "react";
import { Container, Card, Box, Flex, Paragraph } from "theme-ui";
import { SystemStats } from "../components/SystemStats";
import { LiquidationManager } from "../components/LiquidationManager";
import { RiskyTroves } from "../components/RiskyTroves";
import { InfoMessage } from "../components/InfoMessage";

const statsToShow: string[] = ["tvl", "tcr", "lusd-supply", "lusd-sp", "recovery"];

export const LiquidatePage: React.FC = () => (
    <Container variant="columns">
        <Container sx={{
            display: "flex", 
            flexDirection: "column",
            alignItems: "flex-end"
            }}>
            <Flex sx={{ width: ["100%", "50%"] }}>
                <LiquidationManager />
            </Flex>
        </Container>
        <RiskyTroves pageSize={10} />
    </Container>
);
