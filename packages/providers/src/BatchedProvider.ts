import { isAddress } from "@ethersproject/address";
import { BigNumber, BigNumberish } from "@ethersproject/bignumber";
import { Provider, TransactionRequest, BlockTag } from "@ethersproject/abstract-provider";
import { BaseProvider } from "@ethersproject/providers";
import { BytesLike } from "@ethersproject/bytes";
import { Contract } from "@ethersproject/contracts";
import { Deferrable, resolveProperties } from "@ethersproject/properties";

import { WebSocketAugmentedWeb3Provider } from "./WebSocketAugmentedProvider";

const multicallAddress = {
  1: "0xeefBa1e63905eF1D7ACbA5a8513c70307C1cE441",
  3: "0x53C43764255c17BD724F74c4eF150724AC50a3ed",
  4: "0x42Ad527de7d4e9d9d011aC45B31D8551f8Fe9821",
  5: "0x77dCa2C955b15e9dE4dbBCf1246B4B85b651e50e",
  42: "0x2cc8688C5f75E365aaEEb4ea8D6a480405A48D2A"
};

const hasMulticall = (chainId: number): chainId is keyof typeof multicallAddress =>
  chainId in multicallAddress;

const multicallAbi = [
  {
    type: "function",
    name: "aggregate",
    stateMutability: "nonpayable",
    constant: false,
    payable: false,

    inputs: [
      {
        components: [
          {
            name: "target",
            type: "address"
          },
          {
            name: "callData",
            type: "bytes"
          }
        ],
        name: "calls",
        type: "tuple[]"
      }
    ],

    outputs: [
      {
        name: "blockNumber",
        type: "uint256"
      },
      {
        name: "returnData",
        type: "bytes[]"
      }
    ]
  },

  {
    type: "function",
    name: "getEthBalance",
    stateMutability: "view",
    constant: true,
    payable: false,

    inputs: [
      {
        name: "addr",
        type: "address"
      }
    ],

    outputs: [
      {
        name: "balance",
        type: "uint256"
      }
    ]
  }
];

type CallRequest = {
  target: string;
  callData: BytesLike;
};

type BatchableOverrides = { blockTag?: BlockTag };

interface Multicall extends Contract {
  readonly callStatic: {
    aggregate(
      calls: CallRequest[],
      overrides?: BatchableOverrides
    ): Promise<{ blockNumber: BigNumber; returnData: string[] }>;
  };

  readonly functions: {
    getEthBalance(addr: string, overrides?: BatchableOverrides): Promise<[BigNumber]>;
  };
}

type ResolvedTransactionRequest = {
  to?: string;
  from?: string;
  nonce?: BigNumberish;
  gasLimit?: BigNumberish;
  gasPrice?: BigNumberish;
  data?: BytesLike;
  value?: BigNumberish;
  chainId?: number;
};

interface BatchedCalls extends BatchableOverrides {
  calls: CallRequest[];
  callbacks: [(resolveValue: string) => void, (rejectReason: any) => void][];
}

const emptyBatch = (): BatchedCalls => ({ calls: [], callbacks: [] });

// TODO
//
// Technically, requests that have a `from` address shouldn't be batched, because `msg.sender` will
// be replaced with the Multicall contract's address when the batched calls are being executed.
//
// Currently, `@liquity/lib-ethers` makes many of its read calls through Signers, which populates
// `from`. Instead these calls should be made through a Provider, and `from` should be omitted
// (since none of the read calls in Liquity care about `msg.sender`).
//
// Then we'll be able to properly exclude calls that have `from` addresses from batching.
const batchableCall = (request: ResolvedTransactionRequest) =>
  request.gasLimit === undefined && request.gasPrice === undefined && request.value === undefined;

const batchedCall = (request: ResolvedTransactionRequest, multicallAddress: string) =>
  request.to === multicallAddress &&
  typeof request.data === "string" &&
  request.data.startsWith("0x252dba42"); // signature of `aggregate((address,bytes)[])`

export interface BatchedProvider extends BaseProvider {
  batchingDelayMs: number;
  chainId: number;
}

const batchedProviders: any[] = [];

export const isBatchedProvider = (provider: Provider): provider is BatchedProvider =>
  batchedProviders.some(batchedProvider => provider instanceof batchedProvider);

export const Batched = <T extends new (...args: any[]) => BaseProvider>(Base: T) => {
  const batchedProvider = class extends Base implements BatchedProvider {
    batchingDelayMs = 10;

    _chainId = 0;
    _multicall?: Multicall;
    _timeoutId: any;
    _batched: BatchedCalls = emptyBatch();

    _numberOfBatchedCalls = 0;
    _numberOfActualCalls = 0;
    _timeOfLastRatioCheck?: number;

    get chainId() {
      return this._chainId;
    }

    set chainId(chainId: number) {
      if (this._multicall) {
        throw new Error("can only set chainId once");
      }

      if (hasMulticall(chainId)) {
        this._multicall = new Contract(multicallAddress[chainId], multicallAbi, this) as Multicall;
      }

      this._chainId = chainId;
    }

    async _dispatchCalls() {
      const { calls, callbacks, blockTag } = this._batched;
      this._batched = emptyBatch();

      try {
        const results =
          calls.length > 1
            ? await this._multicall!.callStatic.aggregate(calls, { blockTag }).then(
                x => x.returnData
              )
            : [await super.call({ to: calls[0].target, data: calls[0].callData }, blockTag)];

        callbacks.forEach(([resolve], i) => resolve(results[i]));
      } catch (error) {
        callbacks.forEach(([, reject]) => reject(error));
      }
    }

    _enqueueCall(call: CallRequest): Promise<string> {
      if (this._timeoutId !== undefined) {
        clearTimeout(this._timeoutId);
      }

      this._batched.calls.push(call);
      this._timeoutId = setTimeout(() => this._dispatchCalls(), this.batchingDelayMs);

      return new Promise((resolve, reject) => this._batched.callbacks.push([resolve, reject]));
    }

    _alreadyBatchedCallsConflictWith(blockTag?: BlockTag) {
      return (
        this._batched.calls.length !== 0 &&
        (blockTag ?? "latest") !== (this._batched.blockTag ?? "latest")
      );
    }

    async call(
      request: Deferrable<TransactionRequest>,
      blockTag?: BlockTag | Promise<BlockTag>
    ): Promise<string> {
      if (!this._multicall) {
        return super.call(request, blockTag);
      } else {
        const now = new Date().getTime();

        if (this._timeOfLastRatioCheck === undefined) {
          this._timeOfLastRatioCheck = now;
        } else {
          const timeSinceLastRatioCheck = now - this._timeOfLastRatioCheck;

          if (timeSinceLastRatioCheck >= 10000 && this._numberOfActualCalls) {
            // console.log(
            //   `Call batching ratio: ${
            //     Math.round((10 * this._numberOfBatchedCalls) / this._numberOfActualCalls) / 10
            //   }X`
            // );

            this._numberOfBatchedCalls = 0;
            this._numberOfActualCalls = 0;
            this._timeOfLastRatioCheck = now;
          }
        }
      }

      const [resolvedRequest, resolvedBlockTag] = await Promise.all([
        resolveProperties(request),
        blockTag
      ]);

      if (
        batchedCall(resolvedRequest, this._multicall.address) ||
        !batchableCall(resolvedRequest) ||
        this._alreadyBatchedCallsConflictWith(resolvedBlockTag)
      ) {
        this._numberOfActualCalls++;

        return super.call(resolvedRequest, resolvedBlockTag);
      } else {
        this._numberOfBatchedCalls++;

        if (this._batched.calls.length === 0) {
          this._batched.blockTag = resolvedBlockTag;
        }

        return this._enqueueCall({ target: resolvedRequest.to!, callData: resolvedRequest.data! });
      }
    }

    async getBalance(
      addressOrName: string | Promise<string>,
      blockTag?: BlockTag | Promise<BlockTag>
    ): Promise<BigNumber> {
      const [resolvedAddressOrName, resolvedBlockTag] = await Promise.all([addressOrName, blockTag]);

      if (!isAddress(resolvedAddressOrName) || !this._multicall) {
        return super.getBalance(resolvedAddressOrName, blockTag);
      }

      const [balance] = await this._multicall.functions.getEthBalance(resolvedAddressOrName, {
        blockTag: resolvedBlockTag
      });

      return balance;
    }
  };

  batchedProviders.push(batchedProvider);

  return batchedProvider;
};

export const BatchedWebSocketAugmentedWeb3Provider = Batched(WebSocketAugmentedWeb3Provider);
