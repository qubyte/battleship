# radar

This application is an HTTP server that monitors a hardware file for changes.
Upon a change, the content appended to the file will be sent to all connections
as an EventSource event.

## polling

Like the radiotelescope, this application at one time used a file system watcher
to know when to send events. However, there is the opportunity for new file
system events to be missed while reading the file, so this service instead polls
the file system for changes every 100ms.

## Handler

To make testing simpler, handlers are created by a function to avoid global
state. Upon the need to dispose a handler (i.e. during shutdown or at the end of
a test) the `close` method of the handler must be called to stop it polling.

## paths

Events are hosted on the `/events` path. All other paths serve a minimal HTML
page so that the events can be tested in a browser.

## parsing

Parsing assumes well formed data. This should be updated to filter out
incorrectly formatted lines.
