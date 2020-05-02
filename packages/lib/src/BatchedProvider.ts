import { BigNumberish } from "@ethersproject/bignumber";
import { Provider } from "@ethersproject/abstract-provider";
import {
  BaseProvider,
  Web3Provider,
  WebSocketProvider,
  TransactionRequest,
  BlockTag
} from "@ethersproject/providers";
import { BytesLike } from "@ethersproject/bytes";
import { Contract } from "@ethersproject/contracts";

import { DEV_CHAIN_ID } from "./contracts";

const multiCallerAddressOnChain: {
  [chainId: number]: string;
} = {
  3: "0xdDB3aEa04Ac270880df386479850669C77b59E11",
  4: "0x32C223BF623816e7AF33cDb5B4937fae948cA7F6",
  5: "0xB845bF75bc3BC73beEFf5451a7a724CF552BDF7C",
  42: "0xaEcb9EA73E58814728b42E7C3AA00073F52acC7F",

  [DEV_CHAIN_ID]: "0xE59a3bB2079dE83809a5D61bA5609ad83726a251"
};

const multiCallerAbi = [
  {
    type: "function",
    name: "performMultiple",
    stateMutability: "view",
    inputs: [
      {
        type: "tuple[]",
        name: "calls",
        components: [
          {
            type: "address",
            name: "to"
          },
          {
            type: "bytes",
            name: "data"
          }
        ]
      }
    ],
    outputs: [
      {
        type: "bytes[]",
        name: "results"
      }
    ]
  }
];

declare class MultiCaller extends Contract {
  performMultiple(
    calls: { to: string; data: BytesLike }[],
    overrides?: { from?: string; blockTag?: BlockTag }
  ): Promise<string[]>;
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

const resolveRequest = async (request: TransactionRequest): Promise<ResolvedTransactionRequest> => {
  const values = Object.values(request);

  if (values.every(value => !(value instanceof Promise))) {
    return request as ResolvedTransactionRequest;
  }

  const keys = Object.keys(request);
  const resolvedValues = await Promise.all(values);

  return Object.fromEntries(resolvedValues.map((value, i) => [keys[i], value]));
};

type CallRequest = {
  to: string;
  data: BytesLike;
};

type BatchedCalls = {
  calls: CallRequest[];
  callbacks: [(resolveValue: string) => void, (rejectReason: any) => void][];

  from?: string;
  blockTag?: BlockTag;
};

const emptyBatch = (): BatchedCalls => ({ calls: [], callbacks: [] });

const batchableCall = (request: ResolvedTransactionRequest) =>
  request.gasLimit === undefined && request.gasPrice === undefined && request.value === undefined;

export interface BatchedProvider extends BaseProvider {
  batchingDelayMs: number;
  chainId: number;
}

const batchedProviders: any[] = [];

export const isBatchedProvider = (provider: Provider): provider is BatchedProvider =>
  batchedProviders.some(batchedProvider => provider instanceof batchedProvider);

const Batched = <T extends new (...args: any[]) => BaseProvider>(Base: T) => {
  const batchedProvider = class extends Base implements BatchedProvider {
    batchingDelayMs = 10;

    _multiCaller: MultiCaller | undefined;
    _timeoutId: any = undefined;
    _batched: BatchedCalls = emptyBatch();

    set chainId(chainId: number) {
      if (this._multiCaller !== undefined) {
        throw new Error("can only set chainId once");
      }

      if (chainId in multiCallerAddressOnChain) {
        this._multiCaller = new Contract(
          multiCallerAddressOnChain[chainId],
          multiCallerAbi,
          this
        ) as MultiCaller;
      }
    }

    async _dispatchCalls() {
      const { calls, callbacks, from, blockTag } = this._batched;
      this._batched = emptyBatch();

      try {
        if (calls.length > 1) {
          console.log(`Batching ${calls.length} calls`);
        }

        const results =
          calls.length > 1
            ? await this._multiCaller!.performMultiple(calls, { from, blockTag })
            : [await super.call({ from, to: calls[0].to, data: calls[0].data }, blockTag)];

        callbacks.forEach(([resolve], i) => resolve(results[i]));
      } catch (error) {
        callbacks.forEach(([, reject]) => reject(error));
      }
    }

    _enqueueCall(call: CallRequest) {
      if (this._timeoutId !== undefined) {
        clearTimeout(this._timeoutId);
      }
      this._timeoutId = setTimeout(() => this._dispatchCalls(), this.batchingDelayMs);

      this._batched.calls.push(call);

      return new Promise<string>((resolve, reject) =>
        this._batched.callbacks.push([resolve, reject])
      );
    }

    _alreadyBatchedCallsConflictWith(request: ResolvedTransactionRequest, blockTag?: BlockTag) {
      if (this._batched.calls.length === 0) {
        return false;
      }

      return request.from !== this._batched.from || blockTag !== this._batched.blockTag;
    }

    async call(
      request: TransactionRequest | Promise<TransactionRequest>,
      blockTag?: BlockTag | Promise<BlockTag>
    ) {
      if (!this._multiCaller) {
        return super.call(request, blockTag);
      }

      [request, blockTag] = await Promise.all([request, blockTag]);
      const resolvedRequest = await resolveRequest(request);

      if (
        resolvedRequest.to === this._multiCaller.address ||
        !batchableCall(resolvedRequest) ||
        this._alreadyBatchedCallsConflictWith(resolvedRequest, blockTag)
      ) {
        return super.call(resolvedRequest, blockTag);
      } else {
        if (this._batched.calls.length === 0) {
          this._batched.from = resolvedRequest.from;
          this._batched.blockTag = blockTag;
        }
        return this._enqueueCall({ to: resolvedRequest.to!, data: resolvedRequest.data! });
      }
    }
  };

  batchedProviders.push(batchedProvider);

  return batchedProvider;
};

export const BatchedWeb3Provider = Batched(Web3Provider);
export const BatchedWebSocketProvider = Batched(WebSocketProvider);
