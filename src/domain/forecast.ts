import type {
  FinanceData,
  Forecast,
  ForecastEvent,
  ForecastLow,
  ISODate,
} from '../types/finance';

export type { Forecast, ForecastEvent, ForecastLow };

/** Computes available cash, component breakdown, and daily running-balance timeline for the current pay period (SPEC §5 C5 & §6). */
export function forecast(data: FinanceData, sourceId: string, today: ISODate): Forecast {
  void data;
  void sourceId;
  void today;
  throw new Error('not implemented: forecast');
}
