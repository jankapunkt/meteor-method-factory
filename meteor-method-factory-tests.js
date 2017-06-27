// Import Tinytest from the tinytest Meteor package.
import { Tinytest } from "meteor/tinytest";

// Import and rename a variable exported by meteor-method-factory.js.
import { name as packageName } from "meteor/jkuester:meteor-method-factory";

// Write your tests here!
// Here is an example.
Tinytest.add('meteor-method-factory - example', function (test) {
  test.equal(packageName, "meteor-method-factory");
});
