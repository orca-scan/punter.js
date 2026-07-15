'use strict';

var setup = require('../setup');

afterAll(async function () {
    await setup.stop();
});
