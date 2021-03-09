enum BorrowerOperation {
  openTrove,
  closeTrove,
  adjustTrove
}

export function getTroveOperationFromBorrowerOperation(operation: BorrowerOperation): string {
  switch (operation) {
    case BorrowerOperation.openTrove:
      return "openTrove";
    case BorrowerOperation.closeTrove:
      return "closeTrove";
    case BorrowerOperation.adjustTrove:
      return "adjustTrove";
  }

  // AssemblyScript can't tell we will never reach this, so it insists on a return statement
  return "unreached";
}

export function isBorrowerOperation(troveOperation: string): boolean {
  return (
    troveOperation == "openTrove" ||
    troveOperation == "closeTrove" ||
    troveOperation == "adjustTrove"
  );
}

enum TroveManagerOperation {
  applyPendingRewards,
  liquidateInNormalMode,
  liquidateInRecoveryMode,
  redeemCollateral
}

export function getTroveOperationFromTroveManagerOperation(
  operation: TroveManagerOperation
): string {
  switch (operation) {
    case TroveManagerOperation.applyPendingRewards:
      return "accrueRewards";
    case TroveManagerOperation.liquidateInNormalMode:
      return "liquidateInNormalMode";
    case TroveManagerOperation.liquidateInRecoveryMode:
      return "liquidateInRecoveryMode";
    case TroveManagerOperation.redeemCollateral:
      return "redeemCollateral";
  }

  // AssemblyScript can't tell we will never reach this, so it insists on a return statement
  return "unreached";
}

export function isLiquidation(troveOperation: string): boolean {
  return troveOperation == "liquidateInNormalMode" || troveOperation == "liquidateInRecoveryMode";
}

export function isRecoveryModeLiquidation(troveOperation: string): boolean {
  return troveOperation == "liquidateInRecoveryMode";
}

export function isRedemption(troveOperation: string): boolean {
  return troveOperation == "redeemCollateral";
}
