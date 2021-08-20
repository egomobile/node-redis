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

import type { RedisClient } from 'redis';
import { promisify } from 'util';

/**
 * Options for RedisCache class.
 *
 * @example
 * ```
 * import RedisCache from "@egomobile/redis"
 *
 * const cache = new RedisCache()
 *
 * await cache.flush()  // remove all entries
 *
 * // non existing values
 * await cache.get("foo")  // (undefined)
 * await cache.get("foo", "TM")  // "TM"
 *
 * await cache.set("foo", "bar")  // set "bar" value to "foo" key
 * await cache.get("foo", "TM")  // "bar"
 *
 * await cache.set("foo", null)  // remove value
 * // alternative: await cache.set("foo", undefined)
 * await cache.get("foo", "TM")  // "TM"
 * ```
 */
export interface IRedisCacheOptions {
    /**
     * The custom host.
     */
    host?: string | null;
    /**
     * The custom TCP port.
     */
    port?: number | null;
}

/**
 * A Redis based cache implementation.
 */
export class RedisCache {
    /**
     * The underlying base client.
     */
    protected client: RedisClient;

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
     * @param {IRedisCacheOptions|null|undefined} [options] Custom options.
     */
    public constructor(options?: IRedisCacheOptions | null) {
        const redis = require('redis');

        let host: string | undefined;
        let port: number | undefined;
        if (options) {

        } else {
            const REDIS_HOST = process.env.REDIS_HOST?.trim();
            const REDIS_PORT = process.env.REDIS_PORT?.trim();

            host = REDIS_HOST;
            if (!host?.length) {
                host = 'localhost';
            }

            if (REDIS_PORT?.length) {
                port = parseInt(REDIS_PORT);
            }
        }

        this.client = redis.createClient({
            host,
            port
        });

        this.client.on('error', (error: any) => {
            console.warn(`REDIS ERROR: ${error}`, {
                file: __filename
            });
        });

        this.delAsync = promisify(this.client.del).bind(this.client);
        this.flushdbAsync = promisify(this.client.flushdb).bind(this.client);
        this.getAsync = promisify(this.client.get).bind(this.client);
        this.setAsync = promisify(this.client.set).bind(this.client);
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
     * // if "foo2" does not exist, "bar" is returned
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
            return await this.flushdbAsync('ASYNC');
        } catch {
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
     * @param {TDefault} [defaultValue] The custom default value.
     *
     * @returns {Promise<TResult|TDefault|undefined>} The promise with the value or the default value.
     */
    public get<TResult extends any = any>(key: string): Promise<TResult | undefined>;
    public get<TResult, TDefault>(key: string, defaultValue: TDefault): Promise<TResult | TDefault>;
    public async get<TResult extends any = any, TDefault extends any = any>(key: string, defaultValue?: TDefault): Promise<TResult | TDefault | undefined> {
        try {
            const value = await this.getAsync(key);

            if (typeof value === 'string') {
                return JSON.parse(value);
            }
        } catch { }

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
     * @param {number|false} [ttl] The time in seconds, the value "lives". (false) indicates that the value does not become invalid and "lives forever".
     *
     * @returns {Promise<boolean>} The promise, that indicates if operation was successful or not.
     */
    public async set(key: string, value: any, ttl: number | false = 3600): Promise<boolean> {
        try {
            if (value === null || typeof value === 'undefined') {
                await this.delAsync(key);
            } else {
                const jsonStr = JSON.stringify(value);

                if (ttl === false) {
                    await this.setAsync(key, jsonStr);
                } else {
                    await this.setAsync(key, jsonStr, 'EX', ttl);
                }
            }

            return true;
        } catch {
            return false;
        }
    }

    private readonly delAsync: any = null;
    private readonly flushdbAsync: any;
    private readonly getAsync: any;
    private readonly setAsync: any;
}

/**
 * @inheritdoc
 */
export default RedisCache;
