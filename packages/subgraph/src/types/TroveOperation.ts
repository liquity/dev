enum BorrowerOperation {
  openTrove,
  closeTrove,
  addColl,
  withdrawColl,
  withdrawLUSD,
  repayLUSD,
  adjustTrove
}

export function getTroveOperationFromBorrowerOperation(operation: BorrowerOperation): string {
  switch (operation) {
    case BorrowerOperation.openTrove:
      return "openTrove";
    case BorrowerOperation.closeTrove:
      return "closeTrove";
    case BorrowerOperation.addColl:
      return "depositCollateral";
    case BorrowerOperation.withdrawColl:
      return "withdrawCollateral";
    case BorrowerOperation.withdrawLUSD:
      return "mint";
    case BorrowerOperation.repayLUSD:
      return "repay";
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
    troveOperation == "depositCollateral" ||
    troveOperation == "withdrawCollateral" ||
    troveOperation == "mint" ||
    troveOperation == "repay" ||
    troveOperation == "adjustTrove"
  );
}

enum TroveManagerOperation {
  applyPendingRewards,
  liquidateInNormalMode,
  liquidateInRecoveryMode,
  partiallyLiquidateInRecoveryMode,
  redeemCollateral
}

export function getTroveOperationFromTroveManagerOperation(operation: TroveManagerOperation): string {
  switch (operation) {
    case TroveManagerOperation.applyPendingRewards:
      return "accrueRewards";
    case TroveManagerOperation.liquidateInNormalMode:
      return "liquidateInNormalMode";
    case TroveManagerOperation.liquidateInRecoveryMode:
      return "liquidateInRecoveryMode";
    case TroveManagerOperation.partiallyLiquidateInRecoveryMode:
      return "partiallyLiquidateInRecoveryMode";
    case TroveManagerOperation.redeemCollateral:
      return "redeemCollateral";
  }

  // AssemblyScript can't tell we will never reach this, so it insists on a return statement
  return "unreached";
}

export function isLiquidation(troveOperation: string): boolean {
  return (
    troveOperation == "liquidateInNormalMode" ||
    troveOperation == "liquidateInRecoveryMode" ||
    troveOperation == "partiallyLiquidateInRecoveryMode"
  );
}

export function isRecoveryModeLiquidation(troveOperation: string): boolean {
  return (
    troveOperation == "liquidateInRecoveryMode" ||
    troveOperation == "partiallyLiquidateInRecoveryMode"
  );
}

export function isRedemption(troveOperation: string): boolean {
  return troveOperation == "redeemCollateral";
}
