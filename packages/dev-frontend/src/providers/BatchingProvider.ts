import assert from "assert";
import { TransactionRequest, BlockTag } from "@ethersproject/abstract-provider";
import { BigNumber } from "@ethersproject/bignumber";
import { BytesLike } from "@ethersproject/bytes";
import { Contract } from "@ethersproject/contracts";
import { Network, getNetwork } from "@ethersproject/networks";
import { BaseProvider } from "@ethersproject/providers";

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

  getEthBalance(addr: string, overrides?: BatchableOverrides): Promise<BigNumber>;
}

interface BatchedCalls {
  blockTag: BlockTag;
  calls: CallRequest[];
  callbacks: [(resolveValue: string) => void, (rejectReason: unknown) => void][];
}

const emptyBatch = (): BatchedCalls => ({ blockTag: "latest", calls: [], callbacks: [] });

const batchableCall = (transaction: TransactionRequest) =>
  transaction.from === undefined &&
  transaction.gasLimit === undefined &&
  transaction.gasPrice === undefined &&
  transaction.value === undefined;

const batchedCall = (transaction: TransactionRequest, multicallAddress: string) =>
  transaction.to === multicallAddress &&
  typeof transaction.data === "string" &&
  transaction.data.startsWith("0x252dba42"); // signature of `aggregate((address,bytes)[])`

interface CallParams {
  transaction: TransactionRequest;
  blockTag: BlockTag;
}

interface GetBalanceParams {
  address: string;
  blockTag: BlockTag;
}

export class BatchedProvider extends BaseProvider {
  readonly underlyingProvider;
  readonly chainId;
  readonly batchingDelayMs;

  _debugLog = false;

  private _multicall?: Multicall;
  private _timeoutId?: ReturnType<typeof setTimeout>;
  private _batched: BatchedCalls = emptyBatch();

  private _numberOfBatchedCalls = 0;
  private _numberOfActualCalls = 0;
  private _timeOfLastRatioCheck?: number;

  constructor(underlyingProvider: BaseProvider, chainId = 0, batchingDelayMs = 10) {
    super(getNetwork(chainId));

    this.underlyingProvider = underlyingProvider;
    this.chainId = chainId;
    this.batchingDelayMs = batchingDelayMs;

    if (hasMulticall(chainId)) {
      this._multicall = new Contract(multicallAddress[chainId], multicallAbi, this) as Multicall;
    }
  }

  async _dispatchCalls() {
    const { calls, callbacks, blockTag } = this._batched;
    this._batched = emptyBatch();

    assert(this._multicall);

    try {
      const results =
        calls.length > 1
          ? await this._multicall.callStatic.aggregate(calls, { blockTag }).then(x => x.returnData)
          : [
              await this.underlyingProvider.perform("call", {
                transaction: {
                  to: calls[0].target,
                  data: calls[0].callData
                },
                blockTag
              })
            ];

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

  _alreadyBatchedCallsConflictWith(blockTag: BlockTag) {
    return this._batched.calls.length !== 0 && blockTag !== this._batched.blockTag;
  }

  private _checkBatchingRatio() {
    const now = new Date().getTime();

    if (this._timeOfLastRatioCheck === undefined) {
      this._timeOfLastRatioCheck = now;
    } else {
      const timeSinceLastRatioCheck = now - this._timeOfLastRatioCheck;

      if (timeSinceLastRatioCheck >= 10000 && this._numberOfActualCalls) {
        if (this._debugLog) {
          console.log(
            `Call batching ratio: ${
              Math.round((10 * this._numberOfBatchedCalls) / this._numberOfActualCalls) / 10
            }X`
          );
        }

        this._numberOfBatchedCalls = 0;
        this._numberOfActualCalls = 0;
        this._timeOfLastRatioCheck = now;
      }
    }
  }

  private async _performCall(params: CallParams): Promise<string> {
    if (!this._multicall) {
      return this.underlyingProvider.perform("call", params);
    }

    this._checkBatchingRatio();

    if (
      batchedCall(params.transaction, this._multicall.address) ||
      !batchableCall(params.transaction) ||
      this._alreadyBatchedCallsConflictWith(params.blockTag)
    ) {
      this._numberOfActualCalls++;

      return this.underlyingProvider.perform("call", params);
    } else {
      this._numberOfBatchedCalls++;

      if (this._batched.calls.length === 0) {
        this._batched.blockTag = params.blockTag;
      }

      assert(params.transaction.to !== undefined);
      assert(params.transaction.data !== undefined);

      return this._enqueueCall({
        target: params.transaction.to,
        callData: params.transaction.data
      });
    }
  }

  private async _performGetBalance(params: GetBalanceParams): Promise<BigNumber> {
    if (!this._multicall) {
      return this.underlyingProvider.perform("getBalance", params);
    }

    return this._multicall.getEthBalance(params.address, { blockTag: params.blockTag });
  }

  async perform(method: string, params: unknown): Promise<unknown> {
    switch (method) {
      case "call":
        return this._performCall(params as CallParams);
      case "getBalance":
        return this._performGetBalance(params as GetBalanceParams);
      default:
        return this.underlyingProvider.perform(method, params);
    }
  }

  detectNetwork(): Promise<Network> {
    return this.underlyingProvider.detectNetwork();
  }
}
