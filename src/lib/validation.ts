import type { RiskWarning, TradeCalculation, TradeInputs } from "./types";

/**
 * Direction-consistency checks: stop loss / take profit must sit on the
 * correct side of entry for the selected direction. Only runs once entry,
 * stop, and take profit are all populated with positive prices.
 */
export function validateDirection(inputs: TradeInputs): RiskWarning[] {
  const warnings: RiskWarning[] = [];
  const hasAllPrices =
    inputs.entryPrice > 0 && inputs.stopLossPrice > 0 && inputs.takeProfitPrice > 0;
  if (!hasAllPrices) {
    return warnings;
  }

  if (inputs.direction === "long") {
    if (inputs.stopLossPrice >= inputs.entryPrice) {
      warnings.push({
        id: "direction-stop-long",
        level: "error",
        message: "For a long position, stop loss must be below entry price.",
      });
    }
    if (inputs.takeProfitPrice <= inputs.entryPrice) {
      warnings.push({
        id: "direction-tp-long",
        level: "error",
        message: "For a long position, take profit must be above entry price.",
      });
    }
  } else {
    if (inputs.stopLossPrice <= inputs.entryPrice) {
      warnings.push({
        id: "direction-stop-short",
        level: "error",
        message: "For a short position, stop loss must be above entry price.",
      });
    }
    if (inputs.takeProfitPrice >= inputs.entryPrice) {
      warnings.push({
        id: "direction-tp-short",
        level: "error",
        message: "For a short position, take profit must be below entry price.",
      });
    }
  }

  return warnings;
}

/** Flags missing entry/stop/take-profit so the UI can prompt for manual input. */
export function getMissingInputWarnings(inputs: TradeInputs): RiskWarning[] {
  const missing: string[] = [];
  if (!(inputs.entryPrice > 0)) missing.push("entry price");
  if (!(inputs.stopLossPrice > 0)) missing.push("stop loss");
  if (!(inputs.takeProfitPrice > 0)) missing.push("take profit");

  if (missing.length === 0) {
    return [];
  }

  return [
    {
      id: "missing-inputs",
      level: "info",
      message: `Manual input needed: ${missing.join(", ")}.`,
    },
  ];
}

/** Numeric threshold checks against risk %, leverage, margin, stop distance, and R:R. */
export function getThresholdWarnings(
  inputs: TradeInputs,
  calc: TradeCalculation,
): RiskWarning[] {
  const warnings: RiskWarning[] = [];
  const hasEntryAndStop = inputs.entryPrice > 0 && inputs.stopLossPrice > 0;

  if (inputs.riskPercent > 5) {
    warnings.push({
      id: "risk-danger",
      level: "error",
      message: `Risking ${inputs.riskPercent}% of account per trade is dangerously high.`,
    });
  } else if (inputs.riskPercent > 3) {
    warnings.push({
      id: "risk-caution",
      level: "warning",
      message: `Risking ${inputs.riskPercent}% of account per trade is elevated — use caution.`,
    });
  }

  if (inputs.leverage >= 50) {
    warnings.push({
      id: "leverage-extreme",
      level: "error",
      message: `${inputs.leverage}x leverage is extreme and greatly increases liquidation risk.`,
    });
  } else if (inputs.leverage >= 20) {
    warnings.push({
      id: "leverage-high",
      level: "warning",
      message: `${inputs.leverage}x leverage is high.`,
    });
  }

  if (hasEntryAndStop) {
    if (calc.stopDistance <= 0) {
      warnings.push({
        id: "stop-distance-invalid",
        level: "error",
        message: "Stop distance is zero or invalid — entry and stop loss cannot be equal.",
      });
    } else if (calc.stopDistancePercent < 0.1) {
      warnings.push({
        id: "stop-distance-tight",
        level: "warning",
        message:
          "Stop distance is under 0.1% of entry price — the stop may be too tight and risk premature stop-outs.",
      });
    } else if (calc.stopDistancePercent > 10) {
      warnings.push({
        id: "stop-distance-large",
        level: "warning",
        message: "Stop distance is over 10% of entry price — this is a wide stop.",
      });
    }
  }

  if (inputs.accountBalance > 0 && hasEntryAndStop) {
    if (calc.requiredMargin > inputs.accountBalance) {
      warnings.push({
        id: "margin-insufficient",
        level: "error",
        message: "Required margin exceeds account balance — this position is not affordable.",
      });
    }

    if (calc.marginUsagePercent > 50) {
      warnings.push({
        id: "margin-high-usage",
        level: "warning",
        message: `Margin usage is ${calc.marginUsagePercent.toFixed(1)}% of account balance — high exposure.`,
      });
    }

    if (
      inputs.leverage > 0 &&
      calc.positionNotional > inputs.accountBalance * inputs.leverage
    ) {
      warnings.push({
        id: "notional-invalid",
        level: "error",
        message:
          "Position notional exceeds the maximum supported by account balance and leverage.",
      });
    }
  }

  if (hasEntryAndStop && inputs.takeProfitPrice > 0 && calc.lossAtStop > 0) {
    if (calc.riskRewardRatio < 1.5) {
      warnings.push({
        id: "rr-weak",
        level: "warning",
        message: `Risk/reward of ${calc.riskRewardRatio.toFixed(2)} is below the recommended 1.5 minimum.`,
      });
    }
  }

  return warnings;
}

/** Combined, ordered list of all validation/warning rules for a trade setup. */
export function getAllWarnings(inputs: TradeInputs, calc: TradeCalculation): RiskWarning[] {
  return [
    ...validateDirection(inputs),
    ...getThresholdWarnings(inputs, calc),
    ...getMissingInputWarnings(inputs),
  ];
}
