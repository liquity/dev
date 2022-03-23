import React, { useState, useEffect } from "react";
import { Card, Box, Heading, Flex, Button, Label, Input } from "theme-ui";

import { Decimal, LiquityStoreState } from "@fluidity/lib-base";
import { useLiquitySelector } from "@fluidity/lib-react";

import { useLiquity } from "../hooks/LiquityContext";

import { Transaction } from "./Transaction";
import { InfoIcon } from "./InfoIcon";

const selectPrice = ({ price }: LiquityStoreState) => price;

const info = "Only available when priceFeed is mocked for testing";

export const PriceManager: React.FC = () => {
    const {
        liquity: {
            send: liquity,
            connection: { _priceFeedIsTestnet: canSetPrice }
        }
    } = useLiquity();

    const price = useLiquitySelector(selectPrice);
    const [editedPrice, setEditedPrice] = useState(price.toString(2));

    useEffect(() => {
        setEditedPrice(price.toString(2));
    }, [price]);

    return canSetPrice ? (
        <Card sx={{
        borderColor: "accent",
        bg: "rgb(250 255 255)",
         }}>
            <Flex sx={{ mt: 3, mx: 3, alignItems: "center" }}>
                <Heading sx={{ fontSize: 2 }}>Price Manager</Heading>
                <InfoIcon size="sm" tooltip={<Card variant="tooltip">
                    {info}
                </Card>} />
            </Flex>

            <Box sx={{ p: [2, 3] }}>
                <Flex sx={{ alignItems: "stretch" }}>
                    <Label>AUT</Label>
                    <Label>=</Label>
                    <Label variant="unit">$</Label>

                    <Input
                        type={canSetPrice ? "number" : "text"}
                        step="any"
                        value={editedPrice}
                        onChange={e => setEditedPrice(e.target.value)}
                        disabled={!canSetPrice}
                    />

                    <Flex sx={{ ml: 2, alignItems: "center" }}>
                        <Transaction
                            id="set-price"
                            tooltip="Set"
                            tooltipPlacement="bottom"
                            send={overrides => {
                                if (!editedPrice) {
                                    throw new Error("Invalid price");
                                }
                                return liquity.setPrice(Decimal.from(editedPrice), overrides);
                            }}
                        >
                            <Button variant="outlineAccent">
                                Set
                            </Button>
                        </Transaction>
                    </Flex>
                </Flex>
            </Box>
        </Card>
    ) : (<></>);
};
