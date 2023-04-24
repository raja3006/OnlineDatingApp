const mongoose= require('mongoose');
const Schema= mongoose.Schema;
const userSchema= new Schema({
    facebook:{
       type: String
    },
    google:{
        type: String
     },
    firstname:{
        type:String
    },
    lastname:{
       type: String
    },
    fullname: {
        type:String
    },
    image: {
        type:String,
        default: '/img/acc.jpg'
    },
    email: {
        type:String
    },
    city: {
        type:String
    },
    country: {
        type:String
    },
    age: {
        type:String
    },
    gender: {
        type:String,
        default:'female'
    },
    about: {
        type:String,
        default: 'Waiting to be in a Relationship..'
    },
    online:{
        type: Boolean,
        default:false
    },
    wallet: {
        type:Number,
        default:3
    },
    password: {
        type:String
    },
    date: {
        type: Date,
        default: Date.now
    }
   
});
module.exports = mongoose.model('User',userSchema);