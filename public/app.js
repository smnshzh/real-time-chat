const username = (new URLSearchParams(window.location.search).get('u') || `Guest-${Math.floor(Math.random() * 900 + 100)}`)
  .trim()
  .slice(0, 24);

const events = new EventSource('/events');

const messages = document.getElementById('messages');
const typingIndicator = document.getElementById('typingIndicator');
const form = document.getElementById('composer');
const input = document.getElementById('messageInput');

let typingTimeout;

function formatTime(timestamp) {
  return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function appendMessage(message) {
  const wrapper = document.createElement('article');
  const isOwnMessage = message.user === username;
  wrapper.className = `message ${message.type === 'system' ? 'system' : isOwnMessage ? 'user' : 'other'}`;

  if (message.type !== 'system') {
    const header = document.createElement('header');
    header.innerHTML = `<strong>${message.user}</strong><span>•</span><span>${formatTime(message.sentAt)}</span>`;
    wrapper.append(header);
  }

  const text = document.createElement('div');
  text.textContent = message.text;
  wrapper.append(text);

  messages.append(wrapper);
  messages.scrollTop = messages.scrollHeight;
}

async function post(url, payload) {
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
}

events.addEventListener('message', (event) => {
  appendMessage(JSON.parse(event.data));
});

events.addEventListener('typing', (event) => {
  const { users } = JSON.parse(event.data);
  const otherUsers = users.filter((user) => user !== username);

  if (!otherUsers.length) {
    typingIndicator.hidden = true;
    typingIndicator.textContent = '';
    return;
  }

  typingIndicator.hidden = false;
  typingIndicator.textContent = otherUsers.length === 1 ? `${otherUsers[0]} is typing…` : `${otherUsers.length} people are typing…`;
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const text = input.value.trim();
  if (!text) return;

  await post('/message', { user: username, text });
  input.value = '';
  await post('/typing', { user: username, isTyping: false });
});

input.addEventListener('input', async () => {
  await post('/typing', { user: username, isTyping: true });
  clearTimeout(typingTimeout);
  typingTimeout = setTimeout(() => {
    post('/typing', { user: username, isTyping: false });
  }, 800);
});
