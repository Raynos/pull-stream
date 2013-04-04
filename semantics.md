# Pull stream

A pull stream is a representation of an asynchronous source that is nonending and contains either 1 or more chunks of data, which are not all available at the same time.

An infinite source of data with no natural way to end is not a pull stream.
A source of data that always returns a single chunk is not a pull stream.

## Interacting with a pull stream

To interact with a pull stream you use a reader. A reader is in charge of asking the pull stream for a chunk and then doing something with that data.

## Pull stream interface

A pull stream is a `function (closing, callback) {}`. It is understood this function is not pure and has access to an asynchronous source in a closure scope.

When called with a falsey `closing` value it should not treat that value as any kind of closing message and ignore it. If `closing` is falsey then it should have been called with a `function callback(err, value)`. It is now responsible for either finding a chunk and calling `callback(null, value)` in the future or determining that the stream contains no more data and calling `callback(true)` which is the mechanism for which to signal the reader that it has ended. Or the stream may either transition into an error state and call `callback(err)`

A pull stream must adhere to sending one or more chunks followed by either `END` or `ERROR`. It must not send both `END` and `ERROR`. It must not send multiple `ERROR`s. It must not somehow recover from an `ERROR` and send more chunks.

If a `reader` calls the pull stream multiple times before the pull stream has called the readers callback it is allowed to send the chunks to any callback it wants. It must not call two callbacks with the same chunk. When the pull stream ends or errors it should call one of the callbacks with the error message / end message. It must not send error/end to all callbacks. Once the stream has either ended or errored it must not invoke the other callbacks.

If `closing` is the value `true` then the stream should attempt to close the underlying asynchronous source and then it must call the callback with either `end` meaning that the source has succesfully closed and no more data will flow through it or `ERROR` meaning that there was an error closing the source.

Once a pull stream has received `closing` it must not call any of it's outstanding callbacks with a value.

A pull stream is not allowed to do any kind of asynchronous error inducing action unless it has an outstanding callback it can call with an error. This means that when a pull stream is created it must not open its underlying source until it's called at least once. This will avoid the `unhandled error` situation.

## Reader interface

A reader may call the stream either one chunk at a time, or many in parallel. When a reader receives the `END` or `ERROR` message it is not allowed to call the pull stream again.

If a reader invokes a stream with `closing === true` then it is not allowed to call that stream again, ever.

## Duplex streams

To operate on streams from a higher order point of view you should use duplex functions. A duplex takes a pull stream and returns a new pull stream. The new pull stream will do some kind of modification to the either values in the stream or the reading flow of the pull stream.

## Backchannel amendum

Any duplex stream. i.e. a function `PullStream -> PullStream` should pass forward the `err` message. If the `err` message is not `true` or an `Error` it should not interpret it as some kind of special meaning and just pass it on directly to the reader.

Any duplex stream should pass on the `closing` value backwards to the source. If it's not the value `true` it should not interpret it as having any kind of special meaning. Doing this is actually hard in the case of merge as we can't call the callback multiple times per closing message.

## merge

When you have a merged stream of multiple inputs. It becomes very hard to know how to handle a custom `closing` message as the reader is expecting to be talking to one stream not multiple. This means that merge needs to know how to split the closing message and talk to each source and then re-assemble a coherent response message to forward to the reader.

This is a non-trivial limitation of the `callback` get's called once model.
