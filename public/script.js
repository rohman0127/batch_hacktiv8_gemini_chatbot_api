/**
 * WANDERAI — FRONTEND CONTROLLER
 * Vanilla JavaScript (No Frameworks)
 * Handles Real-time Chat, Markdown Parsing, DOM Manipulation, and Gemini API Integration
 */

const form = document.getElementById('chat-form');
const input = document.getElementById('user-input');
const chatBox = document.getElementById('chat-box');
const sendBtn = document.getElementById('send-btn');
const clearBtn = document.getElementById('clear-btn');
const welcomeScreen = document.getElementById('welcome-screen');

// Riwayat percakapan yang dikirim ke backend /api/chat
let conversation = [];

// Template Avatar Bot SVG
const BOT_AVATAR_SVG = `
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z"/>
  </svg>
`;

/**
 * Konverter Markdown Sederhana agar Itinerary dari AI tampil rapi & terstruktur
 * @param {string} text
 * @returns {string} HTML string
 */
function parseMarkdown(text) {
  if (!text) return '';

  let html = text
    // Escape HTML characters
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    // Heading ###
    .replace(/^### (.*$)/gim, '<h4>$1</h4>')
    .replace(/^## (.*$)/gim, '<h3>$1</h3>')
    // Bold **text**
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    // Italic *text*
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    // Bullet points (- or * )
    .replace(/^\s*[-*]\s+(.*$)/gim, '<li>$1</li>')
    // Numbered points (1. )
    .replace(/^\s*(\d+)\.\s+(.*$)/gim, '<li>$1</li>');

  // Wrap consecutive <li> into <ul>
  html = html.replace(/(<li>.*<\/li>(\n?<li>.*<\/li>)*)/gim, '<ul>$1</ul>');

  // Ganti baris baru ganda dengan paragraf
  const paragraphs = html.split(/\n\n+/);
  return paragraphs
    .map((p) => {
      p = p.trim();
      if (!p) return '';
      if (p.startsWith('<h') || p.startsWith('<ul>') || p.startsWith('<ol>')) return p;
      return `<p>${p.replace(/\n/g, '<br/>')}</p>`;
    })
    .join('');
}

/**
 * Menambahkan elemen pesan ke chat-box
 * @param {'user' | 'bot'} sender
 * @param {string} content
 * @param {boolean} isTyping
 * @returns {HTMLElement} Elemen gelembung teks
 */
function appendMessage(sender, content, isTyping = false) {
  // Sembunyikan welcome screen jika ada pesan pertama
  if (welcomeScreen && welcomeScreen.parentNode) {
    welcomeScreen.remove();
  }

  const row = document.createElement('div');
  row.classList.add('message-row', sender);

  if (sender === 'bot') {
    const avatar = document.createElement('div');
    avatar.classList.add('message-avatar');
    avatar.innerHTML = BOT_AVATAR_SVG;
    row.appendChild(avatar);
  }

  const bubble = document.createElement('div');
  bubble.classList.add('message-bubble');

  if (isTyping) {
    bubble.innerHTML = `
      <div class="typing-indicator" aria-label="Sedang mengetik...">
        <span class="typing-dot"></span>
        <span class="typing-dot"></span>
        <span class="typing-dot"></span>
      </div>
    `;
  } else if (sender === 'bot') {
    bubble.innerHTML = parseMarkdown(content);
  } else {
    bubble.textContent = content;
  }

  row.appendChild(bubble);
  chatBox.appendChild(row);
  chatBox.scrollTop = chatBox.scrollHeight;

  return bubble;
}

/**
 * Handle submit pesan chat
 */
form.addEventListener('submit', async function (e) {
  e.preventDefault();

  const userMessage = input.value.trim();
  if (!userMessage) return;

  // 1. Tampilkan pesan user ke chat box & tambahkan ke riwayat
  appendMessage('user', userMessage);
  conversation.push({ role: 'user', text: userMessage });
  input.value = '';

  // 2. Kunci input dan tombol kirim
  input.disabled = true;
  if (sendBtn) sendBtn.disabled = true;

  // 3. Tampilkan pesan animasi "Thinking..."
  const thinkingBubble = appendMessage('bot', '', true);

  // 4. Kirim request ke backend /api/chat
  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ conversation }),
    });

    const data = await response.json();

    // 5. Ganti animasi thinking dengan balasan AI
    if (response.ok && data.result) {
      thinkingBubble.innerHTML = parseMarkdown(data.result);
      conversation.push({ role: 'model', text: data.result });
    } else {
      thinkingBubble.classList.add('error-state');
      thinkingBubble.textContent = data.error || 'Maaf, tidak ada respon yang diterima dari server.';
      conversation.pop(); // Hapus pesan user terakhir jika gagal
    }
  } catch (error) {
    console.error('Fetch error:', error);
    thinkingBubble.classList.add('error-state');
    thinkingBubble.textContent = 'Gagal terhubung ke server. Pastikan backend sudah menyala.';
    conversation.pop(); // Hapus pesan user terakhir jika gagal
  } finally {
    // 6. Aktifkan kembali input dan fokus kursor
    input.disabled = false;
    if (sendBtn) sendBtn.disabled = false;
    input.focus();
    chatBox.scrollTop = chatBox.scrollHeight;
  }
});

/**
 * Fitur Quick Prompt Chips menggunakan Event Delegation
 */
chatBox.addEventListener('click', (e) => {
  const chip = e.target.closest('.chip');
  if (chip) {
    const promptText = chip.getAttribute('data-prompt');
    if (promptText) {
      input.value = promptText;
      form.dispatchEvent(new Event('submit'));
    }
  }
});

/**
 * Fitur Reset / Clear Chat
 */
if (clearBtn) {
  clearBtn.addEventListener('click', () => {
    if (conversation.length === 0) return;
    
    // Konfirmasi reset chat
    if (confirm('Apakah Anda ingin mereset riwayat percakapan?')) {
      conversation = [];
      chatBox.innerHTML = '';
      if (welcomeScreen) {
        chatBox.appendChild(welcomeScreen);
      }
      input.value = '';
      input.focus();
    }
  });
}
