import express from 'express';
import cors from 'cors';
import dontenv from 'dotenv';
import { MongoClient } from 'mongodb';
import joi from 'joi';
import dayjs from 'dayjs';

dontenv.config();
const app = express();

app.use(cors());
app.use(express.json());

app.listen(5000, () => console.log('App runnig in port 5000'));