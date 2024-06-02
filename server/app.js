// INCLUDES

const handlebars = require('express-handlebars');
const express = require("express");

const path = require('path') 
var fs = require('fs');

const ctrlTelegram = require('./api/telegramMsg');
const ctrlYoutube = require('./api/youtubeVideo');

var {google} = require('googleapis');




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

app.get("/day", (request, response)=>{
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
        "pairs": pairs
    });
});

app.get('/getExports', (req, res)=>{
    if (!fs.existsSync(config["dir_exports"]+"/exports.json")) {
        res.json([]);
    }
    var data = JSON.parse(fs.readFileSync(config["dir_exports"]+"/exports.json", "utf-8"));
    var day = data.find(el=>el["day"]===req.query.day);
    res.json(day?day:[]);
});

app.all('/addCam', (req, res, next)=>{
    if(req.method==="GET"){
        res.render('addCam', {'title':"Добавление камеры"});
    }
    if(req.method==="POST"){
        var data = JSON.parse(fs.readFileSync(path.join(__dirname,'/data.json'), 'utf-8'));
        data["cams"].push({"name": req.body.name, "id": req.body.id});
        fs.writeFileSync(path.join(__dirname,'/data.json'), JSON.stringify(data, null, 2), 'utf-8')
        res.redirect('/day');
    }
})

app.all('/addPair', (req, res, next)=>{
    if(req.method==="GET"){
        res.render('addPair', {'title':"Добавление пары"});
    }
    if(req.method==="POST"){
        var data = JSON.parse(fs.readFileSync(path.join(__dirname,'/data.json'), 'utf-8'));
        data["pairs"].push({"name": req.body.name, "startTime": req.body.startTime, "endTime": req.body.endTime});
        fs.writeFileSync(path.join(__dirname,'/data.json'), JSON.stringify(data, null, 2), 'utf-8')
        res.redirect('/day');
    }
})


app.get('/auth', (req, res) => {
    const url = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: ['https://www.googleapis.com/auth/youtube.upload'] 
    });
    res.redirect(url);
});


app.get('/oauth2callback', async (req, res) => {
    const code  = req.query;
    try {
        const tokens = await oauth2Client.getToken(code);
        fs.writeFileSync(path.join(__dirname,"/api/youtubeTokens/credentials.json"),JSON.stringify(tokens, null, 2));
        res.redirect("/day");
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Error during oauth');
    }
});

// POST REQUSETS

app.post("/script",(request, response)=>{
    if(!request.body)
        return response.sendStatus(400);
    var requestRes = request.body;
    var fileFolderPath = config["dir_exports"];
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

    ctrlTelegram.sendMsg(ctrlTelegram.Placeholder("/script", `Успешно добавлен день: ${requestRes.day}\n<b>Количество пар</b>: ${requestRes.cams.reduce((acc, item)=>acc+ item["time"].length,0)}`));    response.sendStatus(200);
});

app.post('/telegram', (req, res) => {
    let reqBody = req.body
    //каждый элемент обьекта запихиваем в массив
    let msg = ctrlTelegram.Placeholder(reqBody.name, reqBody.log);
    //проходимся по массиву и склеиваем все в одну строку
    var response = ctrlTelegram.sendMsg(msg);
    if(response===200){
        res.status(200).json({status: 'ok', message: 'Успешно отправлено!'});
    }
    if(response!==200){
        res.status(400).json({status: 'error', message: 'Произошла ошибка!'});
    }
    
});

app.post('/upload',(req, res) => {
    fs.readdir(config["dir_exports"]+"/videos", (e, files)=>{        
        if(e){
            ctrlTelegram.sendMsg(Placeholder("/upload","Не удалось загрузить видео в ютуб!"));
            res.sendStatus(400);
        }
        else{
            let log = `Общее кол-во видео: ${files.length}\n\n`;
            files.forEach(fileName=>{
                var resUpload = true;//await ctrlYoutube.uploadVideo(fileName, `${config["dir_exports"]}/videos/${fileName}`);
                log += `Отправлено видео ${fileName}. Статус: ${resUpload?"Загружено":"Не загружено"}\n`;
                fs.unlinkSync(config["dir_exports"]+"/videos/"+fileName);
            });
            ctrlTelegram.sendMsg(ctrlTelegram.Placeholder("/upload",log));
            fs.unlinkSync(config["dir_exports"]+"/exports.json");
        }        
    });
    res.sendStatus(200);
});

app.listen(config['server_port'], config['server_ip'], function () {
    console.log(`Server listens http://${config['server_ip']}:${config['server_port']}`);
});

