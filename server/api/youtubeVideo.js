var {google} = require('googleapis');

const fs = require('fs');
const path = require('path');

var token = JSON.parse(fs.readFileSync(path.join(__dirname,'/youtubeTokens/client_secret.json')));
var OAuth2 = google.auth.OAuth2;

module.exports.oauth2Client = new OAuth2(
    client_id=token["web"]["client_id"],
    client_secret=token["web"]["client_secret"],
    redirectUri="http://localhost:700/oauth2callback"

);
module.exports.uploadVideo = (title,video)=>{
    this.oauth2Client.setCredentials(JSON.parse(fs.readFileSync(path.join(__dirname,'/youtubeTokens/credentials.json')))["tokens"]);
    const youtube = google.youtube({
        version: 'v3',
        auth: this.oauth2Client
    });
    
    youtube.videos.insert({
        resource: {
            snippet: {
                title: title
                //description: 'description' //описание если надо
            },
            status: {
                privacyStatus: "unlisted"
            },
        },
        part: 'snippet,status',
        media: {
            body: fs.createReadStream(video)
        }
    }, (err, data) => {
        if (err) {
            console.error('Error on uploaded video'+title, err);
            return false;
        } else {
            console.log('Uploaded video: ', data.data.id);
            return true;
        }
    });
    
}
