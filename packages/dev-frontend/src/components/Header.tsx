import React from "react";
import { Container, Flex} from "theme-ui";

import { LiquityLogo } from "./LiquityLogo";
import { Nav } from "./Nav";
import { SideNav } from "./SideNav";
import { UserAccount } from "./UserDashboard/UserAccount";
// import { SystemStatsPopup } from "./SystemStatsPopup";

const logoHeight = "40px";

export const Header: React.FC = () => {

    return (
        <Container variant="header">
            <Flex sx={{
                alignItems: "center",
                justifyContent: "space-between",
                flex: 1,
            }}>
                <Flex sx={{ flexBasis: ["50%", "20%"] }}>
                    <LiquityLogo height={logoHeight} />
                </Flex>
                <Nav />
                <Flex sx={{
                    flexBasis: ["50%", "20%"],
                    justifyContent: "flex-end"
                }}>
                    <UserAccount />
                    <SideNav />
                </Flex>
            </Flex>
            {/*
            <SystemStatsPopup />
            */}
        </Container>
    );
};
