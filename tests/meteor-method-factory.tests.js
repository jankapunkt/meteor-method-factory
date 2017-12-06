import {Meteor} from 'meteor/meteor';
import {Random} from 'meteor/random';
import {Roles} from 'meteor/alanning:roles';
import {Factory} from 'meteor/dburles:factory';
import {DDP} from 'meteor/ddp-client';
import {chai, assert} from 'meteor/practicalmeteor:chai';
import {CollectionFactory} from 'meteor/jkuester:meteor-collection-factory';
import {MethodFactory} from 'meteor/jkuester:meteor-method-factory';
import {MochaHelpers} from 'meteor/jkuester:meteor-mocha-helpers';
import {SimpleSchemaFactory} from 'meteor/jkuester:simpl-schema-factory';

if (Meteor.isServer) {


	const DummyCollection = CollectionFactory.createCollection({
		name: "dummy",
		schema: SimpleSchemaFactory.defaultSchema({
			_id: {type: String, optional: true},
			title: {type: String},
			code: {type: String},
			description: {type: String, optional: true},
			createdBy: {type: String, optional: true},
			createdAt: {type: Number, optional: true},
		}),
		publicFields: {
			title: 1,
			code: 1,
			description: 1
		}
	});


	Factory.define('dummy', DummyCollection, MochaHelpers.getDefaultPropsWith({})).after(insertDoc => {
		// hook after insert
		MochaHelpers.isDefined(insertDoc, 'object');
	});


	const testMethodDefaults = function (method, userId, param1) {
		//wrong schema
		assert.throws(function () {
			method._execute({userId}, {});
		}, /is required/);

		//no user logged in
		assert.throws(function () {
			method._execute({userId: null}, param1);
		}, MethodFactory.errors.PERMISSION_NOT_LOGGED_IN);

		//user not registered
		assert.throws(function () {
			method._execute({userId: Random.id(17)}, param1);
		}, MethodFactory.errors.PERMISSION_NOT_REGISTERED_USER);
	};

	const testAllowMethod = function (fct, userId) {
		assert.throws(function () {
			fct(null);
		}, MethodFactory.errors.PERMISSION_NOT_LOGGED_IN);

		assert.throws(function () {
			fct(Random.id(17));
		}, MethodFactory.errors.PERMISSION_NOT_REGISTERED_USER);

		assert.throws(function () {
			fct(userId);
		}, MethodFactory.errors.PERMISSION_NOT_IN_ROLES);
	};

	describe("MethodFactory", function () {

		let userId;

		beforeEach(function () {
			Meteor.users.remove({username: "john doe"});
			userId = Accounts.createUser({username: "john doe"});
			DummyCollection.remove({});
		});

		afterEach(function () {
			Meteor.users.remove(userId);
		});

		it("creates checkUser", function () {
			assert.throws(function () {
				MethodFactory.checkUser();
			}, MethodFactory.errors.PERMISSION_NOT_LOGGED_IN);

			assert.throws(function () {
				MethodFactory.checkUser({});
			}, MethodFactory.errors.WRONG_PARAMETER_TYPE);

			assert.throws(function () {
				MethodFactory.checkUser(Random.id(17));
			}, MethodFactory.errors.PERMISSION_NOT_REGISTERED_USER);

			const shouldBeTrue = MethodFactory.checkUser(userId);
			assert.isTrue(shouldBeTrue);
		});

		it("creates checkDoc", function () {
			const dummyDoc = Factory.create("dummy");
			MochaHelpers.isDefined(dummyDoc, 'object');

			const expectValidDoc = MethodFactory.checkDoc(dummyDoc._id, DummyCollection);
			MochaHelpers.isDefined(expectValidDoc, 'object');
			assert.deepEqual(expectValidDoc, dummyDoc);

			assert.throws(function () {
				MethodFactory.checkDoc(Random.id(17), DummyCollection);
			}, MethodFactory.errors.DOCUMENT_NOT_FOUND);
		});

		it("creates getInsertMethodDefault", function () {
			const INSERT_METHOD_NAME = "dummy.methods.insert";
			MochaHelpers.removeMethod(INSERT_METHOD_NAME);

			const insertMethod = MethodFactory.getInsertMethodDefault(DummyCollection, INSERT_METHOD_NAME);

			const insertDoc = {
				title: "the title",
				code: "0815",
				description: "some description",
			};

			testMethodDefaults(insertMethod, userId, insertDoc);

			//default
			const docId = insertMethod._execute({userId}, insertDoc)
			MochaHelpers.isDefined(docId, "string");

			const foundDoc = DummyCollection.findOne(docId);
			MochaHelpers.isDefined(foundDoc, "object");

			//doc already exists
			assert.throws(function () {
				insertMethod._execute({userId}, foundDoc);
			});

		});

		it("creates getUpdateMethodDefault", function () {
			const UPDATE_METHOD_NAME = "dummy.methods.update";
			MochaHelpers.removeMethod(UPDATE_METHOD_NAME);

			const updateMethod = MethodFactory.getUpdateMethodDefault(DummyCollection, UPDATE_METHOD_NAME);

			const insertDoc = Factory.create("dummy", {
				title: "some title",
				description: "some description",
				code: "0815",
			});

			const newTitle = "new title";

			const updateDoc = {
				_id: insertDoc._id,
				$set: {
					title: newTitle,
					description: insertDoc.description,
					code: insertDoc.code,
				}
			};
			const docId = insertDoc._id;
			const oldTitle = insertDoc.title;

			testMethodDefaults(updateMethod, userId, updateDoc);

			// default expected behavior
			updateMethod._execute({userId}, updateDoc);

			const updatedDoc = DummyCollection.findOne(docId);

			MochaHelpers.isDefined(updatedDoc, MochaHelpers.OBJECT);
			assert.equal(updatedDoc.title, newTitle);
			assert.notEqual(updatedDoc.title, oldTitle)
		});

		it("creates getAutoFormUpdateMethod", function () {
			const UPDATE_METHOD_NAME = "dummy.methods.autoformupdate";
			MochaHelpers.removeMethod(UPDATE_METHOD_NAME);

			const updateMethod = MethodFactory.getAutoFormUpdateMethod(DummyCollection, UPDATE_METHOD_NAME);

			const insertDoc = Factory.create("dummy", {
				title: "some title",
				description: "some description",
				code: "0815",
			});
			const docId = insertDoc._id;
			const oldTitle = insertDoc.title;
			insertDoc.title = "new title";
			delete insertDoc._id;

			// conform according to
			// the autoform documentation
			const autformUpdateDoc = {
				_id: docId,
				modifier: {$set: insertDoc,}
			}

			testMethodDefaults(updateMethod, userId, autformUpdateDoc);

			// default expected behavior
			updateMethod._execute({userId}, autformUpdateDoc);

			const updatedDoc = DummyCollection.findOne(docId);
			MochaHelpers.isDefined(updatedDoc, 'object');
			assert.equal(updatedDoc.title, insertDoc.title);
			assert.notEqual(updatedDoc.title, oldTitle)
		});

		it("creates getRemoveMethodDefault", function () {
			const REMOVE_METHOD_NAME = "dummy.methods.remove";
			MochaHelpers.removeMethod(REMOVE_METHOD_NAME);

			const removeMethod = MethodFactory.getRemoveMethodDefault(DummyCollection, REMOVE_METHOD_NAME);
			testMethodDefaults(removeMethod, userId, {_id: Random.id(17)});

			const insertDoc = Factory.create("dummy", {
				title: "some title",
				description: "some description",
				code: "0815",
			});

			// we should have just this one doc in the collection
			assert.equal(DummyCollection.find({}).count(), 1);

			removeMethod._execute({userId}, {_id: insertDoc._id});

			assert.equal(DummyCollection.find({}).count(), 0);
		});

		it("creates getCloneMethodDefault", function () {
			const CLONE_METHOD_NAME = "dummy-methods.clone";
			const cloneMethod = MethodFactory.getCloneMethodDefault(DummyCollection, CLONE_METHOD_NAME);
			testMethodDefaults(cloneMethod, userId, {_id: Random.id(17)});

			const insertDocId = DummyCollection.insert({
				title: "to be cloned",
				description: "some description",
				code: "0815",
			});

			const insertDoc = DummyCollection.findOne({_id: insertDocId});
			MochaHelpers.isDefined(insertDoc, MochaHelpers.OBJECT);

			// we should have just this one doc in the collection
			assert.equal(DummyCollection.find({}).count(), 1);

			const cloneResult = cloneMethod._execute({userId}, {_id: insertDoc._id});

			// now it should be two
			assert.equal(DummyCollection.find({}).count(), 2);

			const clonedDoc = DummyCollection.findOne({_id: cloneResult});

			assert.equal(clonedDoc.title, insertDoc.title);
			assert.equal(clonedDoc.description, insertDoc.description);
			assert.equal(clonedDoc.code, insertDoc.code);

			assert.throws(function () {
				cloneMethod._execute({userId}, {_id: Random.id()});
			}, MethodFactory.errors.DOCUMENT_NOT_FOUND);
		});

		it("creates getCountMethodDefault", function () {
			const COUNT_METHOD = "dummy-methods.count";
			const countMethod = MethodFactory.getCountMethodDefault(DummyCollection, COUNT_METHOD);
			//wrong schema
			assert.throws(function () {
				countMethod._execute({userId}, null);
			}, MethodFactory.errors.WRONG_PARAMETER_TYPE);

			//no user logged in
			assert.throws(function () {
				countMethod._execute({userId: null}, {});
			}, MethodFactory.errors.PERMISSION_NOT_LOGGED_IN);

			//user not registered
			assert.throws(function () {
				countMethod._execute({userId: Random.id(17)}, {});
			}, MethodFactory.errors.PERMISSION_NOT_REGISTERED_USER);

			//user not registered
			assert.throws(function () {
				countMethod._execute({userId: userId}, {weirdProp: false});
			}, MethodFactory.errors.WRONG_ARGUMENTS);

			const expectedIntialCount = DummyCollection.find().count();
			const actualInitialCount = countMethod._execute({userId}, {});

			assert.equal(actualInitialCount, expectedIntialCount);

			const insertDocId = DummyCollection.insert({
				title: "to be counted",
				description: "some description",
				code: "0815",
			});

			const insertDoc = DummyCollection.findOne({_id: insertDocId});
			MochaHelpers.isDefined(insertDoc, MochaHelpers.OBJECT);


			const expectedNextCount = DummyCollection.find().count();
			assert.isAbove(expectedNextCount, expectedIntialCount);

			const actualNextCount = countMethod._execute({userId}, {});
			assert.equal(actualNextCount, expectedNextCount);
		});

		it('rateLimit does not allow more than X operations rapidly', function () {


			MochaHelpers.removeMethod(MochaHelpers.TEST_METHOD);
			const testMethod = MochaHelpers.testMethod(MochaHelpers.TEST_METHOD);

			const maxCount = 5;
			MethodFactory.rateLimit([testMethod], maxCount, 1000);

			const insertDoc = {
				title: "the title",
				code: "0815",
				description: "some description",
			};

			const connection = DDP.connect(Meteor.absoluteUrl());

			_.times(maxCount, function () {
				connection.call(testMethod.name, insertDoc);
			});

			assert.throws(function () {
				_.times(maxCount, function () {
					connection.call(testMethod.name, insertDoc);
				});
			}, Meteor.Error, /too-many-requests/);
			connection.disconnect();
		});

		it("creates a correct allow insert method", function () {
			const allow = MethodFactory.getAllowInsert(DummyCollection, ["insert"], "testDomain");

			testAllowMethod(allow, userId);

			Roles.addUsersToRoles(userId, ["insert"], "testDomain");
			const insertDoc = MochaHelpers.getDefaultPropsWith({});

			const shouldNotFail = allow(userId, insertDoc);
			assert.isTrue(shouldNotFail);
		});

		it("creates a correct allow update method", function () {
			const update = MethodFactory.getAllowUpdate(DummyCollection, ["update"], "testDomain");

			testAllowMethod(update, userId);

			Roles.addUsersToRoles(userId, ["update"], "testDomain");
			const updateDoc = MochaHelpers.getDefaultPropsWith({_id: Random.id(17)});

			assert.throws(function () {
				update(userId, updateDoc);
			}, MethodFactory.errors.DOCUMENT_NOT_FOUND);

			const insertDoc = Factory.create("dummy", {
				title: "some title",
				description: "some description",
				code: "0815",
			});

			assert.isTrue(update(userId, insertDoc));
		});

		it("creates a correct allow remove method", function () {
			const remove = MethodFactory.getAllowRemove(DummyCollection, ["remove"], "testDomain");

			testAllowMethod(remove, userId);

			Roles.addUsersToRoles(userId, ["remove"], "testDomain");
			const removeDoc = MochaHelpers.getDefaultPropsWith({_id: Random.id(17)});

			assert.throws(function () {
				remove(userId, removeDoc);
			}, MethodFactory.errors.DOCUMENT_NOT_FOUND);

			const insertDoc = Factory.create("dummy", {
				title: "some title",
				description: "some description",
				code: "0815",
			});

			assert.isTrue(remove(userId, insertDoc));
		});
	});
}