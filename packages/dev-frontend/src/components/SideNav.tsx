import React, { useState, useRef } from "react";
import { Box, Button, Container, Flex } from "theme-ui";
import { Icon } from "./Icon";
import { LiquityLogo } from "./LiquityLogo";
import { Link } from "./Link";

const logoHeight = "32px";
export const SideNav: React.FC = () => {
    const [isVisible, setIsVisible] = useState(false);
    const overlay = useRef<HTMLDivElement>(null);

    const NavButton: React.FC = () => {
        return (
            <Button sx={{ display: ["flex", "none"] }} variant="icon" onClick={() => setIsVisible(true)}>
                <Icon name="bars" size="lg" />
            </Button>
        )
    }

    const NavModal: React.FC = () => {
        return (
            <Flex variant="layout.sidenav">
                <Button
                    sx={{ position: "fixed", right: 0, m: 2, zIndex: 99}}
                    variant="icon"
                    onClick={() => setIsVisible(false)}
                >
                    <Icon name="times" size="2x" />
                </Button>
                <LiquityLogo height={logoHeight} p={2} sx={{zIndex: 99}}/>
                <Box as="nav" sx={{ m: 3, mt: 1, p: 0, zIndex: 99}} onClick={() => setIsVisible(false)}>
                    <Link to="/">Dashboard</Link>
                    <Link to="/farm">Farm</Link>
                    <Link to="/liquidate">Liquidate</Link>
                </Box>
            </Flex>

        )
    }

    return (
        <>
            <NavButton />
            {isVisible &&
                <Container
                    variant="infoOverlay"
                    ref={overlay}
                    onClick={e => {
                        if (e.target === overlay.current) {
                            setIsVisible(false);
                        }
                    }}
                >
                    <NavModal />
                    <Container variant="blurFilter"/>
                </Container>
            }
        </>
    );
};
