// ==UserScript==
// @name         Middleman
// @namespace    http://tampermonkey.net/
// @version      1.2
// @description  restreaming
// @author       serious
// @match        https://web.snapchat.com/
// @icon         data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==
// @grant        none
// @require      https://unpkg.com/simple-peer@latest/simplepeer.min.js
// ==/UserScript==

(function() {
    'use strict';

    function loggin(txt) {
        function loggin(txt) {
    const logContainer = document.getElementById('log-container');
    if (!logContainer) {
        // Create log container element if it doesn't exist
        const container = document.createElement('div');
        container.id = 'log-container';
        container.style.position = 'fixed';
        container.style.top = '10px';
        container.style.left = '10px';
        container.style.padding = '10px';
        container.style.background = 'rgba(0, 0, 0, 0.7)';
        container.style.color = '#fff';
        container.style.zIndex = '9999';
        document.body.appendChild(container);
    }

    // Append log message to the container
    const logMessage = document.createElement('p');
    logMessage.textContent = txt;
    logContainer.appendChild(logMessage);
}
    }

    function loadScript(url, callback) {
        const script = document.createElement('script');
        script.type = 'text/javascript';
        script.src = url;
        script.onload = callback;
        document.head.appendChild(script);
    }

    loadScript('https://unpkg.com/simple-peer@latest/simplepeer.min.js', () => {
        loggin('SimplePeer version: ' + SimplePeer.VERSION);
    });

    let isCapturing = false;

    async function main(videoElement, initiator) {

        if(isCapturing) return;

        const bob = videoElement.srcObject;
        isCapturing = true;
        const mediaStream = new MediaStream();
        mediaStream.addTrack(bob.getVideoTracks()[0]);
        mediaStream.addTrack(bob.getAudioTracks()[0]);
        const stream = mediaStream;


        const socket = new WebSocket('ws://localhost:8080');
        const peer = new SimplePeer({
        initiator,
        stream,
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' },
            { urls: 'stun:stun3.l.google.com:19302' },
            { urls: 'stun:stun4.l.google.com:19302' },
           ],
          },
        });

        socket.addEventListener('error', (error) => {
            loggin('Error connecting to the signaling server: ' + error.toString());
        });

        socket.addEventListener('open', () => {
           loggin('Connected to signaling server');
           peer.on('signal', (data) => {
              socket.send(JSON.stringify(data));
           });
        });

        socket.addEventListener('message', (event) => {
           if(typeof event.data === 'string') {
               try {
                      const signal = JSON.parse(event.data);
                      peer.signal(signal);
               } catch (e) { loggin('Error parsing received data: ' + e.toString()); }
           }
           else { loggin('Received non-string data: ' + event.data.toString()); }
        });

        peer.on('connect', () => {
        loggin('WebRTC connection established');
        });

        peer.on('iceconnectionstatechange', () => {
        loggin('ICE Connection State: ' + peer.iceConnectionState.toString());
        });

        peer.on('signalingstatechange', () => {
        loggin('Signaling State: ' + peer.signalingState.toString());
        });

        peer.on('error', (err) => {
        loggin('Peer error: ' + err.toString());
        });

        peer.on('icecandidate', (candidate) => {
        loggin('Web client ICE candidate: ' + JSON.stringify(candidate));
        });

        return socket;
    }

    async function checkVideoElement()
    {
        let previousVideoElement = null;
        let socket = null;

        while(true) {
            const videoElement = document.querySelector('.qv9Ug');
            if(videoElement && videoElement.srcObject && !isCapturing) {
                socket = await main(videoElement, true);
                previousVideoElement = videoElement;
            } else if(previousVideoElement && !document.querySelector('.qv9Ug') && socket && socket.bufferedAmount === 0) {
                isCapturing = false;
                socket.close();
                loggin('Stream ended. WebSocket closed');
                previousVideoElement = null;
                socket = null;
            }
            await new Promise((resolve) => setTimeout(resolve, 1000));
        }
    }

    if(document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', checkVideoElement);
    }
    else { checkVideoElement(); }
})();
