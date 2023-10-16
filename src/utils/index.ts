/* eslint-disable require-await */

// This file is part of the @egomobile/redis distribution.
// Copyright (c) Next.e.GO Mobile SE, Aachen, Germany (https://e-go-mobile.com/)
//
// @egomobile/redis is free software: you can redistribute it and/or modify
// it under the terms of the GNU Lesser General Public License as
// published by the Free Software Foundation, version 3.
//
// @egomobile/redis is distributed in the hope that it will be useful, but
// WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU
// Lesser General Public License for more details.
//
// You should have received a copy of the GNU Lesser General Public License
// along with this program. If not, see <http://www.gnu.org/licenses/>.

import type { RedisCache } from "../types";
import type { AsyncFunc, Nilable, Nullable, TTL } from "../types/internal";
import { isNil } from "./internal";

interface ICachedValue {
    updateAfter: Nullable<number>;
    value: any;
}

/**
 * Options for `createRedisCacheFetcher()` function.
 */
export interface ICreateRedisCacheFetcherOptions {
    /**
     * The number in seconds, the fetched data should automatically updated.
     *
     * @default `3600`
     */
    autoUpdateAfter?: Nilable<number>;
    /**
     * The number of seconds, the fetched value should be stored in redis cache
     * or `false` to save it "forever".
     *
     * @default `false`
     */
    ttl?: Nilable<TTL>;
}

/**
 * A Redis cache data fetcher.
 *
 * @param {Parameters<TFunc>} [...args] The parameters of the function.
 *
 * @returns {ReturnType<TFunc>} The result of the function.
 */
export type RedisCacheFetcher<TFunc extends AsyncFunc = AsyncFunc> = ((...args: Parameters<TFunc>) => ReturnType<TFunc>) & {
    /**
     * Resets the current status.
     *
     * @returns {Promise<boolean>} The promise with the value that indicates if operation was successful or not.
     */
    reset(): Promise<boolean>;
};

/**
 * Wraps a function, that fetches and caches a value, using a `RedisCache` instance.
 * The signature of the original function will be kept.
 *
 * @example
 * ```
 * import axios from "axios"
 * import RedisCache from "@egomobile/redis"
 *
 * const cache = new RedisCache()
 *
 * const loadRandomUsers = createRedisCacheFetcher(
 *   cache,
 *   'randomUsersKey',
 *   async (seed: string) => {
 *     const response = await axios.get(`https://randomuser.me/api/?seed=${encodeURIComponent(seed)}`)
 *
 *     return response.data
 *   }
 * )
 *
 * // first call MUST be successful, otherwise
 * // exception is re-thrown
 * const data1 = await loadRandomUsers("foobar1")
 *
 * // should be same as `data1`, because it is cached
 * const data2 = await loadRandomUsers("foobar2")
 *
 * // reset and force reloading data
 * await loadRandomUsers.reset()
 * const data3 = await loadRandomUsers("foobar3")
 * ```
 *
 * @param {RedisCache} redis The redis cache instance.
 * @param {string} key The key inside the `redis` instance, where the fetched value will be stored.
 * @param {TFunc} fetcher The original function, that fetches the data.
 * @param {Nilable<ICreateRedisCacheFetcherOptions>} [options] Custom options.
 *
 * @returns {RedisCacheFetcher<TFunc>} The new, wrapped function.
 */
export function createRedisCacheFetcher<TFunc extends AsyncFunc>(
    redis: RedisCache,
    key: string, fetcher: TFunc,
    options?: Nilable<ICreateRedisCacheFetcherOptions>
): RedisCacheFetcher<TFunc> {
    const NOT_FOUND = Symbol("NOT_FOUND");
    const NOT_INITIALIZED_YET = Symbol("NOT_INITIALIZED_YET");

    let lastValue: any = NOT_INITIALIZED_YET;

    let ttl: TTL = false;
    if (!isNil(options?.ttl)) {
        ttl = options!.ttl!;
    }

    let autoUpdateAfter: Nullable<number>;
    if (typeof options?.autoUpdateAfter === "undefined") {
        // default => 1h
        autoUpdateAfter = 3600 * 1000;
    }
    else {
        autoUpdateAfter = typeof options!.autoUpdateAfter === "number" ?
            options!.autoUpdateAfter * 1000 :
            null;
    }

    // RedisCacheFetcher<TFunc>
    const func = (async (...args: any[]): Promise<any> => {
        try {
            const now = new Date();

            const refetch = async () => {
                const fetchResult = await Promise.resolve(
                    fetcher(...args)
                );

                const valueToCache: ICachedValue = {
                    "updateAfter": typeof autoUpdateAfter === "number" ?
                        now.valueOf() + autoUpdateAfter :
                        null,
                    "value": fetchResult
                };

                lastValue = valueToCache.value;

                await redis.set(key, valueToCache, ttl);

                return fetchResult;
            };

            let cachedValue: any = await redis.get(key, NOT_FOUND);
            if (cachedValue === NOT_FOUND) {
                await refetch();  // not in redis cache (anymore)
            }
            else {
                const valueToCache: ICachedValue = cachedValue;

                if (!!valueToCache && typeof valueToCache === "object") {
                    lastValue = valueToCache.value;

                    if (typeof valueToCache.updateAfter === "number") {
                        if (now.valueOf() > valueToCache.updateAfter) {
                            await refetch();  // auto update
                        }
                    }
                }
                else {
                    // we have no valid object here anymore
                    await refetch();
                }
            }
        }
        catch (error: any) {
            if (lastValue === NOT_INITIALIZED_YET) {
                // we must have at least one successful
                // call of data fetcher here
                throw error;
            }
        }

        return lastValue;
    }) as unknown as RedisCacheFetcher<TFunc>;

    // RedisCacheFetcher<TFunc>.reset()
    func.reset = async () => {
        const hasBeenRemovedFromCache = await redis.set(key, null);

        lastValue = NOT_INITIALIZED_YET;

        return hasBeenRemovedFromCache;
    };

    return func;
}
