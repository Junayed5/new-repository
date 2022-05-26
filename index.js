const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const stripe = require("stripe")('sk_test_51L1CEICVUvLchhzL4Aq4T82EnfnUQz0Sk8nl5vgkwkScbWufrTFvMrNCjhoaIvnFzAwvoxSv9MR5XjBcWaHXF9ao00J1HpsodX');

const app = express();
const port = process.env.PORT || 4200;

app.use(cors());
app.use(express.json());



const uri = 'mongodb+srv://computer_parts:5uaXGlombmbGJ2Hu@cluster0.5losn.mongodb.net/?retryWrites=true&w=majority';
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

function verifyJWT(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).send({ message: 'UnAuthorized access' });
    }
    const token = authHeader.split(' ')[1];
    jwt.verify(token, '402726b741fe49651ec20a2ece5231b9a7fc1ec784cecec4eabf4689ff0eb21c29a1cff901d9d78824e79d41bd6b3515381de91659ec5dff84e0e62cee28125d', function (err, decoded) {
        if (err) {
            return res.status(403).send({ message: 'Forbidden access' })
        }
        req.decoded = decoded;
        next();
    });
}

async function ran() {
    try {
        await client.connect();
        const partsCollection = client.db('computer_parts').collection('parts');
        const purchaseOrderCollection = client.db('computer_parts').collection('orders');
        const reviewCollection = client.db('computer_parts').collection('review');
        const profileCollection = client.db('computer_parts').collection('profile');
        const userCollection = client.db('computer_parts').collection('user');

        const verifyAdmin = async (req, res, next) => {
            const requester = req.decoded.email;
            const requesterAccount = await userCollection.findOne({ email: requester });
            if (requesterAccount.role === 'admin') {
                next();
            }
            else {
                res.status(403).send({ message: 'forbidden' });
            }
        }

        app.get('/parts', async (req, res) => {
            const parts = await partsCollection.find().toArray();
            res.send(parts);
        })

        app.get('/part/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: ObjectId(id) };
            const result = await partsCollection.findOne(filter);
            res.send(result);
        })

        app.delete('/parts/:name', verifyJWT, verifyAdmin, async (req, res) => {
            const name = req.params.name;
            const filter = { name: name }
            const result = await partsCollection.deleteOne(filter);
            res.send(result);
        })

        app.post('/parts', async (req, res) => {
            const newParts = req.body;
            const result = await partsCollection.insertOne(newParts);
            res.send(result);
        })


        app.post('/orders', async (req, res) => {
            const orders = req.body;
            const result = await purchaseOrderCollection.insertOne(orders);
            res.send(result);
        })

        app.get('/orders', verifyJWT, async (req, res) => {
            const email = req.query.email;
            const decodedEmail = req.decoded.email;
            if (email === decodedEmail) {
                const query = { email: email }
                const orders = await purchaseOrderCollection.find(query).toArray();
                return res.send(orders);
            }
            else {
                return res.status(403).send({ message: 'forbidden access' });
            }
        })
        app.get('/order', async (req, res) => {
            const orders = await purchaseOrderCollection.find().toArray();
            res.send(orders);
        })

        app.post('/review', async (req, res) => {
            const review = req.body;
            const result = await reviewCollection.insertOne(review);
            res.send(result);
        })

        app.get('/review', async (req, res) => {
            const allReviews = await reviewCollection.find().toArray();
            res.send(allReviews);
        });

        app.put('/profile/:email', async (req, res) => {
            const email = req.params.email;
            const profile = req.body;
            const filter = { email: email };
            const options = { upsert: true };
            const updateDoc = {
                $set: profile
            };
            const result = await profileCollection.updateOne(filter, updateDoc, options);
            res.send(result);
        })

        app.get('/profile/:email', async (req, res) => {
            const email = req.params.email;
            const filter = { email: email }
            const profile = await profileCollection.findOne(filter);
            res.send(profile)
        })

        app.get('/users', verifyJWT, async (req, res) => {
            const users = await userCollection.find().toArray();
            res.send(users);
        });

        app.get('/admin/:email', async (req, res) => {
            const email = req.params.email;
            const user = await userCollection.findOne({ email: email });
            const isAdmin = user.role === 'admin';
            res.send({ admin: isAdmin })
        })

        app.put('/user/:email', async (req, res) => {
            const email = req.params.email;
            const user = req.body;
            const filter = { email: email };
            const options = { upsert: true };
            const updateDoc = {
                $set: user,
            };
            const result = await userCollection.updateOne(filter, updateDoc, options);
            const token = jwt.sign({ email: email }, '402726b741fe49651ec20a2ece5231b9a7fc1ec784cecec4eabf4689ff0eb21c29a1cff901d9d78824e79d41bd6b3515381de91659ec5dff84e0e62cee28125d', { expiresIn: '3d' });
            res.send({ result, token })
        })

        app.put('/user/admin/:email', verifyJWT, verifyAdmin, async (req, res) => {
            const email = req.params.email;
            const filter = { email: email }
            const updateDoc = {
                $set: { role: 'admin' },
            };
            const result = await userCollection.updateOne(filter, updateDoc);
            res.send(result);
        });

        app.get('/order/:id',verifyJWT, async(req,res) => {
            const id = req.params.id;
            const query = {_id:ObjectId(id)};;
            const result = await purchaseOrderCollection.findOne(query)
            res.send(result);
        })

        app.patch('/order/:id', async(req,res) => {
            const id = req.params.id;
            const filter = {_id:ObjectId(id)};
            const updateDoc = {
                $set: {
                    paid:true
                },
            };

            const updateOrder = await purchaseOrderCollection.updateOne(filter,updateDoc);
            res.send(updateDoc);
        })

        app.post('/create-payment-intent',verifyJWT, async (req, res) => {
            const service = req.body;
            const price = service.price;
            const amount = price * 100
            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: "usd",
                payment_method_types: [
                    "card"
                ],
            });
            res.send({
                clientSecret: paymentIntent.client_secret,
            })
        })

        
    }
    finally { }
}

ran().catch(console.dir)

app.get('/', (req, res) => {
    res.send('Hello parts')
})

app.listen(port, () => {
    console.log('Listening port', port);
})
