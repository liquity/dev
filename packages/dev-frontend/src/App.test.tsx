import React from "react";
import { render, fireEvent } from "@testing-library/react";

import { Decimal, LUSD_MINIMUM_NET_DEBT, Trove } from "@liquity/lib-base";

import App from "./App";

const TEST_TIMEOUT = 5000;
const params = { depositCollateral: Decimal.from(20), borrow1USD: LUSD_MINIMUM_NET_DEBT };
const trove = Trove.create(params);

jest.setTimeout(TEST_TIMEOUT);

console.log(`${trove}`);

/*
 * Just a quick and dirty testcase to prove that the approach can work in our CI pipeline.
 */
test("there's no smoke", async () => {
  const { getByText, getByLabelText, findByText } = render(<App />);

  expect(
    await findByText(/you can borrow lusd by opening a trove/i, undefined, {
      timeout: TEST_TIMEOUT
    })
  ).toBeInTheDocument();

  fireEvent.click(getByText(/open trove/i));
  fireEvent.click(getByLabelText(/collateral/i));
  fireEvent.change(getByLabelText(/^collateral$/i), { target: { value: `${trove.collateral}` } });
  fireEvent.click(getByLabelText(/^borrow$/i));
  fireEvent.change(getByLabelText(/^borrow$/i), { target: { value: `${trove.debt}` } });

  const confirmButton = await findByText(/confirm/i);
  fireEvent.click(confirmButton);

  expect(await findByText(/adjust/i)).toBeInTheDocument();
});
