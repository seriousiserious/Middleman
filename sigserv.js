const WebSocket = require('ws');
const {spawn} = require('child_process');

const server = new WebSocket.Server({ port:8080});
const ffmpegProcesses = new Map();

const availableStreamKeys = ['stream1', 'stream2'];

function createFFmpegProcess(streamKey) {
    const ffmpeg = spawn('ffmpeg', [
        '-i', '-',
        '-c:v', 'libx264',
        '-preset', 'superfast',
        '-tune', 'zerolatency',
        '-c:a', 'aac',
        '-b:a', '128k',
        '-ar', '44100',
        '-f', 'flv',
        `rtmp://localhost/live/${streamKey}`,
    ]);

    ffmpeg.stdin.on('error', (error) => {
        console.error(`FFmpeg stdin error: ${error}`);
    });

    ffmpeg.stderr.on('data', (data) => {
        const errorMessage = data.toString();
        if(!errorMessage.includes('Non-monotonous DTS')) {
            console.error(`FFmpeg stderr: ${data}`);
        }
    });

    return ffmpeg;
}

function resetTimeout(streamKey) {
    const processInfo = ffmpegProcesses.get(streamKey);
    if(processInfo && processInfo.timeout) {
        clearTimeout(processInfo.timeout);
    }
    processInfo.timeout = setTimeout(() => {
        console.log('No data received for 5 seconds. Assuming stream has ended');
        processInfo.ffmpeg.stdin.end();
        processInfo.ffmpeg.kill();
        ffmpegProcesses.delete(streamKey);
        const newFFmpeg = createFFmpegProcess(streamKey);
        ffmpegProcesses.set(streamKey, {ffmpeg: newFFmpeg, timeout: null});
    }, 5000);
}

server.on('connection', (socket) => {
    
    const streamKey = availableStreamKeys.shift();
    console.log(`Client with stream key ${streamKey} connected \n`);

    if(!ffmpegProcesses.has(streamKey)) {
       const ffmpeg = createFFmpegProcess(streamKey);
       ffmpegProcesses.set(streamKey, {ffmpeg, timeout: null});
    }

    socket.on('message', (message) => {
       // console.log('Received', message);
       // const payload = JSON.parse(message);
       // const {streamKey, data} = payload;
       resetTimeout(streamKey);
       ffmpegProcesses.get(streamKey).ffmpeg.stdin.write(Buffer.from(message)); // write the received video data to the FFmpeg input
       /* server.clients.forEach((client) => {
        if(client !== socket && client.readyState === WebSocket.OPEN) {
          client.send(message);
        }
    }); */ 
    });
    
    socket.on('close', () => {
        console.log(`Client with stream key ${streamKey} disconnected \n`);
        const processInfo = ffmpegProcesses.get(streamKey);
        if (processInfo) {
            clearTimeout(processInfo.timeout);
            processInfo.ffmpeg.stdin.end();
            processInfo.ffmpeg.kill();
            ffmpegProcesses.delete(streamKey);
        }
        
        availableStreamKeys.push(streamKey);
    });
});

console.log('WebSocket signaling server running on port 8080 \n');