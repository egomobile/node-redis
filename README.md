[![npm](https://img.shields.io/npm/v/@egomobile/redis.svg)](https://www.npmjs.com/package/@egomobile/redis) [![last build](https://img.shields.io/github/workflow/status/egomobile/node-redis/Publish)](https://github.com/egomobile/node-redis/actions?query=workflow%3APublish) [![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat-square)](https://github.com/egomobile/node-redis/pulls)

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

## Data fetchers

Data fetchers are higher ordered function, which ensure, that data is cached and loaded at least once successfully.

```typescript
import axios from "axios";
import RedisCache from "@egomobile/redis";

const cache = new RedisCache();

// loadRandomUsers: (seed: string) => Record<string, any>
const loadRandomUsers = cache.createFetcher(
  // the name of the key where to store in
  // underlying `RedisCache` instance in `cache`
  "randomUsersKey",

  // the function to wrap
  async (seed: string) => {
    const response = await axios.get(
      `https://randomuser.me/api/?seed=${encodeURIComponent(seed)}`
    );

    // Record<string, any>
    return response.data;
  }
);

// first call MUST be successful, otherwise
// exception is re-thrown
const data1 = await loadRandomUsers("foobar1");

// should be same as `data1`, because it is cached
//
// this method does exactly the same as the function itself (and has its same structure), but
// returns an object with extended information and without throwing an error
const { value: data2 } = await loadRandomUsers.fetch("foobar2");

// reset and force reloading data
//
// after reset, the execution MUST be successful at least one time again
await loadRandomUsers.reset();
const data3 = await loadRandomUsers("foobar3");
```

## Documentation

The API documentation can be found [here](https://egomobile.github.io/node-redis/).
