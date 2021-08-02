import React from "react";
import { Flex, Link, Box } from "theme-ui";

type ConnectPageProps = {
};

type ItemProps = {
  icon: string,
  title: React.ReactElement,
  text: string,
  link: any
};

export const device = {
  mobile: 300,
  tablet: 700,
  laptop: 1000,
  desktop: 1200
}

const Item: React.FC<ItemProps> = ({icon, title, text, link}) => {
  return (
    <Flex sx={{ flexDirection: "column", alignItems: "flex-start"}}>
      <Box sx={{ 
        margin: "10px", marginLeft: "0",
        [`@media screen and (min-width: ${device.mobile}px)`]: {
          marginTop: "80px",
          height: "102px",
        },
        [`@media screen and (min-width: ${device.tablet}px)`]: {
          marginTop: "10px",
          height: "55px",
        },
        [`@media screen and (min-width: ${device.laptop}px)`]: {
          height: "55px",
        },
        [`@media screen and (min-width: ${device.desktop}px)`]: {
          height: "73px",
        },
        }}>
        <img width="100%" height="100%" src={icon}/>
      </Box>
      <Box sx={{ 
        padding: "20px", paddingLeft: "0",
        fontFamily: `"NeueHaasGroteskDisp Pro Md", sans-serif`,
        fontWeight: "600",
        [`@media screen and (min-width: ${device.mobile}px)`]: {
          fontSize: "30px",
          width: "100%"
        },
        [`@media screen and (min-width: ${device.tablet}px)`]: {
          fontSize: "23px",
          width: "219px"
        },
        [`@media screen and (min-width: ${device.laptop}px)`]: {
          fontSize: "23px",
          width: "219px"
        },
        [`@media screen and (min-width: ${device.desktop}px)`]: {
          fontSize: "26px",
          width: "270px"
        },
      }}>
        {title}
      </Box>
      <Box sx={{ 
        padding: "10px", paddingLeft: "0", letterSpacing: "0.7px",
        fontFamily: `"NeueHaasGroteskDisp Pro Md", sans-serif`,
        [`@media screen and (min-width: ${device.mobile}px)`]: {
          fontSize: "18px",
          width: "100%",          
          maxWidth: "100%"
        },
        [`@media screen and (min-width: ${device.tablet}px)`]: {
          fontSize: "12px",
          maxWidth: "290px"
        },
        [`@media screen and (min-width: ${device.laptop}px)`]: {
          fontSize: "12px",
          maxWidth: "290px"
        },
        [`@media screen and (min-width: ${device.desktop}px)`]: {
          fontSize: "13px",
          maxWidth: "290px"
        },
      }}>
        {text}
        {" "}
        <a style={{color: "#0f874a"}} href={link}>here </a>
      </Box>
    </Flex>
  )
}



export const ConnectPage: React.FC<ConnectPageProps> = ({children}) => {
  const GROUP = "./bprotocol/group.png"
  const GROUP_1 = "./bprotocol/group-1.png"
  const GROUP_2 = "./bprotocol/group-2.png"
  const GROUP_3 = "./bprotocol/group-3.png"
  return (
    <div style={{ height: "100%", minHeight: "100vh" }}>
      <Box sx={{
        width: "100%",
        backgroundPosition: "right",
        backgroundSize: "cover",
        overflow: "hidden",
        [`@media screen and (min-width: ${device.mobile}px)`]: {
          padding: "180px 28px 28px 28px",
          backgroundPosition: "bottom",
          backgroundImage: `url(${GROUP_3})`,
          height: "519px"
          
        },
        [`@media screen and (min-width: ${device.tablet}px)`]: {
          padding: "85px",
          backgroundImage: `url(${GROUP_2})`,
          height: "306px",
        },
        [`@media screen and (min-width: ${device.laptop}px)`]: {
          padding: "95px",
          backgroundImage: `url(${GROUP_1})`,
          height: "306px",
        },
        [`@media screen and (min-width: ${device.desktop}px)`]: {
          padding: "105px",
          height: "353px",
          backgroundImage: `url(${GROUP})`,
        },
      }}>
        <Box sx={{
            fontFamily: `"Poppins", sans-serif`, 
            fontWeight: "bold",
            letterSpacing: "1.09px",
            color: "#17111e",
            [`@media screen and (min-width: ${device.mobile}px)`]: {
              padding: "20",
              fontSize: "40px",
            },
            [`@media screen and (min-width: ${device.tablet}px)`]: {
              padding: "0",
              fontSize: "35px",
              width: "450px",
            },
            [`@media screen and (min-width: ${device.laptop}px)`]: {
              padding: "0",
              fontSize: "46px",
              width: "603px",
            },
            [`@media screen and (min-width: ${device.desktop}px)`]: {
              padding: "0",
              fontSize: "51px",
              width: "665px",
            },
            lineHeight: 1.33
          }}>
              Automated Rebalancing for Liquity Stability Pool 
        </Box>
        <Box sx={{
            fontFamily: `"Poppins", sans-serif`,
            fontWeight: 200,
            letterSpacing: "0.73px",
            color: "#17111e",
            [`@media screen and (min-width: ${device.mobile}px)`]: {
              fontSize: "35px",
            },
            [`@media screen and (min-width: ${device.tablet}px)`]: {
              fontSize: "30px", 
            },
            [`@media screen and (min-width: ${device.laptop}px)`]: {
              fontSize: "33px",
            },
            [`@media screen and (min-width: ${device.desktop}px)`]: {
              fontSize: "36px",
            },
          }}>
            Powered by B.Protocol v2
        </Box>
      </Box>
      <Box sx={{
        marginTop: "-25px",
        [`@media screen and (min-width: ${device.mobile}px)`]: {
          marginLeft: "calc(50% - 160px)",
        },
        [`@media screen and (min-width: ${device.tablet}px)`]: {
          marginLeft: "85px",
        },
        [`@media screen and (min-width: ${device.laptop}px)`]: {
          marginLeft: "95px",
        },
        [`@media screen and (min-width: ${device.desktop}px)`]: {
          marginLeft: "105px",
        },
      }}>
        {children}
      </Box>
      <Flex sx={{ 
          justifyContent: "space-between",
          flexWrap: "wrap",
          [`@media screen and (min-width: ${device.mobile}px)`]: {
            flexDirection: "column",
            padding: "28px",
            paddingTop: "28px",
          },
          [`@media screen and (min-width: ${device.tablet}px)`]: {
            flexDirection: "row",
            padding: "85px",
            paddingTop: "65px",
          },
          [`@media screen and (min-width: ${device.laptop}px)`]: {
            padding: "95px",
            paddingTop: "75px",
          },
          [`@media screen and (min-width: ${device.desktop}px)`]: {
            padding: "105px",
            paddingTop: "85px",
          },
        }}>
        <Item
          icon={"./bprotocol/icon-a-1.svg"}
          title={<span>Stabilize <br/>Liquity Protocol</span>}
          text="B.Protocol v2 and its novel Backstop AMM (B.AMM) automates the rebalancing of Liquity Stability Pool to maintain its strength.
          Read more on how the Liquity
          SP is working "
          link="https://docs.liquity.org/faq/stability-pool-and-liquidations"
        />
        <Item
          icon={"./bprotocol/icon-a-2.svg"}
          title={<span>Get Passive<br/>
          Yield on Your LUSD</span>}
          text="By using B.Protocol to deposit your LUSD into Liquity Stability Pool, you can save the manual operation of selling your accumulated ETH back to LUSD every time a liquidation is taking place.
          Read more about how it’s done"
          link="TODO:"
        />
        <Item
          icon={"./bprotocol/icon-a-3.svg"}
          title={<span>Using<br/>
          B.Protocl V2</span>}
          text="The integration of Liqity with B.Protocol v2 is a step forward towards a more stabilized DeFi ecosystem. 
          Read mor about the novel B.AMM design that enables that"
          link="https://medium.com/b-protocol/b-amm-efficient-automated-market-maker-for-defi-liquidations-fea7b0fdc0c5"
        />
      </Flex>
    </div>
  )
}