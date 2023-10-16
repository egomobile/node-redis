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

import { promisify } from "node:util";
import type { RedisClient } from "redis";
import { createRedisCacheFetcher, ICreateRedisCacheFetcherOptions, RedisCacheFetcher } from "../../../utils";
import type { AsyncFunc, Nilable } from "../../internal";
import { isNil } from "../../../utils/internal";

/**
 * Options for `RedisCache` class.
 */
export interface IRedisCacheOptions {
    /**
     * The custom host.
     */
    host?: string;
    /**
     * Custom, global error handler.
     */
    onError?: Nilable<(error: unknown) => any>;
    /**
     * The custom TCP port.
     */
    port?: number;
}

/**
 * A Redis based cache implementation.
 */
export class RedisCache {
    readonly #delAsync: any;
    readonly #flushdbAsync: any;
    readonly #getAsync: any;
    readonly #setAsync: any;

    /**
     * The underlying base client.
     */
    public readonly client: RedisClient;

    /**
     * Initializes a new instance of that class.
     *
     * @example
     * ```
     * import RedisCache from "@egomobile/redis"
     *
     * // use REDIS_HOST and REDIS_PORT
     * // environment variables
     * const cache1 = new RedisCache()
     *
     * // use custom settings
     * const cache2 = new RedisCache({
     *     host: "redis.example.com",
     *     port: 5979
     * })
     * ```
     *
     * @param {IRedisCacheOptions|null|undefined} [options=undefined] Custom options.
     */
    public constructor(options?: IRedisCacheOptions | null) {
        const redis = require("redis");

        let host: string | undefined;
        let port: number | undefined;
        if (options) {
            host = options.host;
            port = options.port;
        }
        else {
            const REDIS_HOST = process.env.REDIS_HOST?.trim();
            const REDIS_PORT = process.env.REDIS_PORT?.trim();

            host = REDIS_HOST;
            if (!host?.length) {
                host = "localhost";
            }

            if (REDIS_PORT?.length) {
                port = parseInt(REDIS_PORT);
            }
        }

        this.client = redis.createClient({
            host,
            port
        });

        this.client.on("error", options?.onError ?? ((error: any) => {
            console.warn(`REDIS ERROR: ${error}`, {
                "file": __filename
            });
        }));

        this.#delAsync = promisify(this.client.del).bind(this.client);
        this.#flushdbAsync = promisify(this.client.flushdb).bind(this.client);
        this.#getAsync = promisify(this.client.get).bind(this.client);
        this.#setAsync = promisify(this.client.set).bind(this.client);
    }

    /**
     * Closes the connection.
     *
     * @example
     * ```
     * import RedisCache from "@egomobile/redis"
     *
     * const cache = new RedisCache()
     *
     * cache.close()  // no flush
     * // cache.close(true)  // with flush
     * ```
     *
     * @param {boolean} [flush=false] Flush connection after closed or not.
     */
    // eslint-disable-next-line require-await
    public async close(flush = false): Promise<void> {
        this.client.end(flush);
    }

    /**
     * Creates a new fetcher based on this cache instance.
     *
     * @example
     * ```
     * import axios from "axios"
     * import RedisCache from "@egomobile/redis"
     *
     * const cache = new RedisCache()
     *
     * const loadRandomUsers = cache.createFetcher(
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
     * @param {string} key The key where the data should be stored in cache.
     * @param {TFunc} fetcher The function that fetches the data.
     * @param {Nilable<ICreateRedisCacheFetcherOptions>} [options] Custom options.
     *
     * @returns {RedisCacheFetcher<TFunc>} The new fetcher.
     */
    public createFetcher<TFunc extends AsyncFunc>(
        key: string, fetcher: TFunc,
        options?: Nilable<ICreateRedisCacheFetcherOptions>
    ): RedisCacheFetcher<TFunc> {
        return createRedisCacheFetcher<TFunc>(
            this,
            key, fetcher,
            options
        );
    }

    /**
     * Removes all entries.
     *
     * @example
     * ```
     * import RedisCache from "@egomobile/redis"
     *
     * const cache = new RedisCache()
     *
     * if (await cache.flush()) {
     *     // success
     * } else {
     *     // error
     * }
     * ```
     *
     * @returns {Promise<boolean>} The promise that indicates if operation was successful or not.
     */
    public async flush(): Promise<boolean> {
        try {
            return await this.#flushdbAsync("ASYNC");
        }
        catch {
            return false;
        }
    }

    /**
     * Tries to return a value from cache by key.
     *
     * @example
     * ```
     * import RedisCache from "@egomobile/redis"
     *
     * const cache = new RedisCache()
     *
     * // if "foo1" does not exist, (undefined) is returned
     * await cache.get("foo1")
     *
     * // if "foo2" does not exist, "bar" is returned
     * await cache.get("foo2", "bar")
     * ```
     *
     * @param {string} key The key.
     * @param {TDefault} [defaultValue=undefined] The custom default value.
     *
     * @returns {Promise<TResult|TDefault|undefined>} The promise with the value or the default value.
     */
    public get<TResult extends any = any>(key: string): Promise<TResult | undefined>;
    public get<TResult, TDefault>(key: string, defaultValue: TDefault): Promise<TResult | TDefault>;
    public async get<TResult extends any = any, TDefault extends any = any>(key: string, defaultValue?: TDefault): Promise<TResult | TDefault | undefined> {
        try {
            const value = await this.#getAsync(key);

            if (typeof value === "string") {
                return JSON.parse(value);
            }
        }
        catch { }

        return defaultValue;
    }

    /**
     * Sets or deletes a value.
     *
     * @example
     * ```
     * import RedisCache from "@egomobile/redis"
     *
     * const cache = new RedisCache()
     *
     * // you can submit any value
     * // which can be serialized by JSON.stringify()
     * await cache.set("foo", "bar")
     * await cache.set("foo", 5979)
     * await cache.set("foo", true)
     * await cache.set("foo", { bar: "baz" })
     * await cache.set("foo", ["bar", 23979])
     *
     * // ways to delete a value
     * await cache.set("foo", null)
     * await cache.set("foo", undefined)
     * ```
     *
     * @param {string} key The key.
     * @param {any} value The (new) value. A value of (null) or (undefined) will delete the value of a key.
     * @param {number|false} [ttl=3600] The time in seconds, the value "lives". (false) indicates that the value does not become invalid and "lives forever".
     *
     * @returns {Promise<boolean>} The promise, that indicates if operation was successful or not.
     */
    public async set(key: string, value: any, ttl: number | false = 3600): Promise<boolean> {
        try {
            if (isNil(value)) {
                await this.#delAsync(key);
            }
            else {
                const jsonStr = JSON.stringify(value);

                if (ttl === false) {
                    await this.#setAsync(key, jsonStr);
                }
                else {
                    await this.#setAsync(key, jsonStr, "EX", ttl);
                }
            }

            return true;
        }
        catch {
            return false;
        }
    }
}
