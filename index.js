import express from 'express';
import cors from 'cors';
import dontenv from 'dotenv';
import { MongoClient } from 'mongodb';
import joi from 'joi';
import dayjs from 'dayjs';
import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';

dontenv.config();
const app = express();

app.use(cors());
app.use(express.json());

//Conexão com o mongo
const mongoClient = new MongoClient(process.env.MONGO_URI);
let db
mongoClient.connect().then(() => {
    db = mongoClient.db('movements');
});

// Schema Joi
const registrationSchema = joi.object({
    name: joi.string().min(3).max(30).required(),
    email: joi.string().email().min(5).max(50).required(),
    password: joi.string().pattern(new RegExp('^[a-zA-Z0-9]{3,30}$')),
    repeatPassword: joi.ref('password'),
});

const loginSchema = joi.object({
    email: joi.string().email().min(5).max(50).required(),
    password: joi.string().pattern(new RegExp('^[a-zA-Z0-9]{3,30}$')),
});

//Tela de cadastro de usuário
app.post('/sign-up', async (req, res) => {

    const { name, email, password, repeatPassword } = req.body;

    const hashPassword = bcrypt.hashSync(password, 10);

    try {
       await db.collection('users').insert({
        name,
        email,
        password: hashPassword,
        repeatPassword: hashPassword,
       });
       return res.send(201);
    } catch (error) {
        console.error(error);
        return res.send(500)
    }
});

//Tela de login
app.post('/sign-in', async (req, res) => {
    const { email, password } = req.body;

    try {

        const user = await db.collection('users').findOne({
            email
        });

        const isValid = bcrypt.compareSync(password, user.password);

        if(!isValid) {
            return res.send(401);
        }

        const token = uuidv4();
        db.collection('sessions').insertOne({
            token,
            userId: user._id,
        });
        return res.send(token);

    } catch (error) {
        console.error(error);
        return res.send(500)
    }
});

// rota de entrada após ter feito o login
// rota privada
app.get('/prohibited', async (req, res) => {

    const token = req.headers.authorization?.replace('Bearer ', '');

    if(!token) {
        return res.send(401);
    }

    try {
        const session = await db.collection('sessions').findOne({
            token,
        });

        if(!session) {
            return res.send(401)
        }

        const user = await db.collection('users').findOne({
            _id: session.userId,
        });

        const list = await db.collection('lists').find({
            userId: user._id,
        }).toArray();

        return res.send(list);

    } catch (error) {
        console.error(error);
    }

    return res.send(200);
});

app.listen(5000, () => console.log('App runnig in port 5000'));