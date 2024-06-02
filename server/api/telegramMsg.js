module.exports.Placeholder = (name, log)=>{
    return `<b>Name of Script</b>: ${name}\n<b>Log</b>:\n${log}`;
}
module.exports.sendMsg = (msg_) => {
    const http = require('request');
    const fs = require('fs');
    const path = require('path');

    const config = JSON.parse(fs.readFileSync(path.join(__dirname,'../config.json'), 'utf-8'));

    var msg = encodeURI(msg_)
    http.post(`https://api.telegram.org/bot${config["bot_token"]}/sendMessage?chat_id=${config["chat_id"]}&parse_mode=html&text=${msg}`, function (error, response, body) {  
        if(error || response.statusCode!==200){
            console.log('error:', error);
            console.log('statusCode:', response && response.statusCode); 
            console.log('body:', body);
        }
        
        return response.statusCode;
    });  
}