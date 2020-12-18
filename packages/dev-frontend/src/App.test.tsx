import React from "react";
import { render, fireEvent } from "@testing-library/react";
import App from "./App";

/*
 * Just a quick and dirty testcase to prove that the approach can work in our CI pipeline.
 */
test("there's no smoke", async () => {
  const { getByText, getByLabelText, findByText, queryByText } = render(<App />);

  expect(await findByText(/open a trove to borrow lusd/i)).toBeInTheDocument();
  expect(await findByText(/there are no troves yet/i)).toBeInTheDocument();

  fireEvent.click(getByLabelText(/^collateral$/i));
  fireEvent.change(getByLabelText(/^collateral$/i), { target: { value: "1" } });
  fireEvent.click(getByLabelText(/^debt$/i));
  fireEvent.change(getByLabelText(/^debt$/i), { target: { value: "100" } });

  const openTroveButton = /^deposit 1(\.[0-9]+)? eth & borrow 90(\.[0-9]+) lusd$/i;
  fireEvent.click(getByText(openTroveButton));

  expect(queryByText(openTroveButton)).not.toBeInTheDocument();
  expect(await findByText(/my trove/i)).toBeInTheDocument();
  expect(await findByText(/1-1 of 1/i)).toBeInTheDocument();
});
