import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { App } from "./App";

describe("App", () => {
  it("shows a prompt when inputs are incomplete", () => {
    render(<App />);
    expect(screen.getByText(/enter values to calculate/i)).toBeInTheDocument();
  });

  it("calculates position size once all fields are filled in", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.type(screen.getByLabelText(/entry price/i), "100");
    await user.type(screen.getByLabelText(/stop-loss price/i), "90");

    expect(screen.getByText("$100.00")).toBeInTheDocument();
    expect(screen.getByText("10.0000")).toBeInTheDocument();
    expect(screen.getByText("$1000.00")).toBeInTheDocument();
  });
});
