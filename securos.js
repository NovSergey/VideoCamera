const securos = require('securos');

const fs = require('fs');
var request = require('request');

const urlNodeServer = "http://localhost:700"

const exportsFolderPath = "C:/exports";
const exportsFilePath = "C:/exports/exports.json";
const exportsVideoFolderPath = "C:/exports/videos";


securos.connect(async function(core) {    
    var requestData = {
        "name": "SecurOs file: 'exportVideo.js'",
        "log": ""
    }
    if (fs.existsSync(exportsFilePath)) {
        var data = JSON.parse(fs.readFileSync(exportsFilePath, 'utf8'));
        if(JSON.stringify(data)!=="[]"){
            data.forEach((item)=>{
                var count = item["cams"].reduce((acc, el)=>acc+ el["time"].length,0);
                requestData.log+=`Добавлен день ${item["day"]}, количество пар: ${count}\n`;
                item["cams"].forEach((cam)=>{
                    let params = {
                        "channel_id": cam["id"],
                        "time_start": "",
                        "time_end": "",
                        "dir": exportsVideoFolderPath,
                        "file_name": ""
                    };
                    cam["time"].forEach((time)=>{
                        params["time_start"] = `${item["day"]} ${time[0]}`;
                        params["time_end"] = `${item["day"]} ${time[1]}`;
                        params["file_name"] = `${cam["name"]} ${item["day"]} ${time[0]}-${time[1]}`;
                        console.log(params);
                        core.doReact("ARCH_CNV", "1", "ARCH_EXPORT", params);
                    })
                })
            })
            request.post({
                url: urlNodeServer+'/upload',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length':"0"
                }
            });
        }
        else requestData.log = "Никаких записей не найдено!"; 
    }
    else requestData.log = "Никаких записей не найдено!";
    request.post({
        url: urlNodeServer+'/telegram',
        body: JSON.stringify(requestData),
        headers: {
            'Content-Type': 'application/json'
        }
    });
});