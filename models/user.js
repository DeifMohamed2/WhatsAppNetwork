const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    userName : {
        type : String,
        required : true
    },
    socketId : {
        type : String,
        required : true
    },
    status : {
        type : String,
        default : 'online'
    }

});

const User = mongoose.model('User', userSchema);

module.exports = User;
