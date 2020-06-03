import React from "react";
import { render, fireEvent } from "@testing-library/react";
import App from "./App";

test("there's no smoke", async () => {
  const { getByText, getByTestId, findByText, queryByText } = render(<App />);

  expect(await findByText(/open a new liquity trove/i)).toBeInTheDocument();
  expect(await findByText(/there are no troves yet/i)).toBeInTheDocument();

  fireEvent.click(getByTestId(/^collateral$/i));
  fireEvent.change(getByTestId(/^collateral$/i), { target: { value: "1" } });
  fireEvent.click(getByText(/open new trove/i));

  expect(queryByText(/open new trove/i)).not.toBeInTheDocument();
  expect(await findByText(/your liquity trove/i)).toBeInTheDocument();
});
