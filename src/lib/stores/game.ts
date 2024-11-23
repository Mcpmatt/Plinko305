import PlinkoEngine from '$lib/components/Plinko/PlinkoEngine';
import { binColor } from '$lib/constants/game';
import {
  RiskLevel,
  type BetAmountOfExistingBalls,
  type RowCount,
  type WinRecord,
} from '$lib/types';
import { interpolateRgbColors } from '$lib/utils/colors';
import { countValueOccurrences } from '$lib/utils/numbers';
import { derived, writable } from 'svelte/store';

export const plinkoEngine = writable<PlinkoEngine | null>(null);

// Initialize balance from URL parameter instead of hardcoded value
const getInitialBalance = () => {
  alert('A. game.ts getInitialBalance called');
  if (typeof window !== 'undefined') {
    const urlParams = new URLSearchParams(window.location.search);
    const tokenParam = urlParams.get('tokens');
    alert(`B. game.ts token param: ${tokenParam}`);
    return tokenParam ? parseInt(tokenParam, 10) : 200;
  }
  return 200;
};

// Create and export the balance store
export const balance = writable<number>(getInitialBalance());

// Add stores for cash out functionality
export const isCashingOut = writable<boolean>(false);
export const cashOutError = writable<string | null>(null);

// Cash out function
export const handleCashOut = async () => {  
  
  // Get and parse balance properly
  const currentBalance = get(balance);
  
  if (typeof window === 'undefined') return;
  
  const urlParams = new URLSearchParams(window.location.search);
  const cloudFunctionUrl = urlParams.get('cloudFunction');
  const userId = urlParams.get('uid');
  
  const finalBalance = Math.floor(parseInt(currentBalance, 10));

  if (!cloudFunctionUrl || !userId) {
    cashOutError.set('Missing required parameters for cash out');
    return;
  }

  isCashingOut.set(true);
  cashOutError.set(null);

  try {
    const response = await fetch(cloudFunctionUrl, {
      method: 'POST',
      mode: 'cors',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        uid: userId,
        finalBalance: finalBalance,
        has_cashed_out_plinko: true  // Updated to use Plinko-specific flag
      })
    });

    if (!response.ok) {
      throw new Error(await response.text());
    }

    const data = await response.json();
    
    if (data.success) {
      balance.set(0);
      // Redirect back to app after successful cash out
      window.location.href = 'fitness305casino://cash-out-complete';
    } else {
      throw new Error('Cash out failed');
    }
  } catch (error) {
    cashOutError.set(error instanceof Error ? error.message : 'Cash out failed');
  } finally {
    isCashingOut.set(false);
  }
};


export const betAmount = writable<number>(1);

export const betAmountOfExistingBalls = writable<BetAmountOfExistingBalls>({});

export const rowCount = writable<RowCount>(16);

export const riskLevel = writable<RiskLevel>(RiskLevel.MEDIUM);

export const winRecords = writable<WinRecord[]>([]);

/**
 * History of total profits. Should be updated whenever a new win record is pushed
 * to `winRecords` store.
 *
 * We deliberately don't use `derived(winRecords, ...)` to optimize performance.
 */
export const totalProfitHistory = writable<number[]>([0]);

/**
 * Game balance, which is saved to local storage.
 *
 * We only save the balance to local storage on browser `beforeunload` event instead of
 * on every balance change. This prevents unnecessary writes to local storage, which can
 * be slow on low-end devices.
 */
//export const balance = writable<number>(200);

/**
 * RGB colors for every bin. The length of the array is the number of bins.
 */
export const binColors = derived<typeof rowCount, { background: string[]; shadow: string[] }>(
  rowCount,
  ($rowCount) => {
    const binCount = $rowCount + 1;
    const isBinsEven = binCount % 2 === 0;
    const redToYellowLength = Math.ceil(binCount / 2);

    const redToYellowBg = interpolateRgbColors(
      binColor.background.red,
      binColor.background.yellow,
      redToYellowLength,
    ).map(({ r, g, b }) => `rgb(${r}, ${g}, ${b})`);

    const redToYellowShadow = interpolateRgbColors(
      binColor.shadow.red,
      binColor.shadow.yellow,
      redToYellowLength,
    ).map(({ r, g, b }) => `rgb(${r}, ${g}, ${b})`);

    return {
      background: [...redToYellowBg, ...redToYellowBg.toReversed().slice(isBinsEven ? 0 : 1)],
      shadow: [...redToYellowShadow, ...redToYellowShadow.toReversed().slice(isBinsEven ? 0 : 1)],
    };
  },
);

export const binProbabilities = derived<
  [typeof winRecords, typeof rowCount],
  { [binIndex: number]: number }
>([winRecords, rowCount], ([$winRecords, $rowCount]) => {
  const occurrences = countValueOccurrences($winRecords.map(({ binIndex }) => binIndex));
  const probabilities: Record<number, number> = {};
  for (let i = 0; i < $rowCount + 1; ++i) {
    probabilities[i] = occurrences[i] / $winRecords.length || 0;
  }
  return probabilities;
});
