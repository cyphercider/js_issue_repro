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
/**
 * Create schema as existed in the initial example (string list, hash index)
 */
function configureTestSchema(client, testPredicate) {
    return __awaiter(this, void 0, void 0, function* () {
        const schema = `${testPredicate}: [string] @index(hash) .`;
        const op = new dgraph.Operation();
        op.setSchema(schema);
        yield client.alter(op);
    });
}
/**
 * get new UID for testing
 */
function getNewItemUid(client, testPredicate) {
    return __awaiter(this, void 0, void 0, function* () {
        const txn = client.newTxn();
        try {
            const mu = new dgraph.Mutation();
            mu.setSetNquads(`_:newItem <${testPredicate}> "initial value" .`);
            const assigned = yield txn.mutate(mu);
            const uidMap = assigned.getUidsMap();
            const uid = uidMap.map_['newItem'].value;
            yield txn.commit();
            console.log(`*** New test item uid: ${uid} ***`);
            return uid;
        }
        catch (err) {
            console.log(`Error creating initial data`);
        }
    });
}
/**
 * Query the test predicate value for a uid
 */
function queryItemPredicateValue(client, testPredicate, uid) {
    return __awaiter(this, void 0, void 0, function* () {
        const query = `
  {
    res(func: uid(${uid})) {
      uid
      ${testPredicate}
    }
  }
  `;
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
function runIssue21Example() {
    return __awaiter(this, void 0, void 0, function* () {
        console.log(`*** Running dgraph-js github issue #21 repro ***`);
        const testPredicate = 'property.test';
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
        let itemUid;
        try {
            console.log(`*** Creating test data ***`);
            itemUid = yield getNewItemUid(client, testPredicate);
        }
        catch (err) {
            console.log(`Error getting test item uid`);
        }
        const valueBeforeMutation = yield queryItemPredicateValue(client, testPredicate, itemUid);
        console.log(`*** Value before delete / set transaction (predicate should contain value "initial value"): 
    ${JSON.stringify(valueBeforeMutation.res)}`);
        const txn = client.newTxn();
        try {
            const mu1 = new dgraph.Mutation();
            mu1.setDelNquads(`<${itemUid}> <${testPredicate}> * .`);
            yield txn.mutate(mu1);
            const mu2 = new dgraph.Mutation();
            mu2.setSetNquads(`<${itemUid}> <${testPredicate}> "rewritten value" .`);
            yield txn.mutate(mu2);
            yield txn.commit();
            console.log(`*** Txn committed ***`);
        }
        catch (err) {
            console.log(`Error running mutations: ${err}`);
        }
        finally {
            yield txn.discard();
        }
        const valueAfterMutation = yield queryItemPredicateValue(client, testPredicate, itemUid);
        console.log(`*** Value after delete / set transaction (predicate should contain value "rewritten value"): 
    ${JSON.stringify(valueAfterMutation.res)}`);
        yield clientStub.close();
        console.log(`*** Done ***`);
    });
}
runIssue21Example();
//# sourceMappingURL=index.js.map