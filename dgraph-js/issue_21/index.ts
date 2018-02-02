import * as dgraph from 'dgraph-js'
import * as grpc from 'grpc'

async function configureTestSchema(client: dgraph.DgraphClient, testPredicate: string): Promise<void> {
  const schema = `${testPredicate}: string @index(hash) .`
  const op = new dgraph.Operation()
  op.setSchema(schema)
  await client.alter(op)
}

async function getNewItemUid(client: dgraph.DgraphClient, testPredicate: string): Promise<string> {
  const txn = client.newTxn()

  try {
    const mu = new dgraph.Mutation()
    mu.setSetNquads(`_:newItem <${testPredicate}> "testInitialValue" .`)
    const assigned = await txn.mutate(mu)
    const uidMap = assigned.getUidsMap()
    const uid = uidMap.map_['newItem'].value
    await txn.commit()

    console.log(`uids: ${uid}`)
    console.log(JSON.stringify(uidMap))

    return uid
  } catch (err) {
    console.log(`Error creating initial data`)
  }
}

async function queryItemPredicateValue(
  client: dgraph.DgraphClient,
  testPredicate: string,
  uid: string
): Promise<string> {
  const query = `
  {
    res(func: uid(${uid})) {
      uid
      ${testPredicate}
    }
  }
  `

  const txn = client.newTxn()
  try {
    const res = await txn.query(query)
    return res.getJson()
  } catch (err) {
    console.log(`Error querying: ${err}`)
    throw new Error(err)
  } finally {
    await txn.discard()
  }
}

async function runIssue21Example(): Promise<void> {
  const testPredicate = 'property.test'
  let dgraphAddress
  try {
    dgraphAddress = process.argv[2]
    console.log(`using dgraph address ${dgraphAddress}`)
  } catch (err) {
    console.log(`please pass the dgraph address as an argument`)
  }

  const clientStub = new dgraph.DgraphClientStub(
    // addr: optional, default: "localhost:9080"
    dgraphAddress,
    // credentials: optional, default: grpc.credentials.createInsecure()
    grpc.credentials.createInsecure()
  )
  const client = new dgraph.DgraphClient(clientStub)

  try {
    await configureTestSchema(client, testPredicate)
  } catch (err) {
    console.log(`Error configuring test schema ${err}`)
  }

  let itemUid
  try {
    itemUid = await getNewItemUid(client, testPredicate)
  } catch (err) {
    console.log(`Error getting test item uid`)
  }

  const valueBeforeMutation = await queryItemPredicateValue(client, testPredicate, itemUid)
  console.log(`Value before two-part transaction (delete / set): ` + JSON.stringify(valueBeforeMutation))

  const txn = client.newTxn()
  try {
    const mu1 = new dgraph.Mutation()
    mu1.setDelNquads(`<${itemUid}> <${testPredicate}> * .`)
    await txn.mutate(mu1)

    const mu2 = new dgraph.Mutation()
    mu2.setSetNquads(`<${itemUid}> <${testPredicate}> "rewritten value" .`)
    await txn.mutate(mu2)
    await txn.commit()
  } catch (err) {
    console.log(`Error running mutations: ${err}`)
  } finally {
    await txn.discard()
  }

  const valueAfterMutation = await queryItemPredicateValue(client, testPredicate, itemUid)
  console.log(`Value after two-part transaction (delete / set): ` + JSON.stringify(valueAfterMutation))

  await clientStub.close()
  console.log(`committed txn`)
}

runIssue21Example()
