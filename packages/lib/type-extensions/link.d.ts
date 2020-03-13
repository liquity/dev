/// <reference types="truffle-typings" />

declare namespace Truffle {
  interface Contract {
    link(library: ContractInstance): void;
  }
}
