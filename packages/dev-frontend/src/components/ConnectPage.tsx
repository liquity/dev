import React from "react";
import { Flex, Link, Box } from "theme-ui";

type ConnectPageProps = {
};

type ItemProps = {
  icon: string,
  title: string,
  text: string,
  link: any
};

const Item: React.FC<ItemProps> = ({icon, title, text, link}) => {
  return (
    <Flex sx={{ flexDirection: "column", maxWidth: "30%", alignItems: "flex-start"}}>
      <Box sx={{ height: "79px", padding: "10px", paddingLeft: "0" }}>
        <img width="100%" height="100%" src={icon}/>
      </Box>
      <Box sx={{ 
        padding: "20px", fontSize: "28px", letterSpacing: "0.8px", paddingLeft: "0",
        fontFamily: `"NeueHaasGroteskDisp Pro Md", sans-serif`
      }}>
        {title}
      </Box>
      <Box sx={{ 
        padding: "10px", fontSize: "14px", paddingLeft: "0", letterSpacing: "0.7px",
        fontFamily: `"NeueHaasGroteskDisp Pro Md", sans-serif`
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
  return (
    <div style={{ height: "100%", minHeight: "100vh" }}>
      <div style={{
        width: "100%",
        height: "30%",
        minHeight: "400px",
        maxHeight: "500px",
        backgroundImage: `url(${GROUP})`,
        backgroundSize: "cover",
        padding: "100px"
      }}>
        <Box sx={{
            fontFamily: `"Poppins", sans-serif`, 
            fontSize: "60px",
            fontWeight: "bold",
            lineHeight: "1.33",
            letterSpacing: "1.09px",
            color: "#17111e",
            maxWidth: "50%"
          }}>
          Automated Rebalancing for Liquity Stability Pool 
        </Box>
        <Box sx={{
            fontFamily: `"Poppins", sans-serif`,
            fontSize: "40px",
            fontWeight: 200,
            letterSpacing: "0.73px",
            color: "#17111e"
          }}>
          by B.Protocol v2
        </Box>
      </div>
      <div style={{
        marginTop: "-25px",
        marginLeft: "100px"
      }}>
        {children}
      </div>
      <Flex sx={{ justifyContent: "space-around", padding: "100px"}}>
        <Item
          icon={"./bprotocol/icon-a-1.svg"}
          title="Stabilize Liquity Protocol"
          text="B.Protocol v2 and its noval Backstop AMM (B.AMM) automates the rebalancing of Liquity Stability Pool to maintain its strength.
          Read more on how the Liquity
          SP is working "
          link=""
        />
        <Item
          icon={"./bprotocol/icon-a-2.svg"}
          title="Get Passive
          Yield on Your LUSD"
          text="By using B.Protocol to deposit your LUSD into Liquity Stability Pool, you can save the manual operation of selling your accumulated ETH back to LUSD every time a liquidation is taking place.
          Read more about how it’s done"
          link=""
        />
        <Item
          icon={"./bprotocol/icon-a-3.svg"}
          title="Using
          B.Protocl V2"
          text="The integration of Liqity with B.Protocol v2 is a step forward towards a more stabilized DeFi ecosystem. 
          Read mor about the novel B.AMM design that enables that"
          link=""
        />
      </Flex>
    </div>
  )
}