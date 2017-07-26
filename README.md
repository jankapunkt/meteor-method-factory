[![Build Status](https://travis-ci.org/jankapunkt/meteor-method-factory.svg?branch=master)](https://travis-ci.org/jankapunkt/meteor-method-factory)
[![Project Status: Active – The project has reached a stable, usable state and is being actively developed.](http://www.repostatus.org/badges/latest/active.svg)](http://www.repostatus.org/#active)


# Meteor Method Factory

Create validated method by given input.

## Roadmap

TODO / TO BE IMPLEMENTED

- checkRoles
- hooks (before, after)
- wrap params for main functions into object with attributes
- applyOptions as parameter
- pass Schema as optional param in order to omit dependencies between Mongo.Collection and SimpleSchema (for those who don't use collection2-core)
- update method for custom fields, in order to not require to update the whole document for now


## Changelog

0.1.2 - Added and tested `getCloneMethodDefault`

0.1.1 - Method validations are now rethrowing errors as meteor errors with detailed information.


## API


### Main Functions

######General

- All the functions make use of [mdg:validated-method](https://github.com/meteor/validated-method) and require a Mongo.Collection instance and a method name.
- Before generating the method, there is a call to `checkCollection` to avoid runtime errors regarding missing collections.
- All methods validate by the Mongo.Collection schema. Make sure you have a Schema attached to each collection.
- Validation errors are rethrown as Meteor.Error in order to give clients more transparency about failures.
- User access is checked at runtime (TODO: add also optional roles checking)
- The Method call parameter describes the parameters, that are necessary to be passed when using `Meteor.call`

###### getInsertMethodDefault(Mongo.Collection collection, String methodName)

Creates and returns a validated insert method, that adds inserts a (schema-valid) document into the given collection

Method call parameter: Object insertDoc (without _id and all fields required by collection schema)

Note: denies documents that have already have an ID and thus exist in the database. If you want to clone existing documentes use `getCloneMethodDefault`.


###### getUpdateMethodDefault(Mongo.Collection collection, String methodName)

Creates and returns a validated update method, that adds updates a (schema-valid) document into the given collection.

Method call parameter: Object updateDoc (with _id and all fields required by collection schema)

Note: this method needs all required fields of the schema to be present in the updateDoc, including the _id. It is a full-document update. 

###### getAutoFormUpdateMethod(Mongo.Collection collection, String methodName)

Creates and returns a validated update method, that is conform the the aldeed:autoform method-update schema.


Method call parameter: 

Object updateDoc with schema

updateDoc._id - the id of the doc to be updated
updateDoc.modifier - the doc to be updated including all fields required by the schema.

See [aldeed:autoform - method-update](https://github.com/aldeed/meteor-autoform#method-update) for more

###### getRemoveMethodDefault(Mongo.Collection collection, String methodName)

Creates and returns a validated remove method, that is conform that removes a document by a given id.

Method call parameter: {_id:String}

###### getFindOneMethodDefault(Mongo.Collection collection, String methodName)

Creates and returns a validated method to find a single document by id.

Method call parameter: {_id:String}

###### getCloneMethodDefault(Mongo.Collection collection, String methodName)

Creates and returns a validated insert method, that inserts a (schema-valid) document into the given collection by an existing document, using an exact copy of it's field entries.

Method call parameter: Object insertDoc (witg _id and all fields required by collection schema)


###### rateLimit([ValiatedMethod] methods, Number maxCount = 5, Number timeOut = 1000)

Basically the rateLimit form the meteor example projects. Requires your created validated methods as an array in order to rate limit their calls.

### Helpers

###### checkUser(String userId)

Checks if the given user by userId is a) not undefined and b) exists within the current applications user collection.
 
Returns true, if successful. Throws Errors, if failing.

###### checkSchema(SimpleSchema schema)

Checks, whether a given schema is an instance of `SimpleSchema`. It does not check the schema validity, which is done in each validate method.
Throws Errors, if failing.

###### checkCollection(Mongo.Collection collection)

Checks, whether a given collection is a Mongo.Collection (or extending it.)
Throws Errors, if failing.

###### checkDoc(Object doc, Mongo.Collection collection)

Checks, whether the given doc exists in the given collection.

### ALLOW/DENY

Note: that it is suggested to NOT use client side allow/deny and thus deny all client actions. 
However, if you can't resist or for whatever good reason need to use them, here are some handy generic functions to create them.
Note2: makes use of [alanning:roles](https://github.com/alanning/meteor-roles) in order to verify client side db access. Roles require an array of strings as roles and a string as name of the group/domain.
 
###### getDefaultAllowSettings(Mongo.Collection collection, [String] roles, String domain)

Returns an object with insert, update and remove functions, created by `getAllowInsert`, `getAllowUpdate` and `getAllowRemove`.
By doing so, it uses the same collection/roles/domain settings for all the three sub-calls.


###### getAllowInsert(Mongo.Collection collection, [String] roles, String domain)

Creates an insert allow method for the given collection, roles and domain.

###### getAllowUpdate(Mongo.Collection collection, [String] roles, String domain)

Creates an update allow method for the given collection, roles and domain.

###### getAllowRemove(Mongo.Collection collection, [String] roles, String domain)

Creates a remove allow method for the given collection, roles and domain.



## Contributions

### General

PR and feature requests are very welcome. Please use the included `test` project to verify your new written code.

### Dependencies

If you create new dependencies, please check, if they are really necessary.

### Testing

You can either use watch mode tests or cli tests. In any case you need to cd into the project's test project and install the dependencies first.

```bash
cd meteor-method-factory/tests
meteor npm install
```

For watch mode call

```bash
meteor npm run test
```

For cli mode call

```bash
meteor reset #cleans the project and avoids the 'missing select error'
meteor npm run testcli
```

