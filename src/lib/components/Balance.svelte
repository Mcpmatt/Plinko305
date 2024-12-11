<script lang="ts">
  import { onMount } from 'svelte';
  import { balance, isCashingOut, cashOutError, betsPlaced, totalBetAmount } from '$lib/stores/game';  // Import from your store

  let showCashOut = false;

  onMount(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const tokenParam = urlParams.get('tokens');
    if (tokenParam) {
        const parsedBalance = parseInt(tokenParam, 10);
        $balance = parsedBalance;
    }
    // Check if we should show cash out button
    showCashOut = Boolean(urlParams.get('cloudFunction') && urlParams.get('uid'));
  });

  async function handleCashOut() {
    const urlParams = new URLSearchParams(window.location.search);
    const cloudFunctionUrl = urlParams.get('cloudFunction');
    const userId = urlParams.get('uid');

    // Floor the final balance before sending
    const finalBalance = Math.floor($balance);
    const finalBetAmount = Math.floor($totalBetAmount);

    if (!cloudFunctionUrl || !userId) {
      $cashOutError = 'Missing required parameters for cash out';
      return;
    }

    $isCashingOut = true;
    $cashOutError = null;

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
          finalBalance: finalBalance,   // Will always be a whole number
          has_cashed_out_plinko: true,
          betsPlaced: betsPlaced,
          totalBetAmount: finalBetAmount
        })
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      const data = await response.json();
      
      if (data.success) {
        $balance = 0;
        window.location.href = 'fitness305casino://cash-out-complete';
      } else {
        throw new Error('Cash out failed');
      }
    } catch (error) {
      $cashOutError = error instanceof Error ? error.message : 'Cash out failed';
    } finally {
      $isCashingOut = false;
    }
  }

  function confirmCashOut() {
    if (confirm(`Cash out ${$balance.toLocaleString('en-US')} tokens?`)) {
        handleCashOut();
    }
}

  $: balanceFormatted = $balance.toLocaleString('en-US');
</script>

<div class="flex flex-col">
  <div class="flex items-center gap-2 overflow-hidden rounded-md">
    <div class="flex gap-2 bg-slate-900 px-3 py-2 text-sm font-semibold tabular-nums text-white sm:text-base">
      <span class="select-none text-gray-500">$</span>
      <span class="min-w-16 text-right">
        {balanceFormatted}
      </span>
    </div>
    
    {#if showCashOut}
      <button
        on:click={confirmCashOut}
        disabled={$isCashingOut || $balance < 0}
        class="bg-green-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-500 active:bg-green-700 disabled:bg-gray-400 sm:text-base"
      >
        {$isCashingOut ? 'Processing...' : 'Cash Out'}
      </button>
    {/if}
  </div>

  {#if $cashOutError}
    <div class="mt-2 text-sm text-red-500">
      {$cashOutError}
    </div>
  {/if}
</div>
