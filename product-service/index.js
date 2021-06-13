  
const express = require("express");
const app = express();
const PORT = process.env.PORT_ONE || 8080;
const mongoose = require("mongoose");
const Product = require("./Product");
const jwt = require("jsonwebtoken");
const amqp = require("amqplib");
const isAuthenticated = require("../isAuthenticated");
var order;

var channel, connection;

app.use(express.json());
mongoose.connect(
    "mongodb://localhost/product-service",
    {
        useNewUrlParser: true,
        useUnifiedTopology: true,
    },
    () => {
        console.log(`Product-Service DB Connected`);
    }
);



app.use(express.json());

app.listen(PORT, () => {
    console.log(`Product Service at ${PORT}`);
})

async function connect() {
    const amqpServer = "amqp://localhost:5672";
    connection = await amqp.connect(amqpServer);
    channel = await connection.createChannel();
    await channel.assertQueue("PRODUCT");
}
connect();

//Create a New Product

app.post("/product/create", isAuthenticated, async(req,res)=>{
    const { name, description, price } = req.body;
    const newProduct = new Product({
        name,
        description,
        price,
    });
    newProduct.save();
    return res.json(newProduct);
});

//Buy a Product
app.post("/product/buy", isAuthenticated, async (req, res) => {
    const { ids } = req.body;
    const products = await Product.find({ _id: { $in: ids } });
    channel.sendToQueue(
        "ORDER",
        Buffer.from(
            JSON.stringify({
                products,
                userEmail: req.user.email,
            })
        )
    );
    channel.consume("PRODUCT", (data) => {
        order = JSON.parse(data.content);
    });
    return res.json(order);
});

/*
curl --location --request POST 'http://localhost:8080/product/create' \
--header 'authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6IlNvdW15YWRpcC5ub3RlQGdtYWlsLmNvbSIsIm5hbWUiOiJTb3VteWFkaXAiLCJpYXQiOjE2MjM1ODMxNDh9.lIz7HedpdammEJYqrIjXrW1mcXW_C7y9j6dcHjuCFUY' \
--header 'Content-Type: application/json' \
--data-raw '{
    "name": "product1",
    "description": "product1 desc",
    "price":1000
}'


curl --location --request POST 'http://localhost:8080/product/buy' \
--header 'authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6IlNvdW15YWRpcC5ub3RlQGdtYWlsLmNvbSIsIm5hbWUiOiJTb3VteWFkaXAiLCJpYXQiOjE2MjM1ODMxNDh9.lIz7HedpdammEJYqrIjXrW1mcXW_C7y9j6dcHjuCFUY' \
--header 'Content-Type: application/json' \
--data-raw '{
    "ids": [
        "60c5e9e31cc72b1a0c4e4974","60c5ecd9ab2ceb1bc4a7c04d"
    ]
}'

*/