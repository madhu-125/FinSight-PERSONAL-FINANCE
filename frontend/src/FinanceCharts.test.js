import { render, screen } from "@testing-library/react";
import { CashFlowTooltip } from "./FinanceCharts";

const currencyFormatter = (value) => `$${value.toFixed(2)}`;

test("cash flow tooltip shows income, expenses, and their ratio for the hovered period", () => {
  render(
    <CashFlowTooltip
      active
      label="November"
      payload={[{ payload: { income: 2000, expenses: 500 } }]}
      currencyFormatter={currencyFormatter}
      tooltipLabelFormatter={(label) => `Month: ${label}`}
    />
  );

  expect(screen.getByText("Month: November")).toBeInTheDocument();
  expect(screen.getByText("$2000.00")).toBeInTheDocument();
  expect(screen.getByText("$500.00")).toBeInTheDocument();
  expect(screen.getByText("Expenses / income")).toBeInTheDocument();
  expect(screen.getByText("25.0%")).toBeInTheDocument();
});

test("cash flow tooltip handles a period with no income", () => {
  render(
    <CashFlowTooltip
      active
      label="December"
      payload={[{ payload: { income: 0, expenses: 300 } }]}
      currencyFormatter={currencyFormatter}
    />
  );

  expect(screen.getByText("Not available")).toBeInTheDocument();
});
