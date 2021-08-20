[![npm](https://img.shields.io/npm/v/@egomobile/redis.svg)](https://www.npmjs.com/package/@egomobile/redis) [![last build](https://img.shields.io/github/workflow/status/egomobile/redis/Publish)](https://github.com/egomobile/node-redis/actions?query=workflow%3APublish) [![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat-square)](https://github.com/egomobile/node-redis/pulls)

# @egomobile/redis

> Redis classes and utilities for [Node.js 12](https://nodejs.org/en/blog/release/v12.0.0/) or later.

## Install

Execute the following command from your project folder, where your `package.json` file is stored:

```bash
npm install --save @egomobile/redis
```

## Usage

```typescript
import RedisCache from "@egomobile/redis";

const cache = new RedisCache();

await cache.flush(); // remove all entries

// non existing values
await cache.get("foo"); // (undefined)
await cache.get("foo", "TM"); // "TM"

await cache.set("foo", "bar"); // set "bar" value to "foo" key
await cache.get("foo", "TM"); // "bar"

await cache.set("foo", null); // remove value
// alternative: await cache.set("foo", undefined)
await cache.get("foo", "TM"); // "TM"
```

## Documentation

The API documentation can be found [here](https://egomobile.github.io/node-redis/).
