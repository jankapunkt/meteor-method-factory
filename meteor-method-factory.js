import {check} from 'meteor/check';
import {ValidatedMethod} from 'meteor/mdg:validated-method';
import {SimpleSchemaFactory} from 'meteor/jkuester:simpl-schema-factory';
import {Roles} from 'meteor/alanning:roles';
import {Random} from 'meteor/random';
import {DDPRateLimiter} from 'meteor/ddp-rate-limiter';
import {_} from 'meteor/underscore';

export const MethodFactory = {

	//////////////////////////////////////////////////////////////////////////////////////////////////
	//
	//  ERRORS
	//
	//////////////////////////////////////////////////////////////////////////////////////////////////

	errors: {
		DOCUMENT_NOT_FOUND:"no document found by given id",
		PERMISSION_NOT_LOGGED_IN: "Permission denied for not logged in users.",
		PERMISSION_NOT_IN_ROLES: "Permission denied, user has no roles for using this feature",
		PERMISSION_NOT_EXPECTED_USER: "Permission denies, you are not the expected user",
		PERMISSION_NOT_REGISTERED_USER: "Permission denied, you are not a registered user.",
		PERMISSION_NO_ADMIN: "Permission denied for non admins.",
		UNEXPECTED: "Unexpected code reach. The code should never reach this point.",

		MISSING_SCHEMA:"Collection is missing a schema to validate insert/update",

		EXECUTION_SERVER_ONLY: "This code is server side and cannot be executed on the client",
		EXECUTION_CLIENT_ONLY: "This code is client side and cannot be executed on the server",
		WRONG_PARAMETER_TYPE: "Wrong parameter type provided.",
		WRONG_ARGUMENTS:"Wrong arguments provided.",

		INSERT_FAILED_DOC_EXISTS: "Insert failed. The document already exists. Use an update-method to update or replace the existing document",



		SCHEMA_NOT_CONFORM:"Schema is not a proper SimpleSchema instance",
		VALIDATION_MISSING_ID:"validation failed, missing _id",
		VALIDATION_MISSING_MODIFIER:"validation failed, missing modifier",
	},

	//////////////////////////////////////////////////////////////////////////////////////////////////
	//
	//  HELPERS
	//
	//////////////////////////////////////////////////////////////////////////////////////////////////

	checkUser(userId) {
		if (!userId) {
			throw new Meteor.Error(this.errors.PERMISSION_NOT_LOGGED_IN);
		}
		if (typeof userId !== 'string') {
			throw new Meteor.Error(this.errors.WRONG_PARAMETER_TYPE);
		}

		if (!Meteor.users.findOne({_id: userId})) {
			throw new Meteor.Error(this.errors.PERMISSION_NOT_REGISTERED_USER);
		}
		return true;
	},

	checkSchema(schema){
		if (!SimpleSchemaFactory.isSimpleSchema(schema))
			throw new Meteor.Error(this.errors.SCHEMA_NOT_CONFORM);
	},

	checkCollection(collection) {
		check(collection, Mongo.Collection);
		if (!collection.schema) throw new Meteor.Error(this.errors.MISSING_SCHEMA)
	},

	checkDoc(docId, collection){
		check(docId, String);
		check(collection, Mongo.Collection);
		const doc = collection.findOne(docId);
		if (!doc) throw this.errors.DOCUMENT_NOT_FOUND;
		return doc;
	},

	//////////////////////////////////////////////////////////////////////////////////////////////////
	//
	//  COLLECTION METHODS
	//
	//////////////////////////////////////////////////////////////////////////////////////////////////

	getInsertMethodDefault(collection, methodName, validationHook){

		this.checkCollection(collection);

		return new ValidatedMethod({
			name: methodName,
			validate(insertDoc) {
				if (validationHook) {
					validationHook(insertDoc);
				}
				try {
					collection.schema.validate(insertDoc);
				}catch(err) {
					throw new Meteor.Error("500 - " + (err.name|| ""), (err.message || err.reason), JSON.stringify(insertDoc));
				}
			},
			applyOptions: {
				noRetry: true,
			},
			//roles: [], //TODO
			run(insertDoc){
				MethodFactory.checkUser(this.userId);

				if (insertDoc._id && collection.findOne(insertDoc._id))
					throw new Meteor.Error(this.ERRORS.INSERT_FAILED_DOC_EXISTS)

				return collection.insert(insertDoc, null);
			}
		});
	},

	getUpdateMethodDefault(collection, methodName){
		this.checkCollection(collection);

		return new ValidatedMethod({
			name: methodName,
			validate(updateDoc){
				try {
					collection.schema.validate(updateDoc);
				}catch(err) {
					throw new Meteor.Error("500 - " + (err.name|| ""), (err.message || err.reason), JSON.stringify(updateDoc));
				}
			},
			//roles: [], //TODO
			run(updateDoc) {
				MethodFactory.checkUser(this.userId);
				const docId = updateDoc._id;
				MethodFactory.checkDoc(docId, collection);
				delete  updateDoc._id;
				return collection.update({_id: docId}, {$set: updateDoc}); //TODO use replaceOne in Mongo 3.2
			},
		});
	},

	getAutoFormUpdateMethod(collection, methodName) {
		this.checkCollection(collection);

		return new ValidatedMethod({
			name: methodName,
			validate(args) {
				//console.log("validate:", args);
				const docId = args._id;
				const modifier = args.modifier;
				if (!docId)
					throw new Meteor.Error(methodName + " validation error - _id is required");
				if (!modifier)
					throw new Meteor.Error(methodName + " validation error - modifier is required");
				if (!modifier.$set && !modifier.$unset)
					throw new Meteor.Error(methodName + " validation error - $set / $unset");

				const updateDoc = modifier.$set ? modifier.$set : modifier.$unset;
				try {
					collection.schema.validate(updateDoc);
				}catch(err) {
					throw new Meteor.Error("500 - " + (err.name|| ""), (err.message || err.reason), JSON.stringify(args))
				}
			},
			//roles: [], //TODO
			run(updateDoc) {
				MethodFactory.checkUser(this.userId);
				const docId = updateDoc._id;
				MethodFactory.checkDoc(docId, collection);
				return collection.update({_id: docId}, updateDoc.modifier); //TODO use replaceOne in Mongo 3.2
			},
		});
	},

	getRemoveMethodDefault(collection, methodName){
		return new ValidatedMethod({
			name: methodName,
			validate(removeDoc){
				try {
					SimpleSchemaFactory.docId().validate(removeDoc);
				}catch(err) {
					throw new Meteor.Error("500 - " + (err.name|| ""), (err.message || err.reason), JSON.stringify(removeDoc));
				}
			},
			//roles: [], //TODO
			run(removeDoc) {
				const docId = removeDoc._id;
				MethodFactory.checkUser(this.userId);
				MethodFactory.checkDoc(docId, collection);
				return collection.remove(docId);
			},
		});

	},


	getFindOneMethodDefault(collection, methodName) {
		return new ValidatedMethod({
			name: methodName,
			validate(findDoc){
				try {
					SimpleSchemaFactory.docId().validate(findDoc);
				}catch(err) {
					throw new Meteor.Error("500 - " + (err.name|| ""), (err.message || err.reason), JSON.stringify(findDoc));
				}
			},
			//roles: [], //TODO
			run(findDoc) {
				const docId = findDoc._id;
				MethodFactory.checkUser(this.userId);
				const doc = collection.findOne(docId);
				// need further checks here?
				return doc;
			},
		});
	},


	getCloneMethodDefault(collection, methodName) {
		return new ValidatedMethod({
			name: methodName,
			validate(cloneDoc){
				try {
					SimpleSchemaFactory.docId().validate(cloneDoc);
				}catch(err) {
					throw new Meteor.Error("500 - " + (err.name|| ""), (err.message || err.reason), JSON.stringify(cloneDoc));
				}
			},
			//roles: [], //TODO
			run(cloneDoc) {
				MethodFactory.checkUser(this.userId);
				const docId = cloneDoc._id;
				MethodFactory.checkDoc(docId, collection)
				const doc = collection.findOne(docId);
				delete doc._id;
				return collection.insert(doc);
			},
		});
	},


	getCountMethodDefault(collection, methodName) {
		return new ValidatedMethod({
			name: methodName,
			validate(query){
				if (!query || typeof query !== 'object')
					throw new Meteor.Error("500", MethodFactory.errors.WRONG_PARAMETER_TYPE);
				const schemaKeys = collection.schema._schemaKeys;
				const queryKeys  = Object.keys(query);
				for (let key of queryKeys) {
					if (schemaKeys.indexOf(key) === -1)
						throw new Meteor.Error("500", MethodFactory.errors.WRONG_ARGUMENTS, JSON.stringify(query) +" -> not in -> " + JSON.stringify(collection.schema._schemaKeys));
				}
			},
			run(query) {
				MethodFactory.checkUser(this.userId);
				return collection.find(query).count();
			},
		});
	},


	/**
	 * Adds method rules to DDPRateLimiter
	 * @param methods {Array}
	 * @param maxCount {Number}
	 * @param timeOut {Number}
	 * @returns {boolean}
	 */
	rateLimit(methods, maxCount = 5, timeOut = 1000) {
		//check({methods:[String],});
		if (!Meteor.isServer)
			throw new Meteor.Error(this.errors.EXECUTION_SERVER_ONLY);

		// Get list of all method names on Lists
		const METHODS = _.pluck(methods, 'name');

		// Only allow 5 list operations per connection per second (1000ms)
		DDPRateLimiter.addRule({
			name(name) {
				return METHODS.indexOf(name) > -1;
			},
			// Rate limit per connection ID
			connectionId() { return true; },
		}, maxCount, timeOut);
	},

	//////////////////////////////////////////////////////////////////////////////////////////////////
	//
	//  ALLOW/DENY METHODS
	//
	//////////////////////////////////////////////////////////////////////////////////////////////////

	getDefaultAllowSettings(collection, roles, domain) {
		return {
			insert: this.getAllowInsert(collection, roles, domain),
			update: this.getAllowUpdate(collection, roles, domain),
			remove: this.getAllowRemove(collection, roles, domain),
		};
	},


	getAllowInsert(collection, roles, domain) {
		this.checkCollection(collection);
		return function (userId, doc) {

			// check if user is a valid user in this system
			MethodFactory.checkUser(userId);

			//check user and roles
			if (!Roles.userIsInRole(userId, roles, domain))
				throw new Meteor.Error(MethodFactory.ERRORS.PERMISSION_NOT_IN_ROLES);

			//validate doc by Schema
			//return false if failed
			const vc = collection.schema.newContext();
			vc.clean(doc);
			vc.validate(doc);
			return vc.isValid();
		};
	},

	getAllowUpdate(collection, roles, domain) {
		this.checkCollection(collection);
		return function (userId, doc) {

			MethodFactory.checkUser(userId);

			//check user and roles
			if (!Roles.userIsInRole(userId, roles, domain))
				throw new Meteor.Error(MethodFactory.ERRORS.PERMISSION_NOT_IN_ROLES);

			MethodFactory.checkDoc(doc._id, collection);

			// delete _id because
			// otherwise schema validation fails
			delete doc._id;

			//validate doc by Schema
			//return false if failed
			const vc = collection.schema.newContext();
			vc.clean(doc);
			vc.validate(doc);
			return vc.isValid();
		};
	},

	getAllowRemove(collection, roles, domain) {
		this.checkCollection(collection);
		return function (userId, doc) {

			MethodFactory.checkUser(userId);

			//check user and roles
			if (!Roles.userIsInRole(userId, roles, domain))
				throw new Meteor.Error(MethodFactory.ERRORS.PERMISSION_NOT_IN_ROLES);

			MethodFactory.checkDoc(doc._id, collection);

			//validate doc by Schema
			//return false if failed
			const vc = collection.schema.newContext();
			vc.validate(doc);
			return vc.isValid();
		};
	},
};

