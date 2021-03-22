import {
  Decimal,
  LUSD_MINIMUM_DEBT,
  Trove,
  TroveAdjustmentParams,
  TroveChange,
  Percent,
  MINIMUM_COLLATERAL_RATIO,
  CRITICAL_COLLATERAL_RATIO,
  LiquityStoreState
} from "@liquity/lib-base";

import { COIN } from "../../../strings";

import { ActionDescription, Amount } from "../../ActionDescription";
import { ErrorDescription } from "../../ErrorDescription";

const mcrPercent = new Percent(MINIMUM_COLLATERAL_RATIO).toString(0);
const ccrPercent = new Percent(CRITICAL_COLLATERAL_RATIO).toString(0);

type TroveAdjustmentDescriptionParams = {
  params: TroveAdjustmentParams<Decimal>;
};

const TroveAdjustmentDescription: React.FC<TroveAdjustmentDescriptionParams> = ({ params }) => (
  <ActionDescription>
    {params.depositCollateral && params.borrowLUSD ? (
      <>
        You will deposit <Amount>{params.depositCollateral.prettify()} ETH</Amount> and receive{" "}
        <Amount>
          {params.borrowLUSD.prettify()} {COIN}
        </Amount>
      </>
    ) : params.repayLUSD && params.withdrawCollateral ? (
      <>
        You will pay{" "}
        <Amount>
          {params.repayLUSD.prettify()} {COIN}
        </Amount>{" "}
        and receive <Amount>{params.withdrawCollateral.prettify()} ETH</Amount>
      </>
    ) : params.depositCollateral && params.repayLUSD ? (
      <>
        You will deposit <Amount>{params.depositCollateral.prettify()} ETH</Amount> and pay{" "}
        <Amount>
          {params.repayLUSD.prettify()} {COIN}
        </Amount>
      </>
    ) : params.borrowLUSD && params.withdrawCollateral ? (
      <>
        You will receive <Amount>{params.withdrawCollateral.prettify()} ETH</Amount> and{" "}
        <Amount>
          {params.borrowLUSD.prettify()} {COIN}
        </Amount>
      </>
    ) : params.depositCollateral ? (
      <>
        You will deposit <Amount>{params.depositCollateral.prettify()} ETH</Amount>
      </>
    ) : params.withdrawCollateral ? (
      <>
        You will receive <Amount>{params.withdrawCollateral.prettify()} ETH</Amount>
      </>
    ) : params.borrowLUSD ? (
      <>
        You will receive{" "}
        <Amount>
          {params.borrowLUSD.prettify()} {COIN}
        </Amount>
      </>
    ) : (
      <>
        You will pay{" "}
        <Amount>
          {params.repayLUSD.prettify()} {COIN}
        </Amount>
      </>
    )}
    .
  </ActionDescription>
);

export const selectForTroveChangeValidation = ({
  price,
  total,
  lusdBalance,
  numberOfTroves
}: LiquityStoreState) => ({ price, total, lusdBalance, numberOfTroves });

type TroveChangeValidationContext = ReturnType<typeof selectForTroveChangeValidation>;

export const validateTroveChange = (
  original: Trove,
  edited: Trove,
  borrowingRate: Decimal,
  { price, total, lusdBalance, numberOfTroves }: TroveChangeValidationContext
): [
  validChange: Exclude<TroveChange<Decimal>, { type: "invalidCreation" }> | undefined,
  description: JSX.Element | undefined
] => {
  const change = original.whatChanged(edited, borrowingRate);
  // Reapply change to get the exact state the Trove will end up in (which could be slightly
  // different from `edited` due to imprecision).
  const afterFee = original.apply(change, borrowingRate);

  if (!change) {
    return [undefined, undefined];
  }

  if (
    change.type === "invalidCreation" ||
    (change.type !== "closure" && afterFee.debt.lt(LUSD_MINIMUM_DEBT))
  ) {
    return [
      undefined,
      <ErrorDescription>
        Debt must be be at least{" "}
        <Amount>
          {LUSD_MINIMUM_DEBT.toString()} {COIN}
        </Amount>
        .
      </ErrorDescription>
    ];
  }

  if (
    (change.type === "creation" ||
      (change.type === "adjustment" &&
        (change.params.withdrawCollateral || change.params.borrowLUSD))) &&
    afterFee.collateralRatioIsBelowMinimum(price)
  ) {
    return [
      undefined,
      <ErrorDescription>
        Collateral ratio must be at least <Amount>{mcrPercent}</Amount>.
      </ErrorDescription>
    ];
  }

  if (
    (change.type === "creation" || change.type === "adjustment") &&
    !total.collateralRatioIsBelowCritical(price) &&
    total.subtract(original).add(afterFee).collateralRatioIsBelowCritical(price)
  ) {
    return [
      undefined,
      change.type === "creation" ? (
        <ErrorDescription>
          You're not allowed to open a Trove that would cause the total collateral ratio to fall
          below <Amount>{ccrPercent}</Amount>. Please increase your collateral ratio.
        </ErrorDescription>
      ) : (
        <ErrorDescription>
          The adjustment you're trying to make would cause the total collateral ratio to fall below{" "}
          <Amount>{ccrPercent}</Amount>. Please increase your collateral ratio.
        </ErrorDescription>
      )
    ];
  }

  if (change.params.repayLUSD?.gt(lusdBalance)) {
    return [
      undefined,
      edited.isEmpty ? (
        <ErrorDescription>
          You need{" "}
          <Amount>
            {change.params.repayLUSD.sub(lusdBalance).prettify()} {COIN}
          </Amount>{" "}
          more to close your Trove.
        </ErrorDescription>
      ) : (
        <ErrorDescription>
          The amount you're trying to repay exceeds your balance by{" "}
          <Amount>
            {change.params.repayLUSD.sub(lusdBalance).prettify()} {COIN}
          </Amount>
          .
        </ErrorDescription>
      )
    ];
  }

  if (
    change.type === "creation" &&
    total.collateralRatioIsBelowCritical(price) &&
    !afterFee.isOpenableInRecoveryMode(price)
  ) {
    return [
      undefined,
      <ErrorDescription>
        You're not allowed to open a Trove with less than <Amount>{ccrPercent}</Amount> collateral
        ratio during recovery mode. Please increase your collateral ratio.
      </ErrorDescription>
    ];
  }

  if (change.type === "closure" && total.collateralRatioIsBelowCritical(price)) {
    return [
      undefined,
      <ErrorDescription>
        You're not allowed to close your Trove during recovery mode.
      </ErrorDescription>
    ];
  }

  if (change.type === "closure" && numberOfTroves === 1) {
    return [
      undefined,
      <ErrorDescription>
        You're not allowed to close your Trove when there are no other Troves in the system.
      </ErrorDescription>
    ];
  }

  if (
    change.type === "adjustment" &&
    total.collateralRatioIsBelowCritical(price) &&
    afterFee.collateralRatio(price).lt(original.collateralRatio(price))
  ) {
    return [
      undefined,
      <ErrorDescription>
        You're not allowed to decrease your collateral ratio during recovery mode.
      </ErrorDescription>
    ];
  }

  return [change, <TroveAdjustmentDescription params={change.params} />];
};
