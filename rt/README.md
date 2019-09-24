# radiotelescope

This application is very similar to radar. See the readme and tests there for
more detail.

Unlike the radar, this service still uses a file system watcher, and there is
the potential for events to be missed during a file read. For frequent data this
poses no problem, but it may be an issue with short bursts of data.
