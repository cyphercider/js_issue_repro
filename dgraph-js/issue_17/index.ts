import * as dgraph from 'dgraph-js'
import * as grpc from 'grpc'
import * as uuid from 'uuid/v4'

/**
 * Create schema as existed in the initial example (string list, hash index)
 */
async function configureTestSchema(client: dgraph.DgraphClient, testPredicate: string): Promise<void> {
  const schema = `${testPredicate}: string .`
  const op = new dgraph.Operation()
  op.setSchema(schema)
  await client.alter(op)
}

async function queryAndCleanTestData(testPredicate: string, client: dgraph.DgraphClient): Promise<void> {
  const query = `
    {
      res(func: has(${testPredicate})) {
        uid
      }
    }
  `

  const res = await runDgraphQuery(query, client)
  if (!res || !res.res) {
    console.log(`No old data to clean up.`)
    return
  }

  let deleteLines = ``
  for (let i = 0; i < res.res.length; i++) {
    const thisRes = res.res[i]
    deleteLines += `${thisRes.uid} * * .
    `
  }

  if (deleteLines === ``) {
    return
  }
  await runDeleteMutation(deleteLines, client)
}

async function createNewTestData(testPredicate: string, client: dgraph.DgraphClient) {
  const numTestEntitiesToCreate: number = 1000
  let setLines = ``
  for (let i = 1; i <= numTestEntitiesToCreate; i++) {
    setLines += `_:entity${i} <${testPredicate}> "${uuid()}" .
    `
  }
  await runSetMutation(setLines, client)
}

async function runDeleteMutation(deleteLines: string, client: dgraph.DgraphClient) {
  const txn = client.newTxn()
  const mu = new dgraph.Mutation()
  try {
    mu.setDelNquads(deleteLines)
    await txn.mutate(mu)
    await txn.commit()
  } catch (err) {
    console.log(`Error running delete mutation ${err}`)
    throw new Error(err)
  } finally {
    txn.discard()
  }
}

async function runSetMutation(setLines: string, client: dgraph.DgraphClient) {
  const txn = client.newTxn()
  const mu = new dgraph.Mutation()
  try {
    mu.setSetNquads(setLines)
    await txn.mutate(mu)
    await txn.commit()
  } catch (err) {
    console.log(`Error running delete mutation ${err}`)
    throw new Error(err)
  } finally {
    txn.discard()
  }
}

async function runDgraphQuery(query: string, client: dgraph.DgraphClient): Promise<any> {
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
async function runIssue17Example(): Promise<void> {
  console.log(`*** Running dgraph-js github issue #17 repro ***`)
  const testPredicate = 'property.issue17'
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

  // 1 clean up old data - stop if error so as not to keep creating more data in DB
  console.log(`*** Step 1: Querying and cleaning any existing test data ***`)
  try {
    await queryAndCleanTestData(testPredicate, client)
  } catch (err) {
    console.log(`Error cleaning up test data ${err}`)
    return
  }

  // 2 create new data
  console.log(`*** Step 2: Creating new test data ***`)
  try {
    await createNewTestData(testPredicate, client)
  } catch (err) {
    console.log(`Error creating new test data ${err}`)
  }

  // 3 try query and then clean old data
  console.log(`*** Step 3: Querying and cleaning test data ***`)
  try {
    await queryAndCleanTestData(testPredicate, client)
  } catch (err) {
    console.log(`Error querying and cleaning test data ${err}`)
    return
  }

  await clientStub.close()
  console.log(`*** Done ***`)
}

runIssue17Example()
