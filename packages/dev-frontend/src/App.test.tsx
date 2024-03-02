import { expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { userEvent, PointerEventsCheckLevel } from "@testing-library/user-event";

import { Decimal, LUSD_MINIMUM_NET_DEBT, Trove } from "@liquity/lib-base";

import App from "./App";

const params = { depositCollateral: Decimal.from(20), borrowLUSD: LUSD_MINIMUM_NET_DEBT };
const trove = Trove.create(params);

/*
 * Just a quick and dirty testcase to prove that the approach can work in our CI pipeline.
 */
test("there's no smoke", async () => {
  render(<App />);

  await userEvent.click(await screen.findByText(/connect wallet/i));

  // pointer-events check fails under happy-dom, for whatever reason
  await userEvent.click(await screen.findByText(/browser wallet/i), {
    pointerEventsCheck: PointerEventsCheckLevel.Never
  });

  expect(await screen.findByText(/you can borrow lusd by opening a trove/i)).toBeInTheDocument();

  await userEvent.click(screen.getByText(/open trove/i));
  await userEvent.click(screen.getByLabelText(/collateral/i));
  await userEvent.clear(screen.getByLabelText(/collateral/i));
  await userEvent.type(screen.getByLabelText(/collateral/i), `${trove.collateral}`);
  await userEvent.click(screen.getByLabelText(/borrow/i));
  await userEvent.clear(screen.getByLabelText(/borrow/i));
  await userEvent.type(screen.getByLabelText(/borrow/i), `${trove.debt}`);
  await userEvent.click(await screen.findByText(/confirm/i));

  expect(await screen.findByText(/adjust/i)).toBeInTheDocument();
});
