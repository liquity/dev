import { hexlify } from "@ethersproject/bytes";
import { Wallet } from "@ethersproject/wallet";
import { signTypedData, SignTypedDataVersion } from "@metamask/eth-sig-util";

import { Decimal, Decimalish } from "@liquity/lib-base";

export class DisposableWalletProvider {
  private readonly url: string;
  private id: number = 0;

  private readonly wallet: Wallet;
  private readonly funderWallet: Wallet;

  private readonly ethAmount: Decimal;
  private haveFunded = false;

  constructor(url: string, funderPrivateKey: string, ethAmount: Decimalish = 100) {
    this.url = url;
    this.wallet = Wallet.createRandom();
    this.funderWallet = new Wallet(funderPrivateKey);
    this.ethAmount = Decimal.from(ethAmount);
  }

  private findWallet(address: string) {
    const wallet = [this.wallet, this.funderWallet].find(
      wallet => wallet.address.toLowerCase() === address.toLowerCase()
    );

    // console.log(address, this.wallet, this.funderWallet);

    if (!wallet) {
      throw new Error(`Unknow account ${address}`);
    }

    return wallet;
  }

  private async fund() {
    return this.send("eth_sendTransaction", [
      {
        from: this.funderWallet.address,
        to: this.wallet.address,
        value: this.ethAmount.hex,
        gas: hexlify(21000)
      }
    ]);

    // WONT-FIX maybe wait for tx to be mined (not a problem on devchains though)
  }

  async send(method: string, params: any[]): Promise<any> {
    if (!this.haveFunded) {
      this.haveFunded = true;
      await this.fund();
    }

    switch (method) {
      case "eth_accounts":
      case "eth_requestAccounts":
        return [this.wallet.address];
      case "eth_signTypedData_v4": {
        const privateKeyWithout0xPrefix = this.findWallet(params[0]).privateKey.slice(2);
        const privateKey = Buffer.from(privateKeyWithout0xPrefix, "hex");
        const signature = await signTypedData({
          privateKey,
          data: JSON.parse(params[1]),
          version: SignTypedDataVersion.V4
        });
        return signature;
      }

      case "eth_sendTransaction":
        return this.send(
          "eth_sendRawTransaction",
          await Promise.all(
            params.map(async ({ from, nonce, gas, ...rest }) => {
              if (nonce === undefined) {
                nonce = await this.send("eth_getTransactionCount", [from]);
              }

              return this.findWallet(from).signTransaction({
                from,
                nonce,
                ...(gas !== undefined ? { gasLimit: gas } : {}),
                ...rest
              });
            })
          )
        );
    }

    //console.log({ method, params });

    const response = await fetch(this.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        method: method,
        params: params,
        id: this.id++,
        jsonrpc: "2.0"
      })
    });

    const json = await response.json();

    //console.log(json);

    if (json.error) {
      const { message, ...rest } = json.error;
      const error = new Error(`${message} ${JSON.stringify(rest)}`);
      throw Object.assign(error, rest);
    }

    return json.result;
  }

  request({ method, params }: { method: string; params: any[] }) {
    return this.send(method, params);
  }
}
