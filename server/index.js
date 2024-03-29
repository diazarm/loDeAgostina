// 1. IMPORTACIONES
const express = require('express')
const app = express()
const cors = require('cors')
const bcryptjs = require('bcryptjs')
const jwt = require('jsonwebtoken')
const {MercadoPagoConfig} = require('mercadopago')
const auth = require('./middleware/authorization')

const connectDB = require('./config/db')

const Pizza = require('./models/Pizza')
const Usuario = require('./models/User')



// 2. MIDDLEWARES
// VARIABLES DE ENTORNO
require('dotenv').config()

// CONEXIÓN A DB
connectDB()

// Habilitar CORS
app.use(cors())

app.use(express.json());


// MERCADO PAGO

//const mercadopago = require("mercadopago")
const { update } = require('./models/Pizza')

const mercadopago = new MercadoPagoConfig({
    access_token: "TEST-695027965126634-121802-510b23c7e4759300bfa01dc4bd7d8e09-309278269"
})
//const customerClient = new Customer(client);

// let preference = {
//     items: [
//       {
//         title: 'Mi producto',
//         unit_price: 100,
//         quantity: 1,
//       }
//     ],
//     purpose: 'wallet_purchase'
//   };
  
//   mercadopago.preferences.create(preference)
//   .then(function(response){
//     global.id = response.body.id;
//   }).catch(function(error){
//     console.log(error);
//   });
  
// 3. RUTEO

// A. Pizzas

app.get("/pizzas", async (req, res) => {
    try {
        const pizzas = await Pizza.find({})

        res.json({
            pizzas
        })

    } catch (error) {
        res.status(500).json({
            msg: "Hubo un error obteniendo los datos"
        })
    }
})

app.get("/pizzas/:id", async (req, res) => {

    const { id } = req.params

    try {
        
        const pizza = await Pizza.findById(id)

        res.json({
            pizza
        })

    } catch (error) {
        res.status(500).json({
            msg: "Hubo un error obteniendo los datos"
        })
    }


})

app.post("/pizza", async (req, res) => {

    const {
        nombre,
        precio,
        imagen,
        descripcion } = req.body

    try {

        const nuevaPizza = await Pizza.create({ nombre, precio, imagen, descripcion })

        res.json(nuevaPizza)

    } catch (error) {

        res.status(500).json({
            msg: "Hubo un error creando la Pizza",
            error
        })

    }
})

app.put("/pizzas", async (req, res) => {

    const { id, nombre, precio, descripcion } = req.body

    try {
        const actualizacionPizza = await Pizza.findByIdAndUpdate(id, { nombre, precio, descripcion }, { new: true })

        res.json(actualizacionPizza)

    } catch (error) {

        res.status(500).json({
            msg: "Hubo un error actualizando la Pizza"
        })

    }


})

app.delete("/pizzas", async (req, res) => {

    const { id } = req.body

    try {

        const pizzaBorrada = await Pizza.findByIdAndRemove({ _id: id })

        res.json(pizzaBorrada)


    } catch (error) {
        res.status(500).json({
            msg: "Hubo un error borrando la pizza especificada"
        })
    }

})

// B. USUARIOS
// CREAR UN USUARIO
app.post("/usuario/crear", async (req, res) => {

    // OBTENER USUARIO, EMAIL Y PASSWORD DE LA PETICIÓN
    const { name, email, password } = req.body

    try {
        // GENERAMOS FRAGMENTO ALEATORIO PARA USARSE CON EL PASSWORD
        const salt = await bcryptjs.genSalt(10)
        const hashedPassword = await bcryptjs.hash(password, salt)

        // CREAMOS UN USUARIO CON SU PASSWORD ENCRIPTADO
        const respuestaDB = await Usuario.create({
            name,
            email,
            password: hashedPassword
        })

        // USUARIO CREADO. VAMOS A CREAR EL JSON WEB TOKEN

        // 1. EL "PAYLOAD" SERÁ UN OBJETO QUE CONTENDRÁ EL ID DEL USUARIO ENCONTRADO EN BASE DE DATOS.
        // POR NINGÚN MOTIVO AGREGUES INFORMACIÓN CONFIDENCIAL DEL USUARIO (SU PASSWORD) EN EL PAYLOAD.
        const payload = {
            user: {
                id: respuestaDB._id
            }
        }

        // 2. FIRMAR EL JWT
        jwt.sign(
            payload, // DATOS QUE SE ACOMPAÑARÁN EN EL TOKEN
            process.env.SECRET, // LLAVE PARA DESCIFRAR LA FIRMA ELECTRÓNICA DEL TOKEN,
            {
                expiresIn: 360000 // EXPIRACIÓN DEL TOKEN
            },
            (error, token) => { // CALLBACK QUE, EN CASO DE QUE EXISTA UN ERROR, DEVUELVA EL TOKEN

                if (error) throw error

                res.json({
                    token
                })
            }
        )

    } catch (error) {

        return res.status(400).json({
            msg: error
        })

    }
})


// INICIAR SESIÓN
app.post("/usuario/iniciar-sesion", async (req, res) => {

    // OBTENEMOS EL EMAIL Y EL PASSWORD DE LA PETICIÓN
    const { email, password } = req.body

    try {
        // ENCONTRAMOS UN USUARIO
        let foundUser = await Usuario.findOne({ email })

        // SI NO HUBO UN USUARIO ENCONTRADO, DEVOLVEMOS UN ERROR
        if (!foundUser) {
            return res.status(400).json({ msg: "El usuario no existe" })
        }

        // SI TODO OK, HACEMOS LA EVALUACIÓN DE LA CONTRASEÑA ENVIADA CONTRA LA BASE DE DATOS
        const passCorrecto = await bcryptjs.compare(password, foundUser.password)

        // SI EL PASSWORD ES INCORRECTO, REGRESAMOS UN MENSAJE SOBRE ESTO
        if (!passCorrecto) {
            return await res.status(400).json({ msg: "Password incorrecto" })
        }

        // SI TODO CORRECTO, GENERAMOS UN JSON WEB TOKEN
        // 1. DATOS DE ACOMPAÑAMIENTO AL JWT
        const payload = {
            user: {
                id: foundUser.id
            }
        }

        // 2. FIRMA DEL JWT
        jwt.sign(
            payload,
            process.env.SECRET,
            {
                expiresIn: 3600000
            },
            (error, token) => {
                if (error) throw error;

                //SI TODO SUCEDIÓ CORRECTAMENTE, RETORNAR EL TOKEN
                res.json({ token })
            })

    } catch (error) {
        res.json({
            msg: "Hubo un error",
            error
        })
    }

})

// VERIFICAR USUARIO

// COMO OBSERVACIÓN, ESTAMOS EJECUTANDO EL MIDDLEWARE DE AUTH (AUTORIZACIÓN) ANTES DE ACCEDER
// A LA RUTA PRINCIPAL
app.get("/usuario/verificar-usuario", auth, async (req, res) => {

    console.log("wea", auth);
    try {
        // CONFIRMAMOS QUE EL USUARIO EXISTA EN BASE DE DATOS Y RETORNAMOS SUS DATOS, EXCLUYENDO EL PASSWORD
        const user = await Usuario.findById(req.user.id).select('-password')
        res.json({ user })

    } catch (error) {
        // EN CASO DE ERROR DEVOLVEMOS UN MENSAJE CON EL ERROR
        res.status(500).json({
            msg: "Hubo un error",
            error
        })
    }
})

// ACTUALIZAR USUARIO
app.put("/usuario/actualizar", auth, async (req, res) => {

    // CAPTURAMOS USUARIO DEL FORMULARIO
    const newDataForOurUser = req.body

        try {
        // LOCALIZAMOS EL USUARIO
        const updatedUser = await Usuario.findByIdAndUpdate(
            req.user.id,
            newDataForOurUser,
            { new: true }
        ).select("-password")
        
        res.json(updatedUser)
            

        } catch (error) {
            console.log(error)
            res.send(error)
        }
    }
)




// C. CHECKOUT MERCADOPAGO


app.post("/mercadopago", async (req, res) => {

    const preference = req.body
  
    const responseMP = await mercadopago.preferences.create(preference)

    console.log(responseMP)

    res.json({
        checkoutId: responseMP.body.id
    });

})



// 4. SERVIDOR
app.listen(process.env.PORT, () => console.log(`Server listen at port ${process.env.PORT}`))