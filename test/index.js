var test = require("tape")

var pull-stream = require("../index")

test("pull-stream is a function", function (assert) {
    assert.equal(typeof pull-stream, "function")
    assert.end()
})
