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
    repeat_password: joi.ref('password'),
});

const dataSchema = joi.object({
    user_id: joi.required(),
    date: joi.date().required(),
    amount: joi.number().required(),
    description: joi.string().min(1).max(20).required(),
    transaction_type: joi.string().required()
});

//Tela de cadastro de usuário
app.post('/sign-up', async (req, res) => {

    const { name, email, password } = req.body;

    const validation = registrationSchema.validate(req.body);

    if(validation.error) {
        res.status(422).send(validation.error);
        return;
    }

    const userExist = await db.collection('users').find({email}).count();

    if(userExist > 0) {
        res.status(409).send({"message": "Já existe usuário cadastrado nesse email!"});
        return;
    }{name, email}

    const hashPassword = bcrypt.hashSync(password, 10);

    try {
       await db.collection('users').insert({
        name,
        email,
        password: hashPassword
       });
       res.status(201).send({name, email});
       return
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
            return res.status(401).send({"message": "Usuário ou senha inválidos!"});
        }

        const token = uuidv4();
        db.collection('sessions').insertOne({
            token,
            user_id: user._id,
        });
        return res.send(token);

    } catch (error) {
        console.error(error);
        return res.send(500)
    }
});

async function tokenVerification(token) {
    const session = await db.collection('sessions').findOne({
        token,
    });

    if(!session) {
        return false
    }

    const user = await db.collection('users').findOne({
        _id: session.user_id,
    });

    console.log("usuario encontrado: ", user)
    return user
}

// rota de entrada após ter feito o login
// rota privada
app.get('/transactions', async (req, res) => {

    const token = req.headers.authorization?.replace('Bearer ', '');

    if(!token) {
        return res.send(401);
    }

    const user = await tokenVerification(token);

    if(!user) {
        res.send(401);
    }

    try {
        const list = await db.collection('bank_transactions').find({
            user_id: user._id,
        }).toArray();

        return res.status(200).send({list});

    } catch (error) {
        console.error(error);
        return res.send(error)
    }

});

//Rota de deposito 
app.post('/deposit', async (req, res) => {
    const { description, amount} = req.body;

    const token = req.headers.authorization?.replace('Bearer ', '');

    if(!token) {
        console.log("tOKEN NÃO ENVIADO: ", token)
        return res.send(401);
    }

    const user = await tokenVerification(token);

    if(!user) {
        console.log("usuario não encontrado: ", user)
        res.send(401);
        return
    }

    try {
        const inputDate = {
            user_id: user._id,
            date: new Date(),
            description,
            amount,
            transaction_type: "deposito",
        };

        const validation = dataSchema.validate(inputDate, {abortEarly: false});

        if(validation.error) {
            res.status(422).send(validation.error);
            return;
        }

        const depositDate = await db.collection('bank_transactions').insertOne({
            ...inputDate
        });

        res.status(201).send(depositDate);
        return

    } catch (error) {
        res.status(500).send(error);
        return
    }
});

// Rota de saque
app.post('/withdraw', async (req, res) => {
    const { description, amount} = req.body;

    const token = req.headers.authorization?.replace('Bearer ', '');

    if(!token) {
        console.log("tOKEN NÃO ENVIADO: ", token)
        return res.send(401);
    }

    const user = await tokenVerification(token);

    if(!user) {
        console.log("usuario não encontrado: ", user)
        res.send(401);
        return
    }

    try {
        const userTransactions = await db.collection('bank_transactions').find({
            user_id: user._id,
        }).toArray();

        let saldo = 0;

        userTransactions.map((transaction) => {
            if (transaction.transaction_type === "deposito"){
                saldo = saldo + transaction.amount
            } else if (transaction.transaction_type === "saque") {
                saldo = saldo - transaction.amount
            }
        })

        if(saldo < amount) {
            res.status(401).send({"message": "Saldo insuficiente!"})
            return;
        }
 
        const inputDate = {
            user_id: user._id,
            date: new Date(),
            description,
            amount,
            transaction_type: "saque",
        };

        const validation = dataSchema.validate(inputDate, {abortEarly: false});

        if(validation.error) {
            res.status(422).send(validation.error);
            return;
        }

        const depositDate = await db.collection('bank_transactions').insertOne({
            ...inputDate
        });

        res.status(201).send(depositDate);
        return

    } catch (error) {
        res.status(500).send(error);
        return
    }
});

//Log out
app.delete('/logout', async (req, res) => {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if(!token) {
        console.log("tOKEN NÃO ENVIADO: ", token)
        return res.send(401);
    }

    try {
        await db.collection('sessions').deleteOne({token});

        res.status(200)
        return
    } catch (error) {
        res.status(500).send(error);
        return
    }
});

app.listen(5000, () => console.log('App runnig in port 5000'));