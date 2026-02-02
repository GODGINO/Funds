import { FundDataPoint } from '../types';

/**
 * Calculates Zigzag points for a given dataset and deviation threshold.
 * This algorithm identifies significant peaks and troughs in the data by filtering out smaller fluctuations.
 * @param data The array of fund data points, can be partial.
 * @param deviation The minimum percentage change required to define a trend reversal.
 * @returns An array of points representing the Zigzag line.
 */
// FIX: Make calculateZigzag generic to preserve additional properties (like 'idx') on data points.
// This ensures that utility functions don't drop extra metadata required by specific components.
export function calculateZigzag<T extends Partial<FundDataPoint>>(data: T[], deviation: number): T[] {
  const zigzagPoints: T[] = [];
  if (data.length < 2 || deviation <= 0) {
    return [];
  }

  const getNav = (p: T | undefined): number => p?.unitNAV ?? 0;

  zigzagPoints.push(data[0]);

  let lastPivotIndex = 0;
  let trend: 'up' | 'down' = 'up'; // Initial trend guess
  let lastPeakIndex = 0;
  let lastTroughIndex = 0;

  // Determine initial trend
  for (let i = 1; i < data.length; i++) {
      const firstNav = getNav(data[0]);
      if(firstNav === 0) continue; // Avoid division by zero
      const change = (getNav(data[i]) - firstNav) / firstNav * 100;
      if (Math.abs(change) >= deviation) {
          trend = change > 0 ? 'up' : 'down';
          if (trend === 'up') lastPeakIndex = i;
          else lastTroughIndex = i;
          lastPivotIndex = i;
          break;
      }
  }
  
  for (let i = lastPivotIndex + 1; i < data.length; i++) {
    if (trend === 'up') {
      const lastPeakNav = getNav(data[lastPeakIndex]);
      if (getNav(data[i]) > lastPeakNav) {
        lastPeakIndex = i;
      } else if (lastPeakNav > 0) { // Avoid division by zero
        const dropFromPeak = (lastPeakNav - getNav(data[i])) / lastPeakNav * 100;
        if (dropFromPeak >= deviation) {
          zigzagPoints.push(data[lastPeakIndex]);
          trend = 'down';
          lastTroughIndex = i;
        }
      }
    } else { // trend is 'down'
      const lastTroughNav = getNav(data[lastTroughIndex]);
      if (getNav(data[i]) < lastTroughNav) {
        lastTroughIndex = i;
      } else if (lastTroughNav > 0) { // Avoid division by zero
        const riseFromTrough = (getNav(data[i]) - lastTroughNav) / lastTroughNav * 100;
        if (riseFromTrough >= deviation) {
          zigzagPoints.push(data[lastTroughIndex]);
          trend = 'up';
          lastPeakIndex = i;
        }
      }
    }
  }

  // Add the last point to complete the line
  const lastPoint = data[data.length - 1];
  if (getNav(zigzagPoints[zigzagPoints.length - 1]) !== getNav(lastPoint)) {
      zigzagPoints.push(lastPoint);
  }

  return zigzagPoints;
}

/**
 * Calculates the Simple Moving Average (SMA) for a given numeric array.
 * @param data Array of numbers (typically NAVs).
 * @param period The sliding window size.
 * @returns Array of SMA values, with nulls for the initial padding.
 */
export function calculateSMA(data: number[], period: number): (number | null)[] {
  const sma: (number | null)[] = [];
  if (period <= 0) return data.map(() => null);
  
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      sma.push(null);
    } else {
      let sum = 0;
      for (let j = 0; j < period; j++) {
        sum += data[i - j];
      }
      sma.push(sum / period);
    }
  }
  return sma;
}
