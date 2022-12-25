const express = require('express');
const errorMiddleware = require('./middlewares/error.middleware');
const session = require('express-session');

const dbConfig =require('./db/db.config')
const config = require('./config')

const { engine } = require ('express-handlebars')

const apiRoutes = require('./routers/app.routers');
const path =require('path');
const webRoutes=require('./routers/web/web.routes')

const MongoContainer = require ('./models/containers/mongo.container')
const productsSchema = require('./models/schemas/products.schema')
const messagesSchema = require('./models/schemas/messages.schema')
const messagesApi = new MongoContainer("messages",messagesSchema)
const productsApi = new MongoContainer("products",productsSchema)


const passport= require('./middlewares/passport')
/* const { normalize, schema, denormalize} =require('normalizr') */

const MongoStore = require('connect-mongo')

const app = express();


const minimist = require ('minimist')
const args = minimist(process.argv.slice(2),{
  alias:{
    p: 'port',
    m: 'mode'
  },
  default:{
    port: 8080,
    mode: 'FORK'
  }
}) 

//views
app.engine('hbs', engine({
  extname: 'hbs',
  defaultLayout: 'index.hbs',
  layoutsDir: path.resolve(__dirname, './views/layouts'),
  partialsDir: path.resolve(__dirname, './views/partials')
}))
app.set('views', './views/layouts');
app.set('view engine', 'hbs');

const { Server: HttpServer } = require('http');
const { Server: SocketServer } = require('socket.io');
/* const { default: cluster } = require('cluster'); */



// Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("./views/layouts")/* (path.resolve(__dirname, './public')) */);
app.use(session({
  name: 'my-session',
  secret: 'top-secret-51',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 5000 },
  store: MongoStore.create({
    mongoUrl: dbConfig.mongodb.uri,
      collectionName: 'sessions'
  })
}));

app.use(passport.initialize())
app.use(passport.session())

// Routes
app.use('/', webRoutes)
app.use('/api', apiRoutes);
app.use(errorMiddleware);


/* const PORT = process.env.PORT || 8080; */



  const httpServer = new HttpServer(app);
  const io = new SocketServer(httpServer);


//Listen
const server = httpServer.listen(config.PORT, () => {
  MongoContainer.connect().then(() => {
    console.log(`Server is up and running on port ${config.PORT}`)
    console.log('Connected to MongoDb')
  })
})


server.on('error', (error) => {
  console.error('Error: ', error);
})


// Socket Events
//Products
io.on('connection', async (socket)=>{
  console.log("New Clien conection");
  
  socket.emit("products", await productsApi.getAll())

  socket.on("new-product", async (newProduct)=>{
    await productsApi.save(newProduct)
    io.sockets.emit("products", await productsApi.getAll()) 
  })
  
})

//Chat
io.on("connection",async (socket) => {
  console.log("There is a new client in the chat");
  
  /* 
  NORMAIZE
  console.log(messages);
  const mensajesArray = {id:'messages', messages:messages}
  const authorSchema = new schema.Entity ('author',{}, {idAttribute:'email'})
  const messageSchema = new schema.Entity ('message', {author: authorSchema}, {idAttribute:'id'})
  error en el messageSchema usando mongo, debido al objectId
  const messagesSchema =  new schema.Entity('messages',{messages: [messageSchema]},{idAttribute:'id'})
  
  
  const normalizedChats = normalize(mensajesArray, messagesSchema)
  const sizeN = JSON.stringify(normalizedChats).length
  const denormaliedChats= denormalize( normalizedChats.result, messagesSchema, normalizedChats.entities)
    const sizeD = JSON.stringify(denormaliedChats).length

    
    console.log(sizeN);
    console.log(sizeD);
    let size = (sizeD-sizeN)/sizeD*100
    
    console.log("porcentaje de compresion: "+size+" %"); 
    */
   
   socket.emit("messages", await messagesApi.getAll());
   
   socket.on("new-message", async (data) => {
     await messagesApi.save(data)
     io.sockets.emit("messages", await messagesApi.getAll()); 
    });
  });
