## Math proofs and derivations

The Liquity implementation relies on some important system properties and mathematical derivations, available here as PDFs.

In particular, we have:

- A proof that an equal collateral ratio between two CDPs is maintained throughout a series of liquidations and new loan issuances
- A proof that CDP ordering is maintained throughout a series of liquidations and new loan issuances
- A derivation of a formula and implementation for a highly scalable (O(1) complexity) reward distribution in the Stability Pool, involving compounding and decreasing stakes.
