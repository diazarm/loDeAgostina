const mongoose = require("mongoose")

mongoose.set('strictQuery', false)
const connectDB = async () => {

    try {
        await mongoose.connect(process.env.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        })

        console.log("db connected")

    } catch (error) {
        console.log(error)
        process.exit(1) // DETIENE LA APP POR COMPLETO

    }

}

module.exports = connectDB