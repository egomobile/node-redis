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
 * Result of a `RedisCacheFetcherEx<TFunc>` call.
 */
export interface IExecuteRedisCacheFetcherResult<TFunc extends AsyncFunc = AsyncFunc> {
    /**
     * If defined, this is the `Error` object, which should be thrown, because
     * at least no data can be loaded yet.
     */
    readonly errorToThrow: any;
    /**
     * The last known value. Will throw an `Error`, if there is currently no value available.
     * s. `errorToThrow` for more information.
     */
    readonly value: ReturnType<TFunc>;
    /**
     * The current status of `value`.
     */
    readonly valueStatus: RedisCacheFetcherValueStatus;
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
     * Does the same as the function itself, but returns a result object with extended information.
     */
    fetch: RedisCacheFetcherEx<TFunc>;
    /**
     * Resets the current status.
     *
     * @returns {Promise<boolean>} The promise with the value that indicates if operation was successful or not.
     */
    reset(): Promise<boolean>;
};

/**
 * Same as `RedisCacheFetcherEx<TFunc>`, but returns an object with an extended result.
 *
 * @params {Parameters<TFunc>} [...args] The arguments for the function.
 *
 * @returns {Promise<IExecuteRedisCacheFetcherResult<TFunc>>} The promise with the exected result of the function.
 */
export type RedisCacheFetcherEx<TFunc extends AsyncFunc = AsyncFunc> =
    (...args: Parameters<TFunc>) => Promise<IExecuteRedisCacheFetcherResult<TFunc>>;

/**
 * List of statuses of fetcher values.
 */
export enum RedisCacheFetcherValueStatus {
    /**
     * Currently no data could be fetched successfully yet.
     */
    NoValueAvailable = 0,
    /**
     * The returned value is cached.
     */
    Cached = 1,
    /**
     * The value has recently been (re-)fetched and is up-to-date.
     */
    UpToDate = 2,
}

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
    const fetch = (async (...args: any[]): Promise<any> => {
        let errorToThrow: any;
        let valueStatus = RedisCacheFetcherValueStatus.Cached;

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
                valueStatus = RedisCacheFetcherValueStatus.UpToDate;

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
                errorToThrow = error;
            }
        }

        let value = lastValue;

        const result: IExecuteRedisCacheFetcherResult<TFunc> = {
            errorToThrow,
            "value": undefined!,
            "valueStatus": undefined!
        };

        // result.errorToThrow
        Object.defineProperty(result, "errorToThrow", {
            "enumerable": true,
            "configurable": false,
            "get": () => {
                return errorToThrow;
            }
        });

        // result.value
        Object.defineProperty(result, "value", {
            "enumerable": true,
            "configurable": false,
            "get": () => {
                if (value === NOT_INITIALIZED_YET) {
                    throw new Error("No data available yet!", {
                        "cause": errorToThrow ?? undefined
                    });
                }

                return value;
            }
        });

        // result.valueStatus
        Object.defineProperty(result, "valueStatus", {
            "enumerable": true,
            "configurable": false,
            "get": () => {
                return value === NOT_INITIALIZED_YET ?
                    RedisCacheFetcherValueStatus.NoValueAvailable :
                    valueStatus;
            }
        });

        return result;
    }) as unknown as RedisCacheFetcherEx<TFunc>;

    const newFetcher = (async (...args: Parameters<TFunc>) => {
        const {
            errorToThrow,
            value
        } = await fetch(...args);

        if (errorToThrow) {
            throw new errorToThrow;
        }

        return value;
    }) as unknown as RedisCacheFetcher<TFunc>;

    // RedisCacheFetcher<TFunc>.fetch()
    newFetcher.fetch = fetch;

    // RedisCacheFetcher<TFunc>.reset()
    newFetcher.reset = async () => {
        const hasBeenRemovedFromCache = await redis.set(key, null);

        if (hasBeenRemovedFromCache) {
            lastValue = NOT_INITIALIZED_YET;
        }

        return hasBeenRemovedFromCache;
    };

    return newFetcher;
}
