// Initialize DOM elements
const nameForm = document.getElementById('nameForm');
const usernameInput = document.getElementById('nameInput');
const chatList = document.getElementById('private-list');
const composeChatBox = document.getElementById('compose-chat-box');
const sendBtn = document.getElementById('sendMessage');
const chatWindowContents = document.getElementById('chat-window-contents');
const chatWindow = document.getElementById('chat-window');
// State variables
let currentChat = null;
let isGroupChat = true;

let socket;


// Utility function: Update user list
function updateUserList(users, currentUser) {
    chatList.innerHTML = '';
    users.forEach((user) => {
        if (user.userName === currentUser) return;
        chatList.innerHTML += `
                        <div class="chat-tile private" data-chat-type="private" data-chat-id="${user.userName}">
                        
                        <img src="https://picsum.photos/id/110/50" alt="" class="chat-tile-avatar">
                        <div class="chat-tile-details">
                                <div class="chat-tile-title">
                                    <span>${user.userName}</span>
                                    ${user.unreadMessagesCount > 0 ? `<span class="unread-count">${user.unreadMessagesCount}</span>` : ''}
                                    <span class="userStatus" style="color: ${user.status === 'online' ? 'green' : 'red'};">${user.status}</span>
                                </div>
                                
                                <div class="chat-tile-subtitle">
                                    <span>Reply in group fast</span>
                                </div>
                                
                            </div>
                        </div>
        `;
    });

    // Add event listener to each chat tile
    document.querySelectorAll('.chat-tile').forEach((tile) => {
        tile.addEventListener('click', (e) => {
          const chatId = tile.dataset.chatId;
          currentChat = chatId;
          isGroupChat = false;
          setActiveChat(chatId);
          chatWindowContents.innerHTML = '';
          document.getElementById('chat-title').innerText = chatId;

          const chatTile = document.querySelector(
            `.chat-tile[data-chat-id="${chatId}"]`
          );
          if (chatTile) {
            const unreadCountElement = chatTile.querySelector('.unread-count');
            if (unreadCountElement) {
              unreadCountElement.remove();
            }
          }
          chatWindow.classList.remove('blurtoChat');
          if (chatId == 'Group') {
            return;
          }
          loadMessages(chatId, currentUser);

          // Show chat window and hide sidebar
            tile.addEventListener('click', () => {
              document.body.classList.add('sidebar-hidden');
            });
           const backButton = document.querySelector('.back-button');
          // Show sidebar and hide chat window
          backButton.addEventListener('click', () => {
            document.body.classList.remove('sidebar-hidden');
          });

          chatWindowContents.scrollTop = chatWindowContents.scrollHeight; // Scroll to the latest message
        });
    });
}


// Utility function: Load messages

function loadMessages(chatId, currentUser) {
    fetch(`/messages/${currentUser}/${chatId}`)
        .then((response) => response.json())
        .then((data) => {
        data.forEach((message) => {
            displayPrivateMessage(message.sender, message.recipient , message.content,message.readed);
    });
});
}

document.getElementById('group-chat-tile').addEventListener('click' , ()=>{
    currentChat = 'Group';
    chatWindowContents.innerHTML = '';
    document.getElementById('chat-title').innerText = 'Group Chat';
    chatWindow.classList.add('blurtoChat');
    loadGroupMessages();
    setActiveChat('Group');
} );

function loadGroupMessages() {
    fetch(`/GroupMessage`)
      .then((response) => response.json())
      .then((data) => {
        console.log('Group messages:', data);
        data.forEach((message) => {
          displayGroupMessage(message.sender, message.content);
        });
      });  
}


// Utility function: Display private message

function displayPrivateMessage(sender, recipient, content, isRead) {
    const isCurrentUser = sender === localStorage.getItem('username');
    const messageAlignment = isCurrentUser ? 'left' : 'right';
    const messageDirection = isCurrentUser ? 'rtl' : 'ltr';

    const readStatus = isRead ? '✔✔' : '✔';
    chatWindowContents.innerHTML += `
        <div class="chat-message-group" dir="${messageDirection}" style="text-align: ${messageAlignment};">
            <div class="chat-messages">
                <div class="chat-message-container">
                    <div class="chat-message chat-message-first">
                        ${content}
                        <span class="chat-message-time">${new Date().toLocaleTimeString()}</span>
                        ${isCurrentUser ? `<span class="chat-message-status">${readStatus}</span>` : ''}
                    </div>
                    <div class="emoji-toolbar">
                        <img src="icons/emoji.svg" alt="" class="icon reaction-button">
                        <div class="reaction-emoji-selector">
                            <a href="#" class="icon">👍🏻</a>
                            <a href="#" class="icon">💖</a>
                            <a href="#" class="icon">😂</a>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

//  Group message
function displayGroupMessage(sender, content, isSystemMessage = false) {
    // Maintain a list of rendered message IDs to avoid duplication


    const isCurrentUser = sender === localStorage.getItem('username');
    const messageAlignment = isCurrentUser ? 'left' : 'right';
    const messageDirection = isCurrentUser ? 'rtl' : 'ltr';

    const lastMessageGroup = chatWindowContents.lastElementChild;
    const isSameSender = lastMessageGroup && lastMessageGroup.querySelector('.chat-message-sender')?.innerText === sender;

    if (isSystemMessage) {
        const systemMessageElement = document.createElement('div');
        systemMessageElement.className = 'system-message';
        systemMessageElement.innerHTML = `
            <div class="system-message-content">
               ${sender} : ${content}
            </div>
        `;
        chatWindowContents.appendChild(systemMessageElement);
    } else if (isSameSender) {
        const messageElement = document.createElement('div');
        messageElement.className = 'chat-message';
        messageElement.innerHTML = `
            ${content}
            <span class="chat-message-time">${new Date().toLocaleTimeString()}</span>
        `;
        lastMessageGroup.querySelector('.chat-messages').appendChild(messageElement);
    } else {
        const messageElement = document.createElement('div');
        messageElement.innerHTML = `
        <div class="chat-message-group" dir="${messageDirection}" style="text-align: ${messageAlignment};">
            <div class="chat-messages">
                <div class="chat-message-container">
                    <div class="chat-message chat-message-first">
                        <div class="chat-message-sender">${sender}</div>
                        <div style="color:#FFF;">${content}</div>  
                        <span class="chat-message-time">${new Date().toLocaleTimeString()}</span>
                    </div>
                    <div class="emoji-toolbar">
                        <img src="icons/emoji.svg" alt="" class="icon reaction-button">
                        <div class="reaction-emoji-selector">
                            <a href="#" class="icon">👍🏻</a>
                            <a href="#" class="icon">💖</a>
                            <a href="#" class="icon">😂</a>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        `;
        chatWindowContents.appendChild(messageElement);
    }
}

function setActiveChat(chatId) {
  const username = localStorage.getItem('username');
  currentChat = chatId;
  socket.emit('activeChat', { userName: username, chatId });
}

function setupSocketEvents(socket, userName) {
  // Handle connection and login
  socket.on('connect', () => {
    console.log('Connected to server');
    socket.emit('login', userName);
  });

  // Handle reconnection
  socket.on('reconnect', () => {
    console.log('Reconnected to server');
    socket.emit('reconnectUser', userName);
  });

  // Handle disconnection
  socket.on('disconnect', (reason) => {
    console.log(`Disconnected from server ${reason}`);
  });

  // Handle connection errors
  socket.on('connect_error', (error) => {
    console.error('Connection Error:', error);
  });

  // Update the user list
  socket.on('userList', (users) => {
    console.log('Updated User List:', users);
    updateUserList(users, userName);
  });

  // Display new messages
    socket.on('newMessage', ({ sender, recipient, content, isRead }) => {
    // Display the message only if it's for the active chat
    const isCurrentChat = currentChat === sender || currentChat === recipient;
        console.log('Received new message:', sender, recipient, currentChat , content, isRead);
    if( currentChat=='Group' && recipient=='Group' ){
        displayGroupMessage(sender, content);
    }else if (currentChat) {
        
      if (isCurrentChat) {
        displayPrivateMessage(sender, recipient, content, isRead);
      } else {
        // Optionally update the unread count for the relevant chat tile
        const chatTile = document.querySelector(
          `.chat-tile[data-chat-id="${sender}"]`
        );
        if (chatTile) {
          const unreadCountElement = chatTile.querySelector('.unread-count');
          if (unreadCountElement) {
            unreadCountElement.innerText =
              parseInt(unreadCountElement.innerText) + 1;
          } else {
            const chatTileTitle = chatTile.querySelector('.chat-tile-title');
            chatTileTitle.innerHTML += `<span class="unread-count">1</span>`;
          }
        }
      }
    }


});


  socket.on('messagesRead', ({ by }) => {
    document.querySelectorAll('.chat-message-status').forEach((status) => {
        status.innerText = '✔✔'; // Mark message as read
   });
  });

  socket.on('unreadMessage', ({ sender, unreadCount }) => {
      console.log('Received unread message:', sender, unreadCount);
      // Find the chat tile for the sender
      const chatTile = document.querySelector(`.chat-tile[data-chat-id="${sender}"]`);
      if (chatTile) {
          const unreadCountElement = chatTile.querySelector('.unread-count');

          if (unreadCount > 0) {
              if (unreadCountElement) {
                  // Update the existing unread count
                  unreadCountElement.innerText = unreadCount;
              } else {
                  // Add a new unread count element
                  const chatTileTitle = chatTile.querySelector('.chat-tile-title');
                  chatTileTitle.innerHTML += `<span class="unread-count">${unreadCount}</span>`;
              }
          } else if (unreadCountElement) {
              // Remove unread count if it's zero
              unreadCountElement.remove();
          }
      }
  });

  // group message

  socket.on('newUserIn', ({ userName }) => {
    console.log('New user connected:', userName);

    if(currentChat=="Group"){
        displayGroupMessage(userName, 'joined the chat', true);
    }
  });

  socket.on('userLeft', ( userName ) => {
      console.log('User left:', userName);
        if(currentChat=="Group"){
            displayGroupMessage(userName, 'left the chat', true);
        }
  });



sendBtn.addEventListener('click', () => {
    const content = composeChatBox.value.trim();
    if (!content || !currentChat) return; // Ensure currentChat is set

    const message = {
      sender: localStorage.getItem('username'), // Get current user
      content,
      recipient: currentChat, // Send to the active chat recipient
    };

    if(currentChat=="Group"){
        console.log('Group message:', message);
        socket.emit('groupMessage', message);
        displayGroupMessage(message.sender, message.content);
    }
    else{
        socket.emit('privateMessage', message);
        displayPrivateMessage(message.sender, currentChat, content, (isRead = false));

    }
    // Display the message in the current chat
    composeChatBox.value = ''; // Clear input box

});
}



// Event listener for form submission
nameForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const username = usernameInput.value.trim();
  if (!username) {
    alert('Username is required');
    return;
  }

    localStorage.setItem('username', username);
     socket = io();
    setupSocketEvents(socket, username);
});

// Automatically login if username exists in localStorage
document.addEventListener('DOMContentLoaded', () => {
  const savedUsername = localStorage.getItem('username');

  if (savedUsername) {
     socket = io();
    setupSocketEvents(socket, savedUsername);
  } else {
    const myModal = new bootstrap.Modal(document.getElementById('staticBackdrop'));
    myModal.show();
  }
});
