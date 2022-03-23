import React from "react";
import { Container, Flex, } from "theme-ui";
import { LiquidationManager } from "../components/LiquidationManager";
import { RiskyTroves } from "../components/RiskyTroves";

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
