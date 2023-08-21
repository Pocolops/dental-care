const express = require('express')
const app = express()
const cors = require('cors')
const jwt = require('jsonwebtoken')
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb')
const port = process.env.PORT || 5000;




app.use(cors())
app.use(express.json())
require('dotenv').config()



 

// Middleware to verify JWT token
function verifyJWT(req, res, next) {
   const authHeder = req.headers.authorization;
   if (!authHeder) {
      return res.status(401).send("unAuthorization token")
   }

   const token = authHeder.split(' ')[1];
   jwt.verify(token, process.env.ACCESS_TOKEN, function (err, decoded) {
      if (err) {
         return res.status(403).send({ message: "forbidden access" })
      }
      req.decoded = decoded;
      next();
   })
}



const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.ypdp1co.mongodb.net/?retryWrites=true&w=majority`;
// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
   serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true,
   }
});


// Define the main application logic within an async function
async function run() {
   try {
      const appointmentOptionsCollection = client.db('doctorPortal').collection('appointmentOptions');
      const bookingCollection = client.db('doctorPortal').collection('bookingCollection');
      const userCollection = client.db('doctorPortal').collection('users');
      const doctorCollection = client.db('doctorPortal').collection('doctors');
      const ContactUsCollection = client.db('doctorPortal').collection('contactUsMessages');

      // Route to fetch appointment options for a specific date
      app.get('/appointmentOptions', async (req, res) => {
         const date = req.query.date;
         const query = {};
         const cursor = appointmentOptionsCollection.find(query);
         const options = await cursor.toArray();
         const bookingQuery = { slotDate: date }
         const alreadyBooked = await bookingCollection.find(bookingQuery).toArray();
         options.forEach(option => {
            const serviceBooked = alreadyBooked.filter(book => book.service === option.name)
            const bookingSlot = serviceBooked.map(book => book.slot)
            const remainingOptions = option.slots.filter(remOptions => !bookingSlot.includes(remOptions))
            option.slots = remainingOptions;
         })

         res.send(options)
      });

      // Route to fetch specific appointment option
      app.get('/appointmentOptions/:id', async (req, res) => {

         const query = {};
         const result = await appointmentOptionsCollection.findOne(query);
         res.send(result)


      });

      // Route to fetch bookings for a specific user
      app.get('/bookings', verifyJWT, async (req, res) => {
         const email = req.query.email;
         const decodedEmail = req.decoded.email;
         if (email !== decodedEmail) {
            res.status(403).send({ message: 'Invalid email' });
         }
         const query = { email: email }
         const booking = await bookingCollection.find(query).toArray();
         res.send(booking);
      })

      // Route to fetch all bookings
      app.get('/allbookings', async (req, res) => {
         const query = {};
         const result = await bookingCollection.find(query).toArray();
         res.send(result);

      })

      // Route to fetch a specific booking by ID
      app.get('/allbookings/:id', async (req, res) => {
         const query = {};
         const result = await bookingCollection.findOne(query)
         res.send(result);

      })

      // Route to update a booking
      app.patch('/allbookings/:id', async (req, res) => {
         const id = req.params.id
         const query = { _id: new ObjectId(id) }
         const options = { upsert: true };
         const content = req.body;
         const updateContent = {
            $set: {
               slotDate: content.slotDate,
               slot: content.slot,
            }
         }
         const result = await bookingCollection.updateOne(query, updateContent, options);
         res.send(result);
      })


      // Route to update booking status
      app.patch('/approving/:id', async (req, res) => {
         const id = req.params.id;
         const status = req.body.status;
         const query = { _id: new ObjectId(id) }
         const options = { upsert: true };
         const updatedDoc = {
            $set: {
               status: status
            }
         }
         const result = await bookingCollection.updateOne(query, updatedDoc, options);
         res.send(result);
      })


      // Route to delete a booking
      app.delete('/bookings/:id', async (req, res) => {
         const id = req.params.id;
         const query = { _id: new ObjectId(id) };
         const result = await bookingCollection.deleteOne(query);
         res.send(result);

      })


      // Route to create a new booking
      app.post('/booking', async (req, res) => {
         const booking = req.body;
         const query = {
            slotDate: booking.slotDate,
            service: booking.service,
            email: booking.email

         }

         const alreadyBooked = await bookingCollection.find(query).toArray();
         if (alreadyBooked.length) {
            const message = `you already booked ${booking.slotDate}`
            return res.send({ acknowledged: false, message })
         }

         const result = await bookingCollection.insertOne(booking);
         res.send(result);
      })


      // Route to obtain a JWT toke
      app.get('/jwt', async (req, res) => {
         const email = req.query.email;
         const query = { email: email }
         const user = await userCollection.findOne(query)
         if (user) {
            const token = jwt.sign({ email }, process.env.ACCESS_TOKEN);
            return res.send({ accessToken: token })
         }
         else {
            return res.send({ accessToken: 'no token' })
         }

      })

      // Route to fetch appointment booking specialties
      app.get('/appointmentbookingspecialty', async (req, res) => {
         const query = {}
         const result = await appointmentOptionsCollection.find(query).project({ name: 1 }).toArray();
         res.send(result)
      })

      app.get('/users/admin/:email', async (req, res) => {
         const email = req.params.email;
         const query = { email }
         const user = await userCollection.findOne(query)
         res.send({ isAdmin: user?.role === 'admin' });
      })

      // Route to check if a user is an admin
      app.get('/users', verifyJWT, async (req, res) => {
         const decodedEmail = req.query.email;
         const queryEmail = { email: decodedEmail };
         const user = await userCollection.findOne(queryEmail);
         if (user.role !== 'admin') {
            return res.send([]);
         }
         const query = {};
         const users = await userCollection.find(query).toArray();
         res.send(users);
      })

      // Route to create a new user
      app.post('/users', async (req, res) => {
         const user = req.body;
         const result = await userCollection.insertOne(user);
         res.send(result);
      })

      // Route to promote a user to admin (for admin)
      app.patch('/users/admin/:id', verifyJWT, async (req, res) => {
         const decodedEmail = req.decoded.email;
         const query = { email: decodedEmail };
         const user = await userCollection.findOne(query);
         if (user.role !== 'admin') {
            return res.status(403).send({ message: 'forbidden access' })
         }
         const id = req.params.id;
         const filter = { _id: new ObjectId(id) };
         //  const options = { upsert: true };
         const updateDoc = {
            $set: {
               role: 'admin'
            },
         };
         const result = await userCollection.updateOne(filter, updateDoc);
         res.send(result);

      })

      // Route to create a new doctor
      app.post('/doctors', async (req, res) => {
         const doctor = req.body;
         const docEmail = doctor.email;

         const query = { email: docEmail }
         const existingDoctor = await doctorCollection.find(query).toArray()
         if (existingDoctor[0]?.email === docEmail) {
            return res.status(409).send({ message: 'Doctor all ready exist' })
         }
         const result = await doctorCollection.insertOne(doctor);
         return res.send(result);
      })

      // Route to fetch all doctors
      app.get('/doctors', async (req, res) => {
         const query = {}
         const result = await doctorCollection.find(query).toArray()
         res.send(result);
      })

      app.get('/doctors/:id', async (req, res) => {
         const query = {}
         const result = await doctorCollection.findOne(query)
         res.send(result);
      })

      // Route to delete a doctor
      app.delete('/doctors/:id', async (req, res) => {
         const id = req.params.id;
         const query = { _id: new ObjectId(id) };
         const result = await doctorCollection.deleteOne(query);
         res.send(result);
      })


      // Route to Messages
      app.post('/contactUs', async (req, res) => {
         const user = req.body;
         const result = await ContactUsCollection.insertOne(user);
         res.send(result);
      })

      // Route to fetch all Messages
      app.get('/contactUs', async (req, res) => {
         const query = {};
         const result = await ContactUsCollection.find(query).toArray();
         res.send(result);

      })


   } finally {

   }
}
run().catch(console.dir);


app.get('/', (req, res) => {
   res.send('Welcome doctor portal server')
})

app.listen(port, () => {
   console.log(`Example app listening on port ${port}`)
})