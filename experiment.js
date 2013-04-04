// A pull stream is a function readable(closing, cb<err, chunk>)
// To extract a chunk out of the stream simply call (null, cb)
// to get another value call it again.
// The stream will tell you if it's ended by invoking cb(true)
// The stream will tell you if it errored by invoking cb(Error)
// You can tell the stream to close / destroy by calling stream(true, cb)
var stream = (function () {
    var list = [1, 2, 3, 4]

    return function stream(closing, callback) {
        if (closing) {
            callback(true)
        } else {
            var value = list.shift()
            if (value) {
                callback(null, value)
            } else {
                callback(true)
            }
        }
    }
}())
var nil = {}

function print(stream) {
    stream(null, function log(error, value) {
        if (error === true)  {
            console.log("END")
        } else if (error) {
            console.error("eep! ", err)
        } else  {
            console.log("> ", value)
            stream(null, log)
        }
    })
}

function map(lambda, source) {
    return function stream(closing, callback) {
        source(closing, function (err, value) {
            callback(err, err ? null : lambda(value))
        })
    }
}

function filter(predicate, source) {
    return function stream(closing, callback) {
        source(closing, function filtered(err, value) {
            if (err) return callback(err)
            predicate(value) ? callback(null, value) : source(null, filtered)
        })
    }
}

function reductions(lambda, initial, source) {
    var state = initial
    return function stream(closing, callback) {
        source(closing, function (err, value) {
            if (err) return callback(err)
            state = lambda(state, value)
            callback(null, state)
        })
    }
}

function last(source) {
    var result = nil
    var ended = false
    return function stream(closing, callback) {
        if (ended) return callback(true)

        source(closing, function (err, value) {
            if (err === true) {
                ended = true
                result !== nil ? callback(null, result) : callback(true)
            } else if (err) {
                callback(err)
            } else {
                result = value
            }
        })
    }
}

function reduce(lambda, initial, source) {
    return last(reductions(lambda, initial, source))
}

function empty(closing, cb) { cb(true) }

function take(n, source) {
    return n <= 0 ? empty : function stream(closing, callback) {
        if (n === 0) return source(true, callback)

        source(closing, function (err, value) {
            if (err) return callback(err)
            n--
            callback(null, value)
        })
    }
}

function takeWhile(predicate, source) {
    return function stream(closing, callback) {
        source(closing, function (err, value) {
            if (err) return callback(err)
            predicate(value) ? callback(null, value) : source(true, callback)
        })
    }
}

function drop(n, source) {
    return n <= source ? function stream(closing, callback) {
        if (n === 0) return source(closing, callback)

        source(closing, function forward(err, value) {
            if (err) return callback(err)
            n--
            source(null, forward)
        })
    }
}

function dropWhile(predicate, source) {
    var forwarding = false
    return function stream(closing, callback) {
        if (forwarding) return source(closing, callback)
        source(closing, function (err, value) {
            if (err) return callback(err)
            var drop = predicate(value)
            if (!drop) {
                forwarding = true
                callback(null, value)
            }
        })
    }
}

function isError(err) {
    return err instanceof Error
}

/*  Merge ::  [Stream] -> Stream

    merge is messy because it has to shutdown underlying streams cleanly per
        protocol.

    Ignoring error handling, all it does is once it's read it either flushes
        a single item out of it's buffer or it makes a read request to all
        underlying streams in parallel and returns the first result. This means
        it will pull on all streams concurrently and give you a message once
        the first one returns. So you can pull at the rate of the fastest
        stream but still equally get messages from other streams.
*/
function merge(sources) {
    var buffer = []
    var closed = []
    var ended = false

    function shutdown(closing, callback) {
        // if you close this stream it should close all the underlying
        // streams. If any error propagate the first error. If they all
        // close cleanly then return end.
        var count = sources.length
        return sources.forEach(function (source, index) {
            // Make sure to check whether this source is already closed
            // If a source has errored, consider it closed
            if (closed[index]) return

            source(closing || true, function (err) {
                closed[index] = true

                if (err !== true && !ended) {
                    ended = true
                    callback(err)
                } else if (!ended) {
                    --count
                    if (count === 0) {
                        ended = true
                        callback(true)
                    }
                }
            })
        })
    }

    return sources.length === 0 ? empty : function stream(closing, callback) {
        // only shutdown is closing === true
        if (closing === true) {
            return shutdown(closing, callback)
        // forward all other `closing` messages to the first non-closed stream
        } else if (closing) {
            for (var i = 0; i < sources.length; i++) {
                if (!closed[i]) {
                    return sources[i](closing, callback)
                }
            }
        }

        if (buffer.length) {
            return callback(null, buffer.shift())
        }

        var send = false

        sources.forEach(function (source, index) {
            if (closed[index]) return

            source(null, function (err, value) {
                if (ended) return

                // Only shutdown if we have END or ERROR
                if (err === true || isError(err)) {
                    ended = true
                    // mark this stream as closed so that we don't try to
                    // close an already errored stream
                    closed[index] = true
                    callback(err)
                    // one stream errored, so close all the other ones
                    return shutdown()
                // forward all other `err` channel messages
                } else if (err) {
                    callback(err)
                // if we have not send a chunk forward for this callback then
                // just send it
                } else if (!send) {
                    send = true
                    callback(null, value)
                // otherwise buffer this chunk
                } else {
                    buffer.push(value)
                }
            })
        })
    }
}
