import React from "react";
import Tippy from "@tippyjs/react";
import 'tippy.js/animations/scale.css';
import { Card, Text } from "theme-ui";

type StatisticProps = {
    name: React.ReactNode;
    tooltip?: React.ReactNode;
    variant?: string;
};

export const BigStatistic: React.FC<StatisticProps> = ({ variant = "info", name, tooltip, children }) => {

    return (
        <Tippy delay={1000} interactive={true} placement="bottom" animation="scale" arrow={true} content={<Card variant="tooltipInfo">{tooltip}</Card>} maxWidth="268px">
            <Card {...{ variant }}
                sx={{
                    m: 0,
                    flex: ["1 0 40%", "1 0 30%"],
                }}>
                <Text sx={{
                    display: "flex",
                    justifyContent: "center",
                }}>{name}</Text>
                <Text sx={{
                    fontSize: "x-large",
                    fontWeight: "bold",
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center"
                }}>{children}</Text>
            </Card>
        </Tippy>
    );
};
