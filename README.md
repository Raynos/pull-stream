# pull-stream

<!-- [![build status][1]][2] [![dependency status][3]][4]

[![browser support][5]][6] -->

Idea for pull streams

## Example

```js
var ones = function (abort, callback) {
    callback(null, 1)
}

var sink = function () {
    return function (stream) {
        stream(null, function log(err, value) {
            console.log("(", err, ", ", value, ")")

            stream(null, log)
        })
    }
}

var double = function (source) {
    return function (abort, callback) {
        source(abort, function (err, value) {
            callback(err, err ? null : value * 2)
        })
    }
}

sink(double(ones))
```

## Installation

`npm install pull-stream`

## Contributors

 - Raynos

## MIT Licenced

  [1]: https://secure.travis-ci.org/Raynos/pull-stream.png
  [2]: https://travis-ci.org/Raynos/pull-stream
  [3]: https://david-dm.org/Raynos/pull-stream.png
  [4]: https://david-dm.org/Raynos/pull-stream
  [5]: https://ci.testling.com/Raynos/pull-stream.png
  [6]: https://ci.testling.com/Raynos/pull-stream
