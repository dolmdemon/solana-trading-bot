import { Filter, FilterResult } from './pool-filters';
import { LiquidityPoolKeysV4 } from '@raydium-io/raydium-sdk';
import { Connection } from '@solana/web3.js';
import { logger } from '../helpers';

export class PoolAgeFilter implements Filter {
    constructor(
        private readonly connection: Connection,
        private readonly minAge: number,
        private readonly maxAge: number,
    ) {}

    async execute(poolKeys: LiquidityPoolKeysV4): Promise<FilterResult> {
        try {
            const currentTime = Math.floor(Date.now() / 1000);
    
            // Get pool creation history
            const poolHistory = await this.connection.getSignaturesForAddress(poolKeys.id, { limit: 1 });
            if (poolHistory.length === 0) {
                return { ok: false, message: 'PoolAge -> No pool history found' };
            }
    
            if (!poolHistory[0].blockTime) {
                return { ok: false, message: 'PoolAge -> Could not get pool creation time' };
            }
    
            const poolAge = currentTime - poolHistory[0].blockTime;
            
            logger.debug(
                {
                    pool: poolKeys.id.toString(),
                    token: poolKeys.baseMint.toString(),  // Add this line
                    age: `${(poolAge / 60).toFixed(2)} minutes`,
                    minAge: `${(this.minAge / 60).toFixed(2)} minutes`,
                    maxAge: `${(this.maxAge / 3600).toFixed(2)} hours`
                },
                'Pool age check'
            );

            if (poolAge < this.minAge) {
                return {
                    ok: false,
                    message: `PoolAge -> Pool age ${(poolAge / 60).toFixed(2)} minutes is less than minimum ${(this.minAge / 60).toFixed(2)} minutes`
                };
            }

            if (this.maxAge > 0 && poolAge > this.maxAge) {
                return {
                    ok: false,
                    message: `PoolAge -> Pool age ${(poolAge / 3600).toFixed(2)} hours exceeds maximum ${(this.maxAge / 3600).toFixed(2)} hours`
                };
            }

            return { ok: true };
        } catch (e) {
            logger.error({ pool: poolKeys.id.toString(), error: e }, 'Failed to check pool age');
            return { ok: false, message: 'PoolAge -> Failed to check pool age' };
        }
    }
}