import { Filter, FilterResult } from './pool-filters';
import { Liquidity, LiquidityPoolKeysV4 } from '@raydium-io/raydium-sdk';
import { Connection } from '@solana/web3.js';
import { getMint } from '@solana/spl-token';
import { logger } from '../helpers';

export class MarketCapFilter implements Filter {
    constructor(
        private readonly connection: Connection,
        private readonly maxMarketCap: number,
    ) {}

    async execute(poolKeys: LiquidityPoolKeysV4): Promise<FilterResult> {
        // Skip check if maxMarketCap is 0
        if (this.maxMarketCap === 0) {
            return { ok: true };
        }

        try {
            // Get token supply
            const mintInfo = await getMint(this.connection, poolKeys.baseMint);
            const totalSupply = Number(mintInfo.supply) / Math.pow(10, mintInfo.decimals);

            // Get price from pool reserves
            const poolInfo = await Liquidity.fetchInfo({
                connection: this.connection,
                poolKeys,
            });

            const baseReserve = Number(poolInfo.baseReserve);
            const quoteReserve = Number(poolInfo.quoteReserve);
            const currentPrice = quoteReserve / baseReserve;

            // Calculate market cap
            const marketCap = totalSupply * currentPrice;

            if (marketCap > this.maxMarketCap) {
                return {
                    ok: false,
                    message: `MarketCap -> Market cap ${marketCap.toFixed(2)} > ${this.maxMarketCap}`
                };
            }

            return { ok: true };
        } catch (e) {
            logger.error({ mint: poolKeys.baseMint.toString(), error: e }, 'Failed to check market cap');
            return { ok: false, message: 'MarketCap -> Failed to check market cap' };
        }
    }
}