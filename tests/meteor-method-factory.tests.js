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


	const testMethodDefaults = function (method, userId, params) {
		//wrong schema
		assert.throws(function () {
			method._execute({userId}, {});
		}, /is required/);

		//no user logged in
		assert.throws(function () {
			method._execute({userId: null}, params);
		}, MethodFactory.errors.PERMISSION_NOT_LOGGED_IN);

		//user not registered
		assert.throws(function () {
			method._execute({userId: Random.id(17)}, params);
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

	describe("MethodFactory", () => {

		let userId;

		beforeEach(() => {
			Meteor.users.remove({username: "john doe"});
			userId = Accounts.createUser({username: "john doe"});
			DummyCollection.remove({});
		});

		afterEach(() => {
			Meteor.users.remove(userId);
		});

		it("creates checkUser", () => {
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

		it("creates checkDoc", () => {
			const dummyDoc = Factory.create("dummy");
			MochaHelpers.isDefined(dummyDoc, 'object');

			const expectValidDoc = MethodFactory.checkDoc(dummyDoc._id, DummyCollection);
			MochaHelpers.isDefined(expectValidDoc, 'object');
			assert.deepEqual(expectValidDoc, dummyDoc);

			assert.throws(function () {
				MethodFactory.checkDoc(Random.id(17), DummyCollection);
			}, MethodFactory.errors.DOCUMENT_NOT_FOUND);
		});

		it("creates getInsertMethodDefault", () => {
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

		it("creates getUpdateMethodDefault", () => {
			const UPDATE_METHOD_NAME = "dummy.methods.update";
			MochaHelpers.removeMethod(UPDATE_METHOD_NAME);

			const updateMethod = MethodFactory.getUpdateMethodDefault(DummyCollection, UPDATE_METHOD_NAME);

			const insertDoc = Factory.create("dummy", {
				title: "some title",
				description: "some description",
				code: "0815",
			});
			const docId = insertDoc._id;
			const oldTitle = insertDoc.title;
			insertDoc.title = "new title";
			testMethodDefaults(updateMethod, userId, insertDoc);

			// default expected behavior
			updateMethod._execute({userId}, insertDoc);


			const updatedDoc = DummyCollection.findOne(docId);
			MochaHelpers.isDefined(updatedDoc, 'object');

			assert.equal(updatedDoc.title, insertDoc.title);
			assert.notEqual(updatedDoc.title, oldTitle)
		});

		it("creates getRemoveMethodDefault", () => {
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

			_.times(maxCount, () => {
				connection.call(testMethod.name, insertDoc);
			});

			assert.throws(() => {
				_.times(maxCount, () => {
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

			console.log("before throw")
			assert.throws(function () {
				update(userId, updateDoc);
			}, MethodFactory.errors.DOCUMENT_NOT_FOUND);

			console.log("before insertDoc")
			const insertDoc = Factory.create("dummy", {
				title: "some title",
				description: "some description",
				code: "0815",
			});

			console.log("before update");
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