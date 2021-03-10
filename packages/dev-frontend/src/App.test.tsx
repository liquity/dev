import React from "react";
import { render, fireEvent } from "@testing-library/react";

import { Decimal, LUSD_MINIMUM_NET_DEBT, Trove } from "@liquity/lib-base";

import App from "./App";

const params = { depositCollateral: Decimal.from(20), borrowLUSD: LUSD_MINIMUM_NET_DEBT };
const trove = Trove.create(params);

console.log(`${trove}`);

/*
 * Just a quick and dirty testcase to prove that the approach can work in our CI pipeline.
 */
test("there's no smoke", async () => {
  const { getByText, getByLabelText, findByText, queryByText } = render(<App />);

  expect(await findByText(/open a trove to borrow lusd/i)).toBeInTheDocument();
  expect(await findByText(/there are no troves yet/i)).toBeInTheDocument();

  fireEvent.click(getByLabelText(/^collateral$/i));
  fireEvent.change(getByLabelText(/^collateral$/i), { target: { value: `${trove.collateral}` } });
  fireEvent.click(getByLabelText(/^debt$/i));
  fireEvent.change(getByLabelText(/^debt$/i), { target: { value: `${trove.debt}` } });

  const openTroveButton = new RegExp(
    `^deposit ${params.depositCollateral.prettify()} eth & ` +
      `borrow ${params.borrowLUSD.prettify()} lusd$`,
    "i"
  );
  fireEvent.click(getByText(openTroveButton));

  expect(queryByText(openTroveButton)).not.toBeInTheDocument();
  expect(await findByText(/my trove/i)).toBeInTheDocument();
  expect(await findByText(/1-1 of 1/i)).toBeInTheDocument();
});
