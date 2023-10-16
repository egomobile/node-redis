# Change Log (@egomobile/redis)

## 2.0.0

- add `createFetcher()` to [RedisCache](https://egomobile.github.io/node-redis/classes/RedisCache.html)
- add `onError()` to [IRedisCacheOptions](https://egomobile.github.io/node-redis/interfaces/IRedisCacheOptions.html)
- [close() method](https://egomobile.github.io/node-redis/classes/RedisCache.html#close) is async now
- **BREAKING CHANGE**: [close() method](https://egomobile.github.io/node-redis/classes/RedisCache.html#close) is async now
- module requires at least [Node 18+](https://nodejs.org/gl/blog/release/v18.0.0/)
- downgrade to [redis 3.1.2](https://www.npmjs.com/package/redis) to re-add support for [Redis 5+](https://redis.io/)

## 1.0.0

- **BREAKING CHANGE**: first parameter of [close()](https://egomobile.github.io/node-redis/classes/index.RedisCache.html#close) method has now another meaning and indicates if the connect should be closed immediately or gracefully
- module requires at least [Node 14+](https://nodejs.org/gl/blog/release/v14.0.0/)
- upgrade to new [ESLint config](https://github.com/egomobile/eslint-config-ego)
- upgrade to [redis 4.1.0](https://www.npmjs.com/package/redis) to add support for [Redis 7+](https://redis.io/)
- other `npm update`s

## 0.3.0

- code cleanups and improvements
- bugfixes

## 0.2.0

- add `close()` method to [RedisCache](https://egomobile.github.io/node-redis/classes/index.RedisCache.html) class

## 0.1.3

- initial release
