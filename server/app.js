// INCLUDES

const handlebars = require('express-handlebars');
const express = require("express");
const session = require('express-session');

const path = require('path') 
var fs = require('fs');

const ctrlTelegram = require('./api/telegramMsg');
const ctrlYoutube = require('./api/youtubeVideo');

var {google} = require('googleapis');
const { request } = require('http');



// INIT CONFIG

function init_veriables(){
    config = JSON.parse(fs.readFileSync(path.join(__dirname,'./config.json'), 'utf-8'));
}
var config;
init_veriables();
const oauth2Client = ctrlYoutube.oauth2Client;

// APP

let app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')))
app.use(session({
	secret: 'secret',
	resave: true,
	saveUninitialized: true
}));

app.engine(
    'handlebars',
    handlebars.engine({ defaultLayout: 'base' }) //настройка шаблонов
);
app.set('views', path.join(__dirname, './public/templates'));
app.set('view engine', 'handlebars');

// FUNCTIONS

function TodayTime(){ // сегоднящний день
    return new Date(new Date().getTime() + (3 * 60 * 60 * 1000));
}

function ConvertDateToString(date){ // format: yyyy-mm-dd
    return date.toISOString().split('T')[0]
}
function GetStringDate(lessDays){
    var endDay = TodayTime();
    endDay.setDate(endDay.getDate()-lessDays);
    return ConvertDateToString(endDay);
}

// HANDLERS

// GET REQUSETS
app.get("/", (request, response)=>{
    response.render('index',{'title':'Вход'});
})

app.get('/logout', (request, response)=>{
    if(request.session.loggedin){
        request.session.destroy();
    }
    response.redirect('/');
})

app.get("/day", (request, response)=>{
    if(request.session.loggedin){
        var endDay = GetStringDate(1);
        var beginDay = GetStringDate(10);// 10 - число дней записей 
        var data = JSON.parse(fs.readFileSync(path.join(__dirname,'/data.json'), 'utf-8'));
        var cams = data["cams"];
        var pairs = data["pairs"];
        response.render('day',{
            'title':'Дни',
            'endDay': endDay,
            'beginDay': beginDay,
            "cams": cams,
            "pairs": pairs,
            "username": request.session.username==="admin"
        });
    }
    else response.redirect('/');    
});

app.get('/getExports', (request, response)=>{
    if (!fs.existsSync(config["server_config"]["dir_exports"]+"/exports.json")) {
        response.json([]);
    }
    var data = JSON.parse(fs.readFileSync(config["server_config"]["dir_exports"]+"/exports.json", "utf-8"));
    var day = data.find(el=>el["day"]===request.query.day);
    response.json(day?day:[]);
});

app.all('/addCam', (request, response, next)=>{    
    if(request.method==="GET"){
        if(request.session.loggedin && request.session.username=="admin"){
            response.render('addCam', {'title':"Добавление камеры"});
        }
        else responseponse.redirect('/');
    }
    if(request.method==="POST"){
        var data = JSON.parse(fs.readFileSync(path.join(__dirname,'/data.json'), 'utf-8'));
        data["cams"].push({"name": request.body.name, "id": request.body.id});
        fs.writeFileSync(path.join(__dirname,'/data.json'), JSON.stringify(data, null, 2), 'utf-8')
        response.redirect('/day');
    }
})

app.all('/addPair', (request, response, next)=>{
    if(request.method==="GET"){
        if(request.session.loggedin && request.session.username=="admin"){
            response.render('addPair', {'title':"Добавление пары"});
        }
        else responseponse.redirect('/');
    }
    if(request.method==="POST"){
        var data = JSON.parse(fs.readFileSync(path.join(__dirname,'/data.json'), 'utf-8'));
        data["pairs"].push({"name": request.body.name, "startTime": request.body.startTime, "endTime": request.body.endTime});
        fs.writeFileSync(path.join(__dirname,'/data.json'), JSON.stringify(data, null, 2), 'utf-8')
        response.redirect('/day');
    }
})

app.get('/authYouTube', (request, response) => {

    const url = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: ['https://www.googleapis.com/auth/youtube.upload'] 
    });
    response.redirect(url);
});


app.get('/oauth2callback', async (request, response) => {
    const code  = request.query;
    try {
        const tokens = await oauth2Client.getToken(code);
        fs.writeFileSync(path.join(__dirname,"/api/youtubeTokens/credentials.json"),JSON.stringify(tokens, null, 2));
        response.redirect("/day");
    } catch (error) {
        console.error('Error:', error);
        response.status(500).send('Error during oauth');
    }
});

// POST REQUSETS

app.post('/auth', function(request, response) {
	// Capture the input fields
	let username = request.body.login;
	let password = request.body.password;
	if (username && password) {
        let user = Object.keys(config["user_config"]).find(key=>config["user_config"][key]["login"]===username && config["user_config"][key]["password"]===password);
        if(user){            
            request.session.loggedin = true;
            request.session.username = username;
            response.redirect('/day');
        } else {
            response.send('Incorrect Username and/or Password!');
        }			
        response.end();
	} else {
		response.send('Please enter Username and Password!');
		response.end();
	}
});

app.post("/script",(request, response)=>{
    if(!request.body)
        return response.sendStatus(400);
    var requestRes = request.body;
    var fileFolderPath = config["server_config"]["dir_exports"];
    var filePath = path.join(fileFolderPath+"/exports.json")

    // создание папок

    if (!fs.existsSync(fileFolderPath)) {
        fs.mkdirSync(fileFolderPath);
    }
    if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, '[]');
    }
    
    // добавление записей
    var data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    var findDay = data.find(item => item["day"] === requestRes.day);
    var indexDay = data.indexOf(findDay);
    if (findDay){
        if(JSON.stringify(requestRes.cams)==="[]")
            data.splice(indexDay,1);
        else findDay["cams"] = requestRes.cams;
    }        
    else 
        data.push({"day": requestRes.day, "cams": requestRes.cams});
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    var count = requestRes.cams.reduce((acc, item)=>acc+ item["time"].length,0);
    ctrlTelegram.sendMsg(ctrlTelegram.Placeholder("/script", `Успешно добавлен день: ${requestRes.day}\n<b>Количество пар</b>: ${count==0?"Все пары удалены за этот день":count}`));    response.sendStatus(200);
});

app.post('/telegram', (request, response) => {
    let reqBody = request.body
    //каждый элемент обьекта запихиваем в массив
    let msg = ctrlTelegram.Placeholder(reqBody.name, reqBody.log);
    //проходимся по массиву и склеиваем все в одну строку
    var responseStatus = ctrlTelegram.sendMsg(msg);
    if(responseStatus===200){
        res.status(200).json({status: 'ok', message: 'Успешно отправлено!'});
    }
    if(responseStatus!==200){
        res.status(400).json({status: 'error', message: 'Произошла ошибка!'});
    }
    
});

app.post('/upload',(request, response) => {
    fs.readdir(config["server_config"]["dir_exports"]+"/videos", (e, files)=>{        
        if(e){
            ctrlTelegram.sendMsg(Placeholder("/upload","Не удалось загрузить видео в ютуб!"));
            response.sendStatus(400);
        }
        else{
            let log = `Общее кол-во видео: ${files.length}\n\n`;
            files.forEach(fileName=>{
                var resUpload = true;//await ctrlYoutube.uploadVideo(fileName, `${config["server_config"]["dir_exports"]}/videos/${fileName}`);
                log += `Отправлено видео ${fileName}. Статус: ${resUpload?"Загружено":"Не загружено"}\n`;
                fs.unlinkSync(config["server_config"]["dir_exports"]+"/videos/"+fileName);
            });
            ctrlTelegram.sendMsg(ctrlTelegram.Placeholder("/upload",log));
            fs.unlinkSync(config["server_config"]["dir_exports"]+"/exports.json");
        }        
    });
    response.sendStatus(200);
});

app.listen(config["server_config"]['server_port'], config["server_config"]['server_ip'], function () {
    console.log(`Server listens http://${config["server_config"]['server_ip']}:${config["server_config"]['server_port']}`);
});

