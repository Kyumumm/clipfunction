const firebase = require("firebase/app");
const { initializeApp, applicationDefault, cert } = require('firebase-admin/app');
const { getFirestore, Timestamp, FieldValue } = require('firebase-admin/firestore');
const firebaseConfig = {
  apiKey: process.env.APIKEY,
  authDomain:  process.env.AUTHDOMAIN,
  projectId:  process.env.PROJECTID,
  storageBucket:  process.env.STORAGEBUCKET,
  messagingSenderId:  process.env.MESSAGEINGSENDERID,
  appId: process.env.STORAGEID,
  measurementId: process.env.MEASUREMENTID
};
firebase.initializeApp(firebaseConfig)
initializeApp();
const db = getFirestore();

const express = require("express");
const app = express();
const axios = require("axios");
require("dotenv").config();
const fluent_ffmpeg = require('fluent-ffmpeg');
const { async } = require("@firebase/util");

//agora config
const {RtcTokenBuilder, RtmTokenBuilder, RtcRole, RtmRole} = require('agora-access-token')
const APP_ID = process.env.APP_ID
const APP_CERTIFICATE = process.env.APP_CERTIFICATE
const CUSTOMERID = process.env.CUSTOMERID
const CUSTOMER_SECRET = process.env.CUSTOMER_SECRET
const Authorization = `Basic ${Buffer.from(`${CUSTOMERID}:${CUSTOMER_SECRET}`).toString("base64")}`;

// const port = process.env.PORT || 3000;
// app.listen(port, () => console.log(`Server listening at Port ${port}`));

const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const cwd = path.join(__dirname, '..');
const {Storage} = require('@google-cloud/storage');
const storage = new Storage();
const fileBucket = process.env.STORAGEBUCKET; // The Storage bucket that contains the file.
app.use(express.json());
const fs = require('fs');

// Makes an ffmpeg command return a promise.
function promisifyCommand(command) {
    return new Promise((resolve, reject) => {
      command.on('end', resolve).on('error', reject).run();
    });
  }

async function deleteClipMemoryFile(file){
    fs.unlink(file, function(err){
      if(err) {
        console.log("Error : ", err)
      }
    })
  }

app.post("/clip", async(req,res) => {
    try {
        const bucket = storage.bucket(fileBucket);
        // const sid = req.body.sid
        // const channel = req.body.channel
        const rid = req.body.rid
        const sid = req.body.sid
        const channelName = req.body.channelName
        const filePath = `room/${rid}/${sid}_${channelName}_0.mp4`; // 스토리지에 저장되어있는 파일 이름 
        const destFileName = path.join(cwd, `/room/${rid}.mp4`) // 지정한 저장 경로에 지정한 형식으로 파일 저장

        await bucket.file(filePath).download({destination: destFileName});
        let ffmpeg = require("fluent-ffmpeg");
        var array = req.body.clipTime

        for(i=0;i<array.length;i++){ 
            let uid = array[i].uid
            let to_changed_time_mp3 = path.join(cwd,`/room/clip_${uid}.mp4`)   // 클립을 딴 영상 파일
            let nowdate = new Date();
            let command = ffmpeg(destFileName)
                .outputOptions(`-ss ${array[i].time}`)
                .outputOptions("-t 00:00:30")
                .output(to_changed_time_mp3);
            
            await promisifyCommand(command); 
            let targetStorageFilePath = `clip/${uid}/${rid}_${nowdate.yyyyMMddHHmmss()}.mp4`
            // Uploading the audio
            await bucket.upload(to_changed_time_mp3, {destination: targetStorageFilePath});
            // Delete cilp file
            await deleteClipMemoryFile(to_changed_time_mp3)
            }
            await deleteClipMemoryFile(destFileName)
            return res.status(200).send("upload");
    } catch (err) {
        console.log(err)
        return res.status(400).send({ msg: err });
    }
})

app.post("/acquire", async (req, res) => {
    try {
      const acquire = await axios.post(
          `https://api.agora.io/v1/apps/${APP_ID}/cloud_recording/acquire`,
          {
            cname: req.body.channel,
            uid: req.body.uid,
            clientRequest: {
              resourceExpiredHour: 24,
              scene : 0
            },
          },
          { headers: { Authorization } }
        );
          return res.status(200).send(acquire.data);
        } catch (err) {
          return res.status(400).send({ msg: err });
        }
    });

app.post("/rtcToken", async(req,res)=> {
    try{
        // set response header
        res.header('Access-Control-Allow-Origin', '*');
        // get channel name
        const channelName = req.body.channelName;
        // get uid 
        const uid = req.body.uid;
        // get role
        let role = RtcRole.PUBLISHER;
        // get the expire time
        let expireTime = 3600
        // calculate privilege expire time
        const currentTime = Math.floor(Date.now() / 1000);
        const privilegeExpireTime = currentTime + expireTime;
        
        // build the token
        let token = RtcTokenBuilder.buildTokenWithUid(APP_ID, APP_CERTIFICATE, channelName, uid, role, privilegeExpireTime);
        // return the token
        return res.status(200).send(`rtcToken : ${token}`);
      }
      catch(err) {
        return res.status(400).send({ msg: err });
      }
})
    
app.post("/start", async (req, res) => {
      try {
        const resource = req.body.resource;
        const start = await axios.post(
          `https://api.agora.io/v1/apps/${APP_ID}/cloud_recording/resourceid/${resource}/mode/mix/start`,
          {
            cname: req.body.channel,
            uid: req.body.uid,
            clientRequest: {
              token: req.body.token,
              recordingConfig: {
                maxIdleTime: 30,
                streamTypes: 2,
                channelType: 0,
                videoStreamType: 0,
                transcodingConfig: {
                  height: 640,
                  width: 360,
                  bitrate: 500,
                  fps: 15,
                  mixedVideoLayout: 1,
                  backgroundColor: "#FFFFFF",
                },
              },
              recordingFileConfig: {
                avFileType: [
                  "hls",
                  "mp4"
                ],
              },
              storageConfig: {
                vendor: 6,
                region: 11,
                bucket: fileBucket,
                accessKey: process.env.ACCESSKEY,
                secretKey: process.env.SECRETKEY,
                fileNamePrefix: [
                    "room",
                    req.body.rid
              ],
              },
            },
          },
          { headers: { Authorization } }
        );
      
        return res.send(start.data);
  
      } catch (err) {
        return res.status(400).send({ msg: err });
      }
  });
    
app.post("/stop", async (req, res) => {
      try {
        const resource = req.body.resource;
        const sid = req.body.sid;
        const stop = await axios.post(
          `https://api.agora.io/v1/apps/${APP_ID}/cloud_recording/resourceid/${resource}/sid/${sid}/mode/mix/stop`,
          {
            cname: req.body.channel,
            uid: req.body.uid,
            clientRequest: {},
          },
          { headers: { Authorization } }
        );
        return res.status(200).send(stop.data);
      } catch (err) {
        return res.status(400).send({ msg: err });
      }
  });

Date.prototype.yyyyMMddHHmmss = function () {
    var date = this;
    var year = date.getFullYear();
    var month = date.getMonth() + 1;
    var day = date.getDate();
    var hh = date.getHours();
    var mm = date.getMinutes();
    var ss = date.getSeconds();

    return "" + year +
    (month < 10 ? "0" + month : month) +
    (day < 10 ? "0" + day : day) +
    (hh < 10 ? "0" + hh : hh) +
    (mm < 10 ? "0" + mm : mm) +
    (ss < 10 ? "0" + ss : ss);
};


async function listFiles() {
    var a = ''
    const snapshot = await db.collection('room').doc('v1').collection('private').doc('n1oMGqjTGLwGmjXxc9Y9').get().then(function(doc){
    a = doc.data().asd
    })
    console.log(a)
}

listFiles();