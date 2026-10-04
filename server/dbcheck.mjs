import { MongoClient } from 'mongodb';
const c = await new MongoClient(process.env.MONGO_URL).connect();
const col = c.db('cod2').collection('players');
console.log(await col.find().toArray());
if (process.argv[2] === 'clean') console.log('deleted', (await col.deleteMany({ _id: /^dev-/ })).deletedCount);
await c.close();
