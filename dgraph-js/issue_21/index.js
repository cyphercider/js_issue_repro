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
function configureTestSchema(client, testPredicate) {
    return __awaiter(this, void 0, void 0, function* () {
        const schema = `${testPredicate}: string @index(hash) .`;
        const op = new dgraph.Operation();
        op.setSchema(schema);
        yield client.alter(op);
    });
}
function getNewItemUid(client, testPredicate) {
    return __awaiter(this, void 0, void 0, function* () {
        const txn = client.newTxn();
        try {
            const mu = new dgraph.Mutation();
            mu.setSetNquads(`_:newItem <${testPredicate}> "testInitialValue" .`);
            const assigned = yield txn.mutate(mu);
            const uidMap = assigned.getUidsMap();
            const uid = uidMap.map_['newItem'].value;
            yield txn.commit();
            console.log(`uids: ${uid}`);
            console.log(JSON.stringify(uidMap));
            return uid;
        }
        catch (err) {
            console.log(`Error creating initial data`);
        }
    });
}
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
function runIssue21Example() {
    return __awaiter(this, void 0, void 0, function* () {
        const testPredicate = 'property.test';
        let dgraphAddress;
        try {
            dgraphAddress = process.argv[2];
            console.log(`using dgraph address ${dgraphAddress}`);
        }
        catch (err) {
            console.log(`please pass the dgraph address as an argument`);
        }
        const clientStub = new dgraph.DgraphClientStub(
        // addr: optional, default: "localhost:9080"
        dgraphAddress, 
        // credentials: optional, default: grpc.credentials.createInsecure()
        grpc.credentials.createInsecure());
        const client = new dgraph.DgraphClient(clientStub);
        try {
            yield configureTestSchema(client, testPredicate);
        }
        catch (err) {
            console.log(`Error configuring test schema ${err}`);
        }
        let itemUid;
        try {
            itemUid = yield getNewItemUid(client, testPredicate);
        }
        catch (err) {
            console.log(`Error getting test item uid`);
        }
        const valueBeforeMutation = yield queryItemPredicateValue(client, testPredicate, itemUid);
        console.log(`Value before two-part transaction (delete / set): ` + JSON.stringify(valueBeforeMutation));
        const txn = client.newTxn();
        try {
            const mu1 = new dgraph.Mutation();
            mu1.setDelNquads(`<${itemUid}> <${testPredicate}> * .`);
            yield txn.mutate(mu1);
            const mu2 = new dgraph.Mutation();
            mu2.setSetNquads(`<${itemUid}> <${testPredicate}> "rewritten value" .`);
            yield txn.mutate(mu2);
            yield txn.commit();
        }
        catch (err) {
            console.log(`Error running mutations: ${err}`);
        }
        finally {
            yield txn.discard();
        }
        const valueAfterMutation = yield queryItemPredicateValue(client, testPredicate, itemUid);
        console.log(`Value after two-part transaction (delete / set): ` + JSON.stringify(valueAfterMutation));
        yield clientStub.close();
        console.log(`committed txn`);
    });
}
runIssue21Example();
//# sourceMappingURL=index.js.map