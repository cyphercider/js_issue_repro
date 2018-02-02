import * as dgraph from 'dgraph-js'
import * as grpc from 'grpc'

/**
 * Create schema as existed in the initial example (string list, hash index)
 */
async function configureTestSchema(client: dgraph.DgraphClient, testPredicate: string): Promise<void> {
  const schema = `${testPredicate}: [string] @index(hash) .`
  const op = new dgraph.Operation()
  op.setSchema(schema)
  await client.alter(op)
}

/**
 * get new UID for testing
 */
async function getNewItemUid(client: dgraph.DgraphClient, testPredicate: string): Promise<string> {
  const txn = client.newTxn()

  try {
    const mu = new dgraph.Mutation()
    mu.setSetNquads(`_:newItem <${testPredicate}> "initial value" .`)
    const assigned = await txn.mutate(mu)
    const uidMap = assigned.getUidsMap()
    const uid = uidMap.map_['newItem'].value
    await txn.commit()

    console.log(`*** New test item uid: ${uid} ***`)

    return uid
  } catch (err) {
    console.log(`Error creating initial data`)
  }
}

/**
 * Query the test predicate value for a uid
 */
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

/**
 * Run full example
 */
async function runIssue21Example(): Promise<void> {
  console.log(`*** Running dgraph-js github issue #21 repro ***`)
  const testPredicate = 'property.test'
  let dgraphAddress
  try {
    dgraphAddress = process.argv[2]
    console.log(`*** Dgraph address ${dgraphAddress} ***`)
  } catch (err) {
    console.log(`please pass the dgraph address as an argument`)
  }

  const clientStub = new dgraph.DgraphClientStub(dgraphAddress, grpc.credentials.createInsecure())
  const client = new dgraph.DgraphClient(clientStub)

  try {
    await configureTestSchema(client, testPredicate)
  } catch (err) {
    console.log(`Error configuring test schema ${err}`)
  }

  let itemUid
  try {
    console.log(`*** Creating test data ***`)
    itemUid = await getNewItemUid(client, testPredicate)
  } catch (err) {
    console.log(`Error getting test item uid`)
  }

  const valueBeforeMutation: any = await queryItemPredicateValue(client, testPredicate, itemUid)
  console.log(
    `*** Value before delete / set transaction (predicate should contain value "initial value"): 
    ${JSON.stringify(valueBeforeMutation.res)}`
  )

  const txn = client.newTxn()
  try {
    const mu1 = new dgraph.Mutation()
    mu1.setDelNquads(`<${itemUid}> <${testPredicate}> * .`)
    await txn.mutate(mu1)

    const mu2 = new dgraph.Mutation()
    mu2.setSetNquads(`<${itemUid}> <${testPredicate}> "rewritten value" .`)
    await txn.mutate(mu2)
    await txn.commit()
    console.log(`*** Txn committed ***`)
  } catch (err) {
    console.log(`Error running mutations: ${err}`)
  } finally {
    await txn.discard()
  }

  const valueAfterMutation: any = await queryItemPredicateValue(client, testPredicate, itemUid)
  console.log(
    `*** Value after delete / set transaction (predicate should contain value "rewritten value"): 
    ${JSON.stringify(valueAfterMutation.res)}`
  )

  await clientStub.close()
  console.log(`*** Done ***`)
}

runIssue21Example()
