const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");

const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(
  cors({
    origin: ["http://localhost:5173"],
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

const logger = (req, res, next) => {
  console.log("login info", req.method, req.url);
  next();
};

app.use(logger);

const verifyToken = async (req, res, next) => {
  const token = req?.cookies?.token;
  // console.log("verify token", token);
  if (!token) {
    return res.status(401).send({ massage: "forbidden" });
  }
  jwt.verify(token, process.env.ACCESS_TOKEN, (err, decoded) => {
    if (err) {
      console.error(err);
      return res.status(401).send({ massage: "unauthorized access" });
    }
    console.log("value decoded", decoded);
    req.user = decoded;

    next();
  });
};

app.use(verifyToken);

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.t2wjj.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const roomsDataDetails = client.db("hotelsData").collection("room-details");
    const bookingCollection = client.db("hotelsData").collection("bookings");

    //auth api
    app.post("/jwt", async (req, res) => {
      const user = req.body;
      console.log("users token", user);
      const token = jwt.sign(user, process.env.ACCESS_TOKEN, {
        expiresIn: "1h",
      });
      res
        .cookie("token", token, {
          httpOnly: true,
          secure: true,
        })
        .send({ success: true });
    });

    app.post("/logout", async (req, res) => {
      const user = req.body;
      console.log("loging out", user);
      res.cookie("token", { maxAge: 0 }).send({ success: true });
    });

    //services api

    app.get("/services", async (req, res) => {
      const cursor = roomsDataDetails.find();
      const result = await cursor.toArray();
      res.send(result);
    });

    app.get("/services/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const options = {
        projection: {
          image: 1,
          room_type: 1,
          description: 1,
          price_per_night: 1,
          room_size: 1,
          availability: 1,
          room_images: 1,
          special_offers: 1,
          reviews: 1,
        },
      };
      const result = await roomsDataDetails.findOne(query);
      res.send(result);
    });

    app.post("/bookings", verifyToken, logger, async (req, res) => {
      const booking = req.body;

      const existingBooking = await bookingCollection.findOne({
        email: booking.email,
        date: booking.date,
      });

      if (existingBooking) {
        return res.send({ message: "already exists" });
      }

      const result = await bookingCollection.insertOne(booking);
      res.send(result);
    });

    app.delete("/bookings/:id", async (req, res) => {
      const bookingId = req.params.id;

      const existingBooking = await bookingCollection.findOne({
        _id: new ObjectId(bookingId),
      });

      console.log(
        (new Date(existingBooking.date) - Date.now()) / (1000 * 60 * 60 * 24)
      );

      // if (existingBooking) {
      //   return res.send({ message: "already exists" });
      // }

      // const result = await bookingCollection.insertOne(booking);
      // res.send(result);
    });

    app.get("/bookings", async (req, res) => {
      console.log("token:-", req.cookies.token);
      console.log("user from the valid token", req.user);
      // if (req.query.email !== req.user.email) {
      //   return res.status(403).send({ message: "forbidden" });
      // }
      let query = {};
      if (req.query?.email) {
        query = { email: req.query.email };
      }
      const result = await bookingCollection.find(query).toArray();
      res.send(result);
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Hotel server is running");
});

// Your other routes and API endpoints go here

app.listen(port, () => {
  console.log(`Hotel server listening on port ${port}`);
});
