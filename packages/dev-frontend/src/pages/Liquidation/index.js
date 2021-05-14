import { useState, useEffect, useCallback } from "react";
import cn from "classnames";

import { Percent, MINIMUM_COLLATERAL_RATIO, CRITICAL_COLLATERAL_RATIO } from "@liquity/lib-base";

import { useLiquitySelector } from "@liquity/lib-react";

import { shortenAddress } from "../../utils/shortenAddress";
import { useLiquity } from "../../hooks/LiquityContext";
import { COIN, ETH } from "../../strings";

import { LoadingOverlay } from "../../components/LoadingOverlay";
import { Transaction } from "../../components/Transaction";
import { LiquidationManager } from "../../components/LiquidationManager";
import Button from "../../components/Button";
import { InfoIcon } from "../../components/InfoIcon";
import { Spinner } from "../../components/Loader";
import CopyToClipboard from "../../components/CopyToClipboard";

import classes from "./Liquidation.module.css";

const liquidatableInNormalMode = (trove, price) => [
  trove.collateralRatioIsBelowMinimum(price),
  "Collateral ratio not low enough"
];

const getColor = ratio =>
  ratio?.gt(CRITICAL_COLLATERAL_RATIO)
    ? "success"
    : ratio?.gt(1.2)
    ? "warning"
    : ratio?.lte(1.2)
    ? "danger"
    : "muted";

const liquidatableInRecoveryMode = (trove, price, totalCollateralRatio, lusdInStabilityPool) => {
  const collateralRatio = trove.collateralRatio(price);

  if (collateralRatio.gte(MINIMUM_COLLATERAL_RATIO) && collateralRatio.lt(totalCollateralRatio)) {
    return [
      trove.debt.lte(lusdInStabilityPool),
      "There's not enough LUSD in the Stability pool to cover the debt"
    ];
  } else {
    return liquidatableInNormalMode(trove, price);
  }
};

const select = ({ numberOfTroves, price, total, lusdInStabilityPool, blockTag }) => ({
  numberOfTroves,
  price,
  recoveryMode: total.collateralRatioIsBelowCritical(price),
  totalCollateralRatio: total.collateralRatio(price),
  lusdInStabilityPool,
  blockTag
});

const RiskyTroves = ({ pageSize = 10 }) => {
  const {
    blockTag,
    numberOfTroves,
    recoveryMode,
    totalCollateralRatio,
    lusdInStabilityPool,
    price
  } = useLiquitySelector(select);
  const { liquity } = useLiquity();

  const [loading, setLoading] = useState(true);
  const [troves, setTroves] = useState();

  const [reload, setReload] = useState({});
  const forceReload = useCallback(() => setReload({}), []);

  const [page, setPage] = useState(0);
  const numberOfPages = Math.ceil(numberOfTroves / pageSize) || 1;
  const clampedPage = Math.min(page, numberOfPages - 1);

  const nextPage = () => {
    if (clampedPage < numberOfPages - 1) {
      setPage(clampedPage + 1);
    }
  };

  const previousPage = () => {
    if (clampedPage > 0) {
      setPage(clampedPage - 1);
    }
  };

  const goToLastPage = () => {
    setPage(numberOfPages - 1);
  };

  const goToFirstPage = () => {
    setPage(0);
  };

  useEffect(() => {
    if (page !== clampedPage) {
      setPage(clampedPage);
    }
  }, [page, clampedPage]);

  useEffect(() => {
    let mounted = true;

    setLoading(true);

    liquity
      .getTroves(
        {
          first: pageSize,
          sortedBy: "ascendingCollateralRatio",
          startingAt: clampedPage * pageSize
        },
        { blockTag }
      )
      .then(troves => {
        if (mounted) {
          setTroves(troves);
          setLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
    // Omit blockTag from deps on purpose
    // eslint-disable-next-line
  }, [liquity, clampedPage, pageSize, reload]);

  useEffect(() => {
    forceReload();
  }, [forceReload, numberOfTroves]);

  const [copied, setCopied] = useState();

  useEffect(() => {
    if (copied !== undefined) {
      let cancelled = false;

      setTimeout(() => {
        if (!cancelled) {
          setCopied(undefined);
        }
      }, 2000);

      return () => {
        cancelled = true;
      };
    }
  }, [copied]);

  return (
    <div className={classes.wrapper}>
      <h1 className={classes.header}>Risky Troves</h1>
      <div className={classes.heading}>
        {numberOfTroves !== 0 && (
          <>
            <LiquidationManager />

            <p className={classes.pageNum}>
              {clampedPage * pageSize + 1}-{Math.min((clampedPage + 1) * pageSize, numberOfTroves)}{" "}
              of {numberOfTroves}
            </p>

            {page > 0 && (
              <Button secondary uppercase className={classes.goToLast} onClick={goToFirstPage}>
                first page
              </Button>
            )}

            <Button
              className={classes.arrowButton}
              onClick={previousPage}
              disabled={clampedPage <= 0}
            >
              <ion-icon name="chevron-back-outline"></ion-icon>
            </Button>

            <Button
              className={classes.arrowButton}
              onClick={nextPage}
              disabled={clampedPage >= numberOfPages - 1}
            >
              <ion-icon name="chevron-forward-outline"></ion-icon>
            </Button>

            {page !== numberOfPages - 1 && (
              <Button secondary uppercase className={classes.goToLast} onClick={goToLastPage}>
                last page
              </Button>
            )}

            <Button onClick={forceReload} className={classes.reloadButton}>
              <ion-icon name="refresh-outline"></ion-icon>
            </Button>
          </>
        )}
      </div>

      {!troves || troves.length === 0 ? (
        <div className={classes.noTroves}>
          {!troves ? <Spinner /> : <p className={classes.noTrovesText}>There are no Troves yet.</p>}
        </div>
      ) : (
        <div className={classes.table}>
          <div className={classes.tableHead}>
            <p className={cn(classes.tableHeadText, classes.firstChild)}>Owner</p>
            <div className={classes.tableHeadBox}>
              <p className={classes.tableHeadText}>Collateral</p>
              <p className={classes.tableHeadUnit}>{ETH}</p>
            </div>
            <div className={classes.tableHeadBox}>
              <p className={classes.tableHeadText}>Debt</p>
              <p className={classes.tableHeadUnit}>{COIN}</p>
            </div>
            <p className={classes.tableHeadText}>
              Collateral
              <br />
              Ratio
            </p>
            <div className={classes.tableHeadBox}>
              <p className={classes.tableHeadText}>
                Liquidation
                <br />
                Price <span className={classes.tableHeadUnit}>$</span>
                <InfoIcon tooltip="ETH value in USD at which Trove CR will drop below 110%, and will be liquidated." />
              </p>
            </div>
            <div className={classes.tableHeadBox}>
              <p className={classes.tableHeadText}>Potential Profit</p>
              <p className={classes.tableHeadUnit}>
                {COIN} <InfoIcon tooltip="Profit of liquidation for Stability Pool in LUSD." />
              </p>
            </div>
            <Button disabled className={classes.hiddenButton}>
              Liquidate
            </Button>
          </div>

          <div className={classes.tableBody}>
            {troves.map(trove => {
              const liquidationPrice = trove.debt.mulDiv(1.1, trove.collateral).prettify();

              return (
                !trove.isEmpty && (
                  <div className={classes.tableRow} key={trove.ownerAddress}>
                    <div className={classes.addressData}>
                      <p className={classes.address}>{shortenAddress(trove.ownerAddress)}</p>
                      <CopyToClipboard className={classes.doButton} text={trove.ownerAddress}>
                        <ion-icon name="copy-outline"></ion-icon>
                      </CopyToClipboard>
                    </div>

                    <p className={classes.tableData}>{trove.collateral.prettify(4)}</p>

                    <p className={classes.tableData}>{trove.debt.prettify()}</p>

                    <p
                      className={cn(
                        classes.tableData,
                        classes[getColor(trove.collateralRatio(price))]
                      )}
                    >
                      {new Percent(trove.collateralRatio(price)).prettify()}
                    </p>

                    <p className={classes.tableData}>{liquidationPrice}</p>

                    <p className={classes.tableData}>{trove.debt.mul(0.0945).prettify(0)}</p>

                    <Transaction
                      id={`liquidate-${trove.ownerAddress}`}
                      showFailure="asTooltip"
                      requires={[
                        recoveryMode
                          ? liquidatableInRecoveryMode(
                              trove,
                              price,
                              totalCollateralRatio,
                              lusdInStabilityPool
                            )
                          : liquidatableInNormalMode(trove, price)
                      ]}
                      send={liquity.send.liquidate.bind(liquity.send, trove.ownerAddress)}
                    >
                      <Button className={classes.liquidationButton}>Liquidate</Button>
                    </Transaction>
                  </div>
                )
              );
            })}
          </div>
        </div>
      )}

      {loading && <LoadingOverlay />}
    </div>
  );
};

export default RiskyTroves;
