import { BigNumberish } from "@ethersproject/bignumber";
import { Web3Provider, TransactionRequest, BlockTag } from "@ethersproject/providers";
import { BytesLike } from "@ethersproject/bytes";
import { Contract } from "@ethersproject/contracts";

import { DEV_CHAIN_ID } from "./contracts";

const multiCallerAddressOnChain: {
  [chainId: number]: string;
} = {
  3: "0xdDB3aEa04Ac270880df386479850669C77b59E11",
  // 4: ,
  // 5: ,
  // 42: ,

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

export class BatchedWeb3Provider extends Web3Provider {
  batchingDelayMs = 10;

  private multiCaller: MultiCaller | undefined;

  private timeoutId: ReturnType<typeof setTimeout> | undefined = undefined;
  private batched: BatchedCalls = emptyBatch();

  setChainId(chainId: number) {
    if (this.multiCaller !== undefined) {
      throw new Error("can only set chainId once");
    }

    if (chainId in multiCallerAddressOnChain) {
      this.multiCaller = new Contract(
        multiCallerAddressOnChain[chainId],
        multiCallerAbi,
        this
      ) as MultiCaller;
    }
  }

  private async dispatchCalls() {
    const { calls, callbacks, from, blockTag } = this.batched;
    this.batched = emptyBatch();

    try {
      if (calls.length > 1) {
        console.log(`Batching ${calls.length} calls`);
      }

      const results =
        calls.length > 1
          ? await this.multiCaller!.performMultiple(calls, { from, blockTag })
          : [await super.call({ from, to: calls[0].to, data: calls[0].data }, blockTag)];

      callbacks.forEach(([resolve], i) => resolve(results[i]));
    } catch (error) {
      callbacks.forEach(([, reject]) => reject(error));
    }
  }

  private enqueueCall(call: CallRequest) {
    if (this.timeoutId !== undefined) {
      clearTimeout(this.timeoutId);
    }
    this.timeoutId = setTimeout(() => this.dispatchCalls(), this.batchingDelayMs);

    this.batched.calls.push(call);

    return new Promise<string>((resolve, reject) => this.batched.callbacks.push([resolve, reject]));
  }

  private conflicts(request: ResolvedTransactionRequest, blockTag?: BlockTag) {
    if (this.batched.calls.length === 0) {
      return false;
    }

    return request.from !== this.batched.from || blockTag !== this.batched.blockTag;
  }

  async call(
    request: TransactionRequest | Promise<TransactionRequest>,
    blockTag?: BlockTag | Promise<BlockTag>
  ) {
    if (!this.multiCaller) {
      return super.call(request, blockTag);
    }

    [request, blockTag] = await Promise.all([request, blockTag]);
    const resolvedRequest = await resolveRequest(request);

    if (
      resolvedRequest.to === this.multiCaller.address ||
      !batchableCall(resolvedRequest) ||
      this.conflicts(resolvedRequest, blockTag)
    ) {
      return super.call(resolvedRequest, blockTag);
    } else {
      if (this.batched.calls.length === 0) {
        this.batched.from = resolvedRequest.from;
        this.batched.blockTag = blockTag;
      }
      return this.enqueueCall({ to: resolvedRequest.to!, data: resolvedRequest.data! });
    }
  }
}
