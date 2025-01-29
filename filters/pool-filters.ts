import { Connection } from '@solana/web3.js';
import { LiquidityPoolKeysV4, Token, TokenAmount } from '@raydium-io/raydium-sdk';
import { getMetadataAccountDataSerializer } from '@metaplex-foundation/mpl-token-metadata';
import { BurnFilter } from './burn.filter';
import { MutableFilter } from './mutable.filter';
import { RenouncedFreezeFilter } from './renounced.filter';
import { PoolSizeFilter } from './pool-size.filter';
import { MarketCapFilter } from './market-cap.filter';
import { PoolAgeFilter } from './pool-age.filter';
import { 
    CHECK_IF_BURNED, 
    CHECK_IF_FREEZABLE, 
    CHECK_IF_MINT_IS_RENOUNCED, 
    CHECK_IF_MUTABLE, 
    CHECK_IF_SOCIALS,
    CHECK_POOL_AGE,
    MIN_POOL_AGE,
    MAX_POOL_AGE,
    logger 
} from '../helpers';

export interface Filter {
    execute(poolKeysV4: LiquidityPoolKeysV4): Promise<FilterResult>;
}

export interface FilterResult {
    ok: boolean;
    message?: string;
}

export interface PoolFilterArgs {
    minPoolSize: TokenAmount;
    maxPoolSize: TokenAmount;
    quoteToken: Token;
    maxMarketCap: number;
}

export class PoolFilters {
    public readonly filters: Filter[] = [];

    constructor(
        readonly connection: Connection,
        readonly args: PoolFilterArgs,
    ) {
        if (CHECK_IF_BURNED) {
            this.filters.push(new BurnFilter(connection));
        }

        if (CHECK_IF_MINT_IS_RENOUNCED || CHECK_IF_FREEZABLE) {
            this.filters.push(new RenouncedFreezeFilter(connection, CHECK_IF_MINT_IS_RENOUNCED, CHECK_IF_FREEZABLE));
        }

        if (CHECK_IF_MUTABLE || CHECK_IF_SOCIALS) {
            this.filters.push(new MutableFilter(connection, getMetadataAccountDataSerializer(), CHECK_IF_MUTABLE, CHECK_IF_SOCIALS));
        }

        if (!args.minPoolSize.isZero() || !args.maxPoolSize.isZero()) {
            this.filters.push(new PoolSizeFilter(connection, args.quoteToken, args.minPoolSize, args.maxPoolSize));
        }

        if (args.maxMarketCap > 0) {
            this.filters.push(new MarketCapFilter(connection, args.maxMarketCap));
        }

        if (CHECK_POOL_AGE) {
            this.filters.push(new PoolAgeFilter(connection, MIN_POOL_AGE, MAX_POOL_AGE));
        }
    }

    public async executeRemainingChecks(poolKeys: LiquidityPoolKeysV4): Promise<boolean> {
        // Execute only non-MarketCapFilter and non-PoolAgeFilter filters
        const remainingFilters = this.filters.filter(
            f => !(f instanceof MarketCapFilter) && !(f instanceof PoolAgeFilter)
        );

        if (remainingFilters.length === 0) {
            return true;
        }

        const results = await Promise.all(remainingFilters.map((f) => f.execute(poolKeys)));
        const pass = results.every((r) => r.ok);

        if (!pass) {
            for (const filterResult of results.filter((r) => !r.ok)) {
                logger.trace(filterResult.message);
            }
        }

        return pass;
    }

    public async execute(poolKeys: LiquidityPoolKeysV4): Promise<boolean> {
        if (this.filters.length === 0) {
            return true;
        }

        const result = await Promise.all(this.filters.map((f) => f.execute(poolKeys)));
        const pass = result.every((r) => r.ok);

        if (pass) {
            return true;
        }

        for (const filterResult of result.filter((r) => !r.ok)) {
            logger.trace(filterResult.message);
        }

        return false;
    }
}