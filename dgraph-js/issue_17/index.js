"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const dgraph = require("dgraph-js");
const grpc = require("grpc");
const uuid = require("uuid/v4");
/**
 * Create schema as existed in the initial example (string list, hash index)
 */
function configureTestSchema(client, testPredicate) {
    return __awaiter(this, void 0, void 0, function* () {
        const schema = `${testPredicate}: string .`;
        const op = new dgraph.Operation();
        op.setSchema(schema);
        yield client.alter(op);
    });
}
function queryAndCleanTestData(testPredicate, client) {
    return __awaiter(this, void 0, void 0, function* () {
        const query = `
    {
      res(func: has(${testPredicate})) {
        uid
      }
    }
  `;
        const res = yield runDgraphQuery(query, client);
        if (!res || !res.res) {
            console.log(`No old data to clean up.`);
            return;
        }
        let deleteLines = ``;
        for (let i = 0; i < res.res.length; i++) {
            const thisRes = res.res[i];
            deleteLines += `${thisRes.uid} * * .
    `;
        }
        if (deleteLines === ``) {
            return;
        }
        yield runDeleteMutation(deleteLines, client);
    });
}
function createNewTestData(testPredicate, client) {
    return __awaiter(this, void 0, void 0, function* () {
        const numTestEntitiesToCreate = 1000;
        let setLines = ``;
        for (let i = 1; i <= numTestEntitiesToCreate; i++) {
            setLines += `_:entity${i} <${testPredicate}> "${uuid()}" .
    `;
        }
        yield runSetMutation(setLines, client);
    });
}
function runDeleteMutation(deleteLines, client) {
    return __awaiter(this, void 0, void 0, function* () {
        const txn = client.newTxn();
        const mu = new dgraph.Mutation();
        try {
            mu.setDelNquads(deleteLines);
            yield txn.mutate(mu);
            yield txn.commit();
        }
        catch (err) {
            console.log(`Error running delete mutation ${err}`);
            throw new Error(err);
        }
        finally {
            txn.discard();
        }
    });
}
function runSetMutation(setLines, client) {
    return __awaiter(this, void 0, void 0, function* () {
        const txn = client.newTxn();
        const mu = new dgraph.Mutation();
        try {
            mu.setSetNquads(setLines);
            yield txn.mutate(mu);
            yield txn.commit();
        }
        catch (err) {
            console.log(`Error running delete mutation ${err}`);
            throw new Error(err);
        }
        finally {
            txn.discard();
        }
    });
}
function runDgraphQuery(query, client) {
    return __awaiter(this, void 0, void 0, function* () {
        const txn = client.newTxn();
        try {
            const res = yield txn.query(query);
            return res.getJson();
        }
        catch (err) {
            console.log(`Error querying: ${err}`);
            throw new Error(err);
        }
        finally {
            yield txn.discard();
        }
    });
}
/**
 * Run full example
 */
function runIssue17Example() {
    return __awaiter(this, void 0, void 0, function* () {
        console.log(`*** Running dgraph-js github issue #17 repro ***`);
        const testPredicate = 'property.issue17';
        let dgraphAddress;
        try {
            dgraphAddress = process.argv[2];
            console.log(`*** Dgraph address ${dgraphAddress} ***`);
        }
        catch (err) {
            console.log(`please pass the dgraph address as an argument`);
        }
        const clientStub = new dgraph.DgraphClientStub(dgraphAddress, grpc.credentials.createInsecure());
        const client = new dgraph.DgraphClient(clientStub);
        try {
            yield configureTestSchema(client, testPredicate);
        }
        catch (err) {
            console.log(`Error configuring test schema ${err}`);
        }
        // 1 clean up old data - stop if error so as not to keep creating more data in DB
        console.log(`*** Step 1: Querying and cleaning any existing test data ***`);
        try {
            yield queryAndCleanTestData(testPredicate, client);
        }
        catch (err) {
            console.log(`Error cleaning up test data ${err}`);
            return;
        }
        // 2 create new data
        console.log(`*** Step 2: Creating new test data ***`);
        try {
            yield createNewTestData(testPredicate, client);
        }
        catch (err) {
            console.log(`Error creating new test data ${err}`);
        }
        // 3 try query and then clean old data
        console.log(`*** Step 3: Querying and cleaning test data ***`);
        try {
            yield queryAndCleanTestData(testPredicate, client);
        }
        catch (err) {
            console.log(`Error querying and cleaning test data ${err}`);
            return;
        }
        yield clientStub.close();
        console.log(`*** Done ***`);
    });
}
runIssue17Example();
//# sourceMappingURL=index.js.map