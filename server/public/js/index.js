const checkboxes = $('input[type="checkbox"]').toArray();

function findCheckBoxes(){
    var result = [];
    checkboxes.forEach((checkbox) => {
        if (checkbox.checked){
            var res = checkbox.id.split(" ");
            var index = result.findIndex((el)=>el['id']==res[1]);                
            if(index > -1)
                result[index]["time"].push([res[2],res[3]]);
            else
                result.push({"name": res[0], "id":res[1], "time": [[res[2],res[3]]]});                
        }
    });
    console.log(result)
    return result;
}
function sendData(){
    var cams = findCheckBoxes();
    var day = $("#date").val();
    var requestData = {"day": day, "cams": cams};
    fetch('/script', {
        method: 'POST',
        body: JSON.stringify(requestData),
        headers: {
            'Content-Type': 'application/json'
        }
    })
    .then(response => {
        if(response.status == 200)
            alert("Успешно!");
        else alert("Ошибка!");
    })
    .catch(error => {
        console.log(error);
    });
}

async function Update(){
    let response;
    await $.ajax({ type: "GET",
        url: "/getExports",
        data:   {
            "day": $('#date').val()
        },
        success : function(text)
        {
            if(JSON.stringify(text)==="[]"){
                alert("Ничего не найдено!");
            }
            else{
                alert("Обновлено!");
                response = text;
            }
        }
    });
    checkboxes.forEach(checkbox=>{
        checkbox.checked=false;
    });
    if(response){
        response["cams"].forEach(cam=>{
            cam["time"].forEach(time=>{
                var el = document.getElementById(`${cam["name"]} ${cam["id"]} ${time[0]} ${time[1]}`);
                console.log(`${cam["name"]} ${cam["id"]} ${time[0]} ${time[1]}`);
                el.checked=true;
            });
        });
    }
}