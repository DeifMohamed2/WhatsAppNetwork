const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
    sender : {
        type : String,
        required : true
    },
    recipient : {
        type : String,
        required : true
    },
    content : {
        type : String,
        required : true
    },
    iv : {
        type : String,
        required : true
    },
    readed : {
        type : Boolean,
        default : false
    }
}, { timestamps : true });

const Message = mongoose.model('Message', messageSchema);

module.exports = Message;