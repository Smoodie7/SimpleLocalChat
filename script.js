let localConnection, remoteConnection, sendChannel, receiveChannel;
const encryptionKey = "1234567890123456"; // Symmetric key for AES encryption (PLACEHOLDER + not secure solution)
const hmacKey = "secretHMACKey"; // Symmetric key for HMAC

const nicknameInput = document.getElementById('nickname');
const messageInput = document.getElementById('message-input');
const sendButton = document.getElementById('send-button');
const saveButton = document.getElementById('save-button');
const messagesDiv = document.getElementById('messages');
const statusDiv = document.getElementById('status');

sendButton.disabled = true;

sendButton.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault(); // Prevents the newline from being added in the input field (BUGFIX)
        sendMessage();
    }
});
saveButton.addEventListener('click', saveChatToFile);

function createConnection() {
    localConnection = new RTCPeerConnection();
    remoteConnection = new RTCPeerConnection();

    sendChannel = localConnection.createDataChannel('chat');
    sendChannel.onmessage = handleMessage;
    sendChannel.onopen = handleSendChannelStatusChange;
    sendChannel.onclose = handleSendChannelStatusChange;

    remoteConnection.ondatachannel = receiveChannelCallback;

    localConnection.onicecandidate = e => e.candidate && remoteConnection.addIceCandidate(e.candidate);
    remoteConnection.onicecandidate = e => e.candidate && localConnection.addIceCandidate(e.candidate);

    localConnection.createOffer().then(offer => {
        localConnection.setLocalDescription(offer);
        remoteConnection.setRemoteDescription(offer);
        remoteConnection.createAnswer().then(answer => {
            remoteConnection.setLocalDescription(answer);
            localConnection.setRemoteDescription(answer);
        });
    });
}

function sendMessage() {
    const nickname = nicknameInput.value || "Anonymous";
    const message = messageInput.value;

    if (message) {
        const encryptedMessage = CryptoJS.AES.encrypt(message, encryptionKey).toString();
        const hmac = CryptoJS.HmacSHA256(encryptedMessage, hmacKey).toString();
        const messageData = { nickname, message: encryptedMessage, hmac, isSender: true };

        sendChannel.send(JSON.stringify(messageData));

        appendMessage('You', message);
        messageInput.value = '';
    }
}

function handleMessage(event) {
    const data = JSON.parse(event.data);
    const decryptedMessage = CryptoJS.AES.decrypt(data.message, encryptionKey).toString(CryptoJS.enc.Utf8);
    const hmacVerification = CryptoJS.HmacSHA256(data.message, hmacKey).toString();

    if (hmacVerification === data.hmac && !data.isSender) {
        appendMessage(data.nickname, decryptedMessage);
    } else if (hmacVerification !== data.hmac) {
        appendMessage('System', 'Message integrity could not be verified.');
    }
}

function appendMessage(sender, message) {
    const messageElement = document.createElement('div');
    const timestamp = new Date().toLocaleTimeString();
    messageElement.innerHTML = `<strong>${sender}</strong> [${timestamp}]: ${message}`;
    messagesDiv.appendChild(messageElement);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

function receiveChannelCallback(event) {
    receiveChannel = event.channel;
    receiveChannel.onmessage = handleMessage;
    receiveChannel.onopen = handleReceiveChannelStatusChange;
    receiveChannel.onclose = handleReceiveChannelStatusChange;
}

function handleSendChannelStatusChange() {
    const readyState = sendChannel.readyState;
    updateStatus(readyState === 'open' ? 'Connected' : 'Disconnected');
    sendButton.disabled = readyState !== 'open';
}

function handleReceiveChannelStatusChange() {
    const readyState = receiveChannel.readyState;
    updateStatus(readyState === 'open' ? 'Connected' : 'Disconnected');
}

function updateStatus(status) {
    statusDiv.textContent = status;
}

function saveChatToFile() {
    let chatContent = '';
    const messages = document.querySelectorAll('#messages div');

    messages.forEach(msg => {
        chatContent += msg.textContent + '\n';
    });

    const blob = new Blob([chatContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);

    const downloadLink = document.createElement('a');
    downloadLink.href = url;
    downloadLink.download = `chat_${new Date().toISOString().slice(0, 10)}.txt`;
    downloadLink.click();

    URL.revokeObjectURL(url);
}

window.onload = createConnection;
