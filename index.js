const firebase = require("firebase/app");

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

const express = require("express");
const app = express();
const axios = require("axios");
require("dotenv").config();
// const {Storage} = require('@google-cloud/storage');
// const storage = new Storage();
const Authorization = `Basic ${Buffer.from(`${process.env.CUSTOMERID}:${process.env.CUSTOMER_SECRET}`).toString("base64")}`;
const fluent_ffmpeg = require('fluent-ffmpeg');
const { async } = require("@firebase/util");

const path = require('path');
const os = require('os');
const fs = require('fs');
const ffmpeg = require('fluent-ffmpeg');
const cwd = path.join(__dirname, '..');
const destFileName = path.join(cwd, '/fromtoNode/concat/test.mp3')
const {Storage} = require('@google-cloud/storage');
const storage = new Storage();

app.use(express.json());

const port = process.env.PORT || 3000;

app.listen(port, () => console.log(`Server listening at Port ${port}`));


app.get("/down", async(req,res) => {
    const fileBucket = 'recording-test-c0299.appspot.com'; // The Storage bucket that contains the file.
    const filePath = 'musicrecording.mp3'; // File path in the bucket.

    const bucket = storage.bucket(fileBucket);
    await bucket.file(filePath).download({destination: destFileName});

    res.send("Hello World");
})

app.get("/test", async(req,res) => {
    res.send("Hello World");
})

// Makes an ffmpeg command return a promise.
function promisifyCommand(command) {
    return new Promise((resolve, reject) => {
      command.on('end', resolve).on('error', reject).run();
    });
  }

app.get("/cut", async(req,res) => {
    let ffmpeg = require("fluent-ffmpeg");
    // const targetMP4File =  '/Users/sonykyum/Desktop/fromtoNode/concat/test.mp3';  //영상 파일
    var array = ['00:01:00','00:10:00']

    for(i=0;i<array.length;i++){ 
        // let to_changed_time_mp4 = `/Users/sonykyum/Desktop/fromtoNode/concat/change${i}.mp3`  //영상 파일
        let to_changed_time_mp4 = path.join(cwd,`/fromtoNode/concat/change${i}.mp3`)   //영상 파일
        let command = ffmpeg(destFileName)
            .outputOptions(`-ss ${array[i]}`)
            .outputOptions("-t 00:00:13")
            .output(to_changed_time_mp4);
        
        await promisifyCommand(command); 
        let targetStorageFilePath = `channel/sid_${i}.mp3`

        // Uploading the audio.
        const fileBucket = 'recording-test-c0299.appspot.com'; // The Storage bucket that contains the file.  
        const bucket = storage.bucket(fileBucket);
        await bucket.upload(to_changed_time_mp4, {destination: targetStorageFilePath});
    }
    res.send("Check File");
})

app.get("/upload", async(req,res) => {
    const fileBucket = 'recording-test-c0299.appspot.com'; // The Storage bucket that contains the file.  
    // let to_changed_time_mp4 = '/Users/sonykyum/Desktop/fromtoNode/concat/test.mp4'
    let to_changed_time_mp4 = path.join(cwd,'/fromtoNode/concat/change1.mp3')   //영상 파일
    const targetStorageFilePath = 'channel/sid_uid.mp3'
    const options = {
        destination: targetStorageFilePath,
            };
    // Uploading the audio.
    const bucket = storage.bucket(fileBucket);
    await bucket(fileBucket).upload(to_changed_time_mp4, {destination: options});

    res.send("Send End");
})