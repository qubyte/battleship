# battleship

Notes:

 - New data is assumed to be appended to files, rather than used to replace
   them.
 - Since the serialization does not allow otherwise, lines are written to the
   holoscreen file only when at least the radar for the given coordinates is
   known.
 - With more time I'd be tempted to have fun with the file parsing. I had some
   [fun with a similar task][aoc] in the last Advent of Code using Rust.
 - The radar application has the most comprehensive code comments and tests.

## Quick start

`build.sh` and `run.sh` are thin wrappers around `docker-compose`. To get up
and running quickly and refresh the images you can also run:

```shell
docker-compose up --build
```

## Key decisions:

### docker-compose

I've used docker compose to automate building of images and creations of
containers and the network for them.

These containers mount the local `hw` directory as `/hw`.

### Node.js

I've used Node since it's what I'm most familiar and most productive
with (currently).

### tests

I ran out of time to do much testing, but see some tests in the radar directory.

TODO:

 - Abstract radar and rt into a common base image. Only the data parser and the
   serializer differ.
 - Revisit choice of EventSource. I still think it's a reasonable fit for fairly
   low volume data, but it looks clunky in the display application.
 - Holoscreen is sent data as it's detected, but only writes it at intervals.
   This can be improved.
 - Sanitise data.
 - Add debug logging.

[aoc]: https://qubyte.codes/blog/parsing-input-from-stdin-to-structures-in-rust
