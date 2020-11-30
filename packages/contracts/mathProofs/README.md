## Math proofs and derivations

The Liquity implementation relies on some important system properties and mathematical derivations, available here as PDFs.

In particular, we have:

1. A proof that an equal collateral ratio between two Troves is maintained throughout a series of liquidations and new trove issuances
2. A proof that Trove ordering is maintained throughout a series of liquidations and new trove issuances (follows on from Proof 1)
3. A derivation of a formula and implementation for a highly scalable (O(1) complexity) reward distribution in the Stability Pool, involving compounding and decreasing stakes.
