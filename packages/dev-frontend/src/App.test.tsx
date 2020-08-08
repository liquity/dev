import React from "react";
import { render, fireEvent } from "@testing-library/react";
import App from "./App";

/*
 * Just a quick and dirty testcase to prove that the approach can work in our CI pipeline.
 */
test("there's no smoke", async () => {
  const { getByText, getByLabelText, findByText, queryByText } = render(<App />);

  expect(await findByText(/open a new liquity trove/i)).toBeInTheDocument();
  expect(await findByText(/there are no troves yet/i)).toBeInTheDocument();

  fireEvent.click(getByLabelText(/^collateral$/i));
  fireEvent.change(getByLabelText(/^collateral$/i), { target: { value: "1" } });
  fireEvent.click(getByText(/open new trove/i));

  expect(queryByText(/open new trove/i)).not.toBeInTheDocument();
  expect(await findByText(/my liquity trove/i)).toBeInTheDocument();
  expect(await findByText(/1-1 of 1/i)).toBeInTheDocument();
});
