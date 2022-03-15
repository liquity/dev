import React, { useEffect, useReducer, useState } from "react";
import { useWeb3React } from "@web3-react/core";
import { AbstractConnector } from "@web3-react/abstract-connector";
import { Button, Text, Flex, Link, Box } from "theme-ui";
import { InfoMessage } from "./InfoMessage";

import { injectedConnector } from "../connectors/injectedConnector";
import { getWcConnector, resetWc } from "../connectors/walletconnectConnector";
import { coinbaseWalletConnector } from "../connectors/coinbaseWalletConnector";
import { useAutoConnection } from "../hooks/useAutoConnection";

import { RetryDialog } from "./RetryDialog";
import { SelectWalletDialog } from "./SelectWalletDialog";
import { ConnectionConfirmationDialog } from "./ConnectionConfirmationDialog";
import { MetaMaskIcon } from "./MetaMaskIcon";
import { Icon } from "./Icon";
import { Modal } from "./Modal";
import { ConnectPage, device } from "./ConnectPage";
import { CoinbaseWalletIcon } from "./CoinbaseWalletIcon";

interface DetectWallet {
  ethereum?: {
    isMetaMask?: boolean;
    isToshi?: boolean;
  };
}

export type SelectedWallet = 
 | null
 | { name: string, connector: AbstractConnector;}

type ConnectionState =
  | { type: "inactive" }
  | {
      type: "activating" | "active" | "rejectedByUser" | "alreadyPending" | "failed";
      connector: AbstractConnector;
    };

type ConnectionAction =
  | { type: "startActivating"; connector: AbstractConnector }
  | { type: "fail"; error: Error }
  | { type: "finishActivating" | "retry" | "cancel" | "deactivate" };

const connectionReducer: React.Reducer<ConnectionState, ConnectionAction> = (state, action) => {
  switch (action.type) {
    case "startActivating":
      return {
        type: "activating",
        connector: action.connector
      };
    case "finishActivating":
      return {
        type: "active",
        connector: state.type === "inactive" ? injectedConnector : state.connector
      };
    case "fail":
      if (state.type !== "inactive") {
        return {
          type: action.error.message.match(/user rejected/i)
            ? "rejectedByUser"
            : action.error.message.match(/already pending/i)
            ? "alreadyPending"
            : "failed",
          connector: state.connector
        };
      }
      break;
    case "retry":
      if (state.type !== "inactive") {
        return {
          type: "activating",
          connector: state.connector
        };
      }
      break;
    case "cancel":
      return {
        type: "inactive"
      };
    case "deactivate":
      return {
        type: "inactive"
      };
  }

  console.warn("Ignoring connectionReducer action:");
  console.log(action);
  console.log("  in state:");
  console.log(state);

  return state;
};

const detectMetaMask = () => (window as DetectWallet).ethereum?.isMetaMask ?? false;
const detectCoinbaseWallet = () => (window as DetectWallet).ethereum?.isToshi ?? false;

type WalletConnectorProps = {
  loader?: React.ReactNode;
};

const inIframe = () => {
  try {
      return window.self !== window.top;
  } catch (e) {
      return true;
  }
}

const mobileAndTabletCheck = ():boolean => {
  let check = false;
  (function(a){if(/(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino|android|ipad|playbook|silk/i.test(a)||/1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i.test(a.substr(0,4))) check = true;})(navigator.userAgent||navigator.vendor||window.opera);
  return check;
};

export const WalletConnector: React.FC<WalletConnectorProps> = ({ children, loader }) => {
  const { activate, deactivate, active, error } = useWeb3React<unknown>();
  // const triedAutoConnection = useAutoConnection();
  const [selectedWallet, setSelectedWallet] = useState<SelectedWallet>(null);
  const [showSelectWalletMDL, setShowSelectWalletMDL] = useState(false);

  const [connectionState, dispatch] = useReducer(connectionReducer, { type: "inactive" });
  const isMetaMask = selectedWallet && selectedWallet.name === "MetaMask";
  const isCoinbaseWallet = selectedWallet && selectedWallet.name === "Coinbase Wallet";

  useEffect(() => {
    if (error) {
      if(selectedWallet && selectedWallet.name === "WalletConnect"){
        resetWc()
        setSelectedWallet({ 
          name: "WalletConnect",
          connector: getWcConnector()
        });
      }
      dispatch({ type: "fail", error });
      deactivate();
    }
  }, [error, deactivate]);

  useEffect(() => {
    if (active) {
      window.localStorage.setItem("liquity-v2-connection", new Date().toString())
      dispatch({ type: "finishActivating" });
    } else {
      dispatch({ type: "deactivate" });
    }
  }, [active]);

  // if (!triedAutoConnection) {
  //   return <>{loader}</>;
  // }

  if (connectionState.type === "active") {
    return <>{children}</>;
  }

  const mobileAppLInk = inIframe() && mobileAndTabletCheck()

  return (
    <ConnectPage>
      <Flex sx={{ justifyContent: "center", alignItems: "flex-start", flexDirection: "column",
        [`@media screen and (min-width: ${device.mobile}px)`]: {
          width: "319px",
        },
        [`@media screen and (min-width: ${device.laptop}px)`]: {
          width: "219px",
        },
        [`@media screen and (min-width: ${device.desktop}px)`]: {
          width: "242px",
        },
      }}>
        {mobileAppLInk &&
        <a 
          style={{textDecoration: "none"}}
          href="/liquity-app/" target="_top">
          <Button
            sx={{ 
              fontFamily: `"NeueHaasGroteskDisp Pro Md", sans-serif`,
              backgroundColor: "#12c164",
              border: "none",
              letterSpacing: "0.75px",
              whiteSpace: "nowrap",
              width: "100%",
              [`@media screen and (min-width: ${device.mobile}px)`]: {
                fontSize: "20px",
                height: "59px"
              },
              [`@media screen and (min-width: ${device.laptop}px)`]: {
                fontSize: "14px",
                height: "49px"
              },
              [`@media screen and (min-width: ${device.desktop}px)`]: {
                fontSize: "15px",
                height: "54px"
              },
            }}
          >
            <Box>CONNECT</Box>
          </Button>
        </a>}
        {!mobileAppLInk && <Button
          sx={{ 
            fontFamily: `"NeueHaasGroteskDisp Pro Md", sans-serif`,
            backgroundColor: "#12c164",
            border: "none",
            letterSpacing: "0.75px",
            whiteSpace: "nowrap",
            width: "100%",
            [`@media screen and (min-width: ${device.mobile}px)`]: {
              fontSize: "20px",
              height: "59px"
            },
            [`@media screen and (min-width: ${device.laptop}px)`]: {
              fontSize: "14px",
              height: "49px"
            },
            [`@media screen and (min-width: ${device.desktop}px)`]: {
              fontSize: "15px",
              height: "54px"
            },
          }}
          onClick={()=>setShowSelectWalletMDL(true)}
        >
          <Box>CONNECT</Box>
        </Button>}
        <Box sx={{ ml:2, mt: 15, width: "100%" }}>
        <a style={{ 
            color: "#647686",
            textDecoration: "none",
            lineHeight: "normal",
            letterSpacing: "0.6px",
            fontFamily: `"NeueHaasGroteskDisp Pro Md", sans-serif`,
            fontSize: "12px"
          }} href="https://app.bprotocol.org/terms" target="_top">
            By using B.Protocol, you agree to the <span style={{textDecoration: "underline"}}>Terms and Conditions</span>
        </a>
        </Box>
      </Flex>

      {showSelectWalletMDL && (
        <Modal>
          <style dangerouslySetInnerHTML={{__html: `
              .connector-btn{
                display: flex;
                align-items: center;
                justify-content: space-between;
                width: 100%;
                margin: 5px;
                border: 1px solid black;
                padding: 10px;
                border-radius: 5px;
                font-weight: 600;
                max-height: 80px;
              }
              .connector-btn:hover{
                background: #efefef;
                cursor: pointer;
              }
          `}} />
          <SelectWalletDialog 
            onCancel={() => setShowSelectWalletMDL(false)}>
            <Flex sx={{ 
              flexDirection: "column",
              alignItems: "center", 
              width: "100%"
              }}>
              <div
                onClick={() => {
                  setSelectedWallet({ 
                    name: "MetaMask",
                    connector: injectedConnector
                  });
                  dispatch({ type: "startActivating", connector: injectedConnector });
                  activate(injectedConnector);
                  setShowSelectWalletMDL(false)
                }}
                className="connector-btn">
                <svg viewBox="0 0 24 24" style={{width: "40px"}} focusable="false" role="presentation" className="css-tic4zn"><g><g clipPath="url(#clip0_metamask)"><path d="M20.6116 2.44287L13.1526 8.03834L14.5233 4.73046L20.6116 2.44287Z" fill="#E2761B"></path><path d="M3.38794 2.44287L10.7832 8.09204L9.47626 4.73046L3.38794 2.44287Z" fill="#E4761B"></path><path d="M17.9235 15.4272L15.9365 18.4988L20.1867 19.6802L21.4086 15.4917L17.9235 15.4272Z" fill="#E4761B"></path><path d="M2.59106 15.4917L3.81298 19.6802L8.06312 18.4988L6.07618 15.4272L2.59106 15.4917Z" fill="#E4761B"></path><path d="M7.81882 10.2292L6.6394 12.0335L10.8577 12.2268L10.7089 7.64087L7.81882 10.2292Z" fill="#E4761B"></path><path d="M16.1702 10.2292L13.2482 7.58716L13.1526 12.2268L17.3602 12.0335L16.1702 10.2292Z" fill="#E4761B"></path><path d="M8.06323 18.4989L10.5921 17.253L8.40324 15.5239L8.06323 18.4989Z" fill="#E4761B"></path><path d="M13.397 17.253L15.9364 18.4989L15.5858 15.5239L13.397 17.253Z" fill="#E4761B"></path><path d="M15.9364 18.499L13.397 17.2532L13.5989 18.9286L13.5776 19.6374L15.9364 18.499Z" fill="#D7C1B3"></path><path d="M8.06323 18.499L10.4221 19.6374L10.4114 18.9286L10.5921 17.2532L8.06323 18.499Z" fill="#D7C1B3"></path><path d="M10.4645 14.4179L8.3501 13.7843L9.83765 13.0969L10.4645 14.4179Z" fill="#233447"></path><path d="M13.5247 14.4179L14.1516 13.0969L15.6497 13.7843L13.5247 14.4179Z" fill="#233447"></path><path d="M8.06311 18.4988L8.42437 15.4272L6.07617 15.4917L8.06311 18.4988Z" fill="#CD6116"></path><path d="M15.5752 15.4272L15.9365 18.4988L17.9234 15.4917L15.5752 15.4272Z" fill="#CD6116"></path><path d="M17.3602 12.0334L13.1526 12.2268L13.5351 14.4177L14.162 13.0967L15.6602 13.784L17.3602 12.0334Z" fill="#CD6116"></path><path d="M8.35008 13.784L9.84826 13.0967L10.4645 14.4177L10.8577 12.2268L6.6394 12.0334L8.35008 13.784Z" fill="#CD6116"></path><path d="M6.6394 12.0334L8.40321 15.5239L8.35009 13.784L6.6394 12.0334Z" fill="#E4751F" stroke="#E4751F" strokeWidth="0.07" strokeLinecap="round" strokeLinejoin="round"></path><path d="M15.6603 13.784L15.5859 15.5239L17.3604 12.0334L15.6603 13.784Z" fill="#E4751F" stroke="#E4751F" strokeWidth="0.07" strokeLinecap="round" strokeLinejoin="round"></path><path d="M10.8577 12.2268L10.4646 14.4177L10.9534 17.006L11.0702 13.6015L10.8577 12.2268Z" fill="#E4751F"></path><path d="M13.1528 12.2268L12.9509 13.5908L13.0359 17.006L13.5353 14.4177L13.1528 12.2268Z" fill="#E4751F"></path><path d="M13.5353 14.4178L13.0359 17.0061L13.3972 17.2532L15.586 15.524L15.6603 13.7842L13.5353 14.4178Z" fill="#F6851B"></path><path d="M8.3501 13.7842L8.40322 15.524L10.592 17.2532L10.9533 17.0061L10.4645 14.4178L8.3501 13.7842Z" fill="#F6851B"></path><path d="M13.5778 19.6374L13.599 18.9286L13.4078 18.7568H10.5814L10.4114 18.9286L10.4221 19.6374L8.06323 18.499L8.89201 19.1864L10.5602 20.357H13.429L15.1078 19.1864L15.9366 18.499L13.5778 19.6374Z" fill="#C0AD9E"></path><path d="M13.3971 17.2531L13.0358 17.0061H10.9533L10.592 17.2531L10.4114 18.9285L10.5814 18.7567H13.4077L13.599 18.9285L13.3971 17.2531Z" fill="#161616"></path><path d="M20.9197 8.40349L21.5679 5.31041L20.6116 2.44287L13.397 7.85576L16.1702 10.2293L20.0909 11.3892L20.9622 10.3581L20.5903 10.0896L21.1853 9.53118L20.7285 9.16602L21.3235 8.70421L20.9197 8.40349Z" fill="#763D16"></path><path d="M2.44238 5.31041L3.0799 8.40349L2.66552 8.70421L3.27116 9.16602L2.81427 9.53118L3.40929 10.0896L3.0374 10.3581L3.89806 11.3892L7.81881 10.2293L10.592 7.85576L3.38804 2.44287L2.44238 5.31041Z" fill="#763D16"></path><path d="M20.0911 11.3892L16.1703 10.2292L17.3604 12.0335L15.5859 15.524L17.9235 15.4918H21.4086L20.0911 11.3892Z" fill="#F6851B"></path><path d="M7.81873 10.2292L3.89798 11.3892L2.59106 15.4918H6.07618L8.40313 15.524L6.63932 12.0335L7.81873 10.2292Z" fill="#F6851B"></path><path d="M13.1527 12.2269L13.3971 7.85577L14.534 4.73047H9.47632L10.592 7.85577L10.8576 12.2269L10.9532 13.6016V17.0061H13.0358L13.0464 13.6016L13.1527 12.2269Z" fill="#F6851B"></path></g><defs><clipPath id="clip0_metamask"><rect x="2.3999" y="2.3999" width="19.2" height="18" fill="white"></rect></clipPath></defs></g></svg>
                <span>MetaMask</span>
                <span style={{width: "40px"}}></span>
              </div>
              <div
                onClick={() => {
                  setSelectedWallet({ 
                    name: "Coinbase Wallet",
                    connector: coinbaseWalletConnector,
                  });
                  dispatch({ type: "startActivating", connector: coinbaseWalletConnector });
                  activate(coinbaseWalletConnector);
                  setShowSelectWalletMDL(false)
                }}
                className="connector-btn">
                <svg width="40" height="40" viewBox="0 0 74 74" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="37" cy="37" r="35" fill="#1B53E4" stroke="white" stroke-width="4"/>
                <path fill-rule="evenodd" clip-rule="evenodd" d="M37.2446 60.6123C24.473 60.6123 14.1196 50.2589 14.1196 37.4873C14.1196 24.7157 24.473 14.3623 37.2446 14.3623C50.0162 14.3623 60.3696 24.7157 60.3696 37.4873C60.3696 50.2589 50.0162 60.6123 37.2446 60.6123Z" fill="white"/>
                <path d="M29.7939 33.021C29.7939 31.3703 31.132 30.0322 32.7827 30.0322H41.708C43.3586 30.0322 44.6967 31.3703 44.6967 33.021V41.9463C44.6967 43.5969 43.3586 44.935 41.708 44.935H32.7827C31.132 44.935 29.7939 43.5969 29.7939 41.9463V33.021Z" fill="#1B53E4"/>
                </svg>
                <span>Coinbase Wallet</span>
                <span style={{width: "40px"}}></span>
              </div>
              <div
                onClick={() => {
                  resetWc()
                  const wc = getWcConnector()
                  setSelectedWallet({ 
                    name: "WalletConnect",
                    connector: wc
                  });
                  dispatch({ type: "startActivating", connector: wc });
                  activate(wc);
                  setShowSelectWalletMDL(false)
                }}
                className="connector-btn">
                <svg viewBox="0 0 24 24" style={{width: "40px"}} focusable="false" role="presentation" className="css-tic4zn"><g><path d="M6.09607 8.54776C9.35682 5.18265 14.6435 5.18265 17.9043 8.54776L18.2967 8.95276C18.4598 9.12101 18.4598 9.39381 18.2967 9.56207L16.9543 10.9475C16.8728 11.0316 16.7406 11.0316 16.6591 10.9475L16.119 10.3902C13.8442 8.04257 10.1561 8.04257 7.88132 10.3902L7.30299 10.987C7.22147 11.0711 7.0893 11.0711 7.00778 10.987L5.66533 9.60159C5.5023 9.43333 5.5023 9.16054 5.66533 8.99228L6.09607 8.54776ZM20.6806 11.4129L21.8754 12.646C22.0384 12.8142 22.0384 13.087 21.8754 13.2553L16.488 18.8151C16.325 18.9834 16.0607 18.9834 15.8976 18.8151C15.8976 18.8151 15.8976 18.8151 15.8976 18.8151L12.074 14.8691C12.0332 14.8271 11.9672 14.8271 11.9264 14.8691C11.9264 14.8691 11.9264 14.8691 11.9264 14.8691L8.10287 18.8151C7.93984 18.9834 7.6755 18.9834 7.51246 18.8151C7.51246 18.8151 7.51246 18.8151 7.51246 18.8151L2.12496 13.2552C1.96193 13.0869 1.96193 12.8142 2.12496 12.6459L3.31975 11.4129C3.48278 11.2446 3.74712 11.2446 3.91016 11.4129L7.73382 15.3589C7.77458 15.401 7.84066 15.401 7.88142 15.3589C7.88142 15.3589 7.88143 15.3589 7.88143 15.3589L11.7049 11.4129C11.8679 11.2446 12.1323 11.2446 12.2953 11.4129C12.2953 11.4129 12.2953 11.4129 12.2953 11.4129L16.119 15.3589C16.1597 15.401 16.2258 15.401 16.2666 15.3589L20.0902 11.4129C20.2532 11.2447 20.5176 11.2447 20.6806 11.4129Z" fill="#5399F5"></path></g></svg>
                <span>WallectConnect</span>
                <span style={{width: "40px"}}></span>
              </div>
            </Flex>
            <Box css={{marginTop: "38px"}}>
              <InfoMessage title="Old accounts are accessible via the legacy version. ">
                To migrate your account, withdraw the LUSD from the legacy version and deposit it again here. <a target='_blank' rel="noreferrer" href="https://medium.com/b-protocol/lusd-liquidations-during-21-24-1-lesson-learned-51a40d244bcb">Learn more.</a>
              </InfoMessage>
            </Box>
          </SelectWalletDialog>
        </Modal>
      )}

      {connectionState.type === "failed" && (
        <Modal>
          <RetryDialog
            title={isMetaMask ? "Failed to connect to MetaMask" : "Failed to connect wallet"}
            onCancel={() => dispatch({ type: "cancel" })}
            onRetry={() => {
              dispatch({ type: "retry" });
              activate(connectionState.connector);
            }}
          >
            <Box sx={{ textAlign: "center" }}>
              You might need to install Coinbase Wallet, MetaMask or use a different browser.
            </Box>
            <Link sx={{ lineHeight: 3 }} href="https://metamask.io/download.html" target="_blank">
              Learn more <Icon size="xs" name="external-link-alt" />
            </Link>
          </RetryDialog>
        </Modal>
      )}

      {connectionState.type === "activating" && (
        <Modal>
          <ConnectionConfirmationDialog
            title={
              isMetaMask ? "Confirm connection in MetaMask" : 
              isCoinbaseWallet? "Confirm Connect in Coinbase Wallet " :
              "Confirm connection in your wallet"
            }
            icon={isMetaMask ? <MetaMaskIcon /> : isCoinbaseWallet ? <CoinbaseWalletIcon /> :<Icon name="wallet" size="lg" />}
            onCancel={() => dispatch({ type: "cancel" })}
          >
            <Text sx={{ textAlign: "center" }}>
              Confirm the request that&apos;s just appeared.
              {isMetaMask && (
                <> If you can&apos;t see a request, open your MetaMask extension via your browser.</>
              )}
              {isCoinbaseWallet && (
                <> If you can&apos;t see a request, open your Coinbase Wallet extension via your browser.</>
              )}
              {!isCoinbaseWallet && !isMetaMask && (
                <> If you can&apos;t see a request, you might have to open your wallet.</>
              )}
            </Text>
          </ConnectionConfirmationDialog>
        </Modal>
      )}

      {connectionState.type === "rejectedByUser" && (
        <Modal>
          <RetryDialog
            title="Cancel connection?"
            onCancel={() => dispatch({ type: "cancel" })}
            onRetry={() => {
              dispatch({ type: "retry" });
              activate(connectionState.connector);
            }}
          >
            <Text>To use Liquity, you need to connect your Ethereum account.</Text>
          </RetryDialog>
        </Modal>
      )}

      {connectionState.type === "alreadyPending" && (
        <Modal>
          <RetryDialog
            title="Connection already requested"
            onCancel={() => dispatch({ type: "cancel" })}
            onRetry={() => {
              dispatch({ type: "retry" });
              activate(connectionState.connector);
            }}
          >
            <Text>Please check your wallet and accept the connection request before retrying.</Text>
          </RetryDialog>
        </Modal>
      )}
    </ConnectPage>
  );
};
