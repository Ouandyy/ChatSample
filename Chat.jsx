import React, { useState, useEffect, useRef } from 'react';
import { createUseStyles } from 'react-jss';
import { useGlobalState } from '@mozii/components';

import io from 'socket.io-client';

import Header from './Header';
import FormInput from './FormInput';
import Messages from './Messages';
import { useMessageDispatch, useMessageContext } from '../MessagesContext';

const useStyles = createUseStyles(({ colors }) => ({
  chatContainer: {
    border: [0.5, 'solid', colors.grey.extraLight2],
    width: '100%',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    paddingBottom: 50,
    position: 'relative',
  },
  messagesParentContainer: {
    borderRight: [0.5, 'solid', colors.grey.extraLight2],
    overflow: 'auto',
  },
}));

let socket;

const Chat = () => {
  const endpoint = 'xxxxxxxxxxxxxxxxx';
  const classes = useStyles();
  const [myMessage, setMyMessage] = useState('');
  const [incoming, setIncoming] = useState({});
  const [messagesParentHeight, setMessagesParentHeight] = useState(0);
  const initialLoad = useRef(true);
  const messagesParentRef = useRef(null);
  const {
    user: { name: userName, userChatId, email: userEmail },
  } = useGlobalState();
  const { users, selected, loading } = useMessageContext();

  const messageDispatch = useMessageDispatch();

  const to = users[selected]?.userID;
  const toUserName = users[selected]?.username;
  const toCId = users[selected]?.chatId;

  const urlSearchParams = new URL(document.location).searchParams;
  const getUrlVChatId = urlSearchParams.get('chatid');
  const getUrlStoreName = urlSearchParams.get('storename');

  // TO ACCESS THIS users[selected].chatId
  const handleScroll = () => {
    if (messagesParentRef.current) {
      messagesParentRef.current.scrollTop = messagesParentRef.current.scrollHeight;
      setMessagesParentHeight(messagesParentRef.current.scrollHeight);
    }
  };

  // TO ACCESS THIS newUsers[selected].chatId

  useEffect(() => {
    handleScroll();
  }, [users[selected]?.messages]);

  // used for when user joins chat
  useEffect(() => {
    socket = io(endpoint, {
      auth: {
        sessionID: userChatId,
        userName,
        userEmail,
        userChatId,
      },
      transports: ['websocket', 'polling'],
      secure: true,
      reconnection: true,
      timeout: 10000,
      reconnectionAttempts: 10,
      reconnectionDelay: 5000,
    });
    return () => {
      socket.emit('disconnect');
      socket.off();
    };
  }, [endpoint]);

  useEffect(() => {
    window.addEventListener('resize', handleScroll);

    socket.on('newMessages', (sendingMessage) => {
      setIncoming(sendingMessage);
      if (users[selected].userID !== sendingMessage.from) {
        messageDispatch({ type: 'SET_UNREAD', payload: sendingMessage });
      }
    });

    socket.on('users', (usersInfo) => {
      messageDispatch({ type: 'SET_USERS', payload: usersInfo });
    });

    return () => window.removeEventListener('resize', handleScroll);
  }, []);

  useEffect(() => {
    if (loading) return;
    if (getUrlStoreName && getUrlVChatId) {
      messageDispatch({
        type: 'CHAT_WITH_VENDOR',
        payload: {
          chatId: getUrlVChatId,
          storeName: getUrlStoreName,
        },
      });
    }

    const sendInq = ({ name, productId, thumbnail, userMessage, qty }) => {
      const date = new Date();
      const timeSent = date.toLocaleString([], {
        month: 'numeric',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });

      const sendingMessage = {
        content: userMessage,
        pid: productId,
        thumbnail,
        productName: name,
        storeName: getUrlStoreName,
        to: getUrlStoreName,
        from: userEmail,
        toUserName: getUrlStoreName,
        fromUserName: userName,
        toCId: getUrlVChatId,
        fromId: userChatId,
        utcTimeSent: Date.now(),
        timeSent,
        type: 'inq',
        qty,
      };

      socket.emit('private message', sendingMessage, () => {
        messageDispatch({
          type: 'SEND_RECEIVE_MESSAGE',
          payload: sendingMessage,
        });
        setMyMessage('');
      });
      socket.emit('New Message', sendingMessage);
    };

    const sessionChat = window.sessionStorage.getItem('messageObj');
    if (sessionChat && getUrlVChatId) {
      const parsedSChat = JSON.parse(sessionChat);
      sendInq(parsedSChat);
      window.sessionStorage.removeItem('messageObj');
    }
  }, [loading]);

  useEffect(() => {
    if (initialLoad.current) {
      return (initialLoad.current = false);
    }

    if (incoming.fromId === to) {
      socket.emit('readMessage', {
        toCId,
      });
      messageDispatch({ type: 'SET_READ', payload: to });
    }
    if (incoming.fromId) {
      messageDispatch({ type: 'SEND_RECEIVE_MESSAGE', payload: incoming });
    }
    if (incoming.content) setIncoming({});
  }, [incoming, to]);

  const sendMessage = (event) => {
    event.preventDefault();
    if (myMessage) {
      const date = new Date();
      const timeSent = date.toLocaleString([], {
        month: 'numeric',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });

      const sendingMessage = {
        content: myMessage,
        to,
        from: userEmail,
        toUserName,
        fromUserName: userName,
        toCId,
        fromId: userChatId,
        utcTimeSent: Date.now(),
        timeSent,
      };

      socket.emit('private message', sendingMessage, () => {
        messageDispatch({ type: 'SEND_RECEIVE_MESSAGE', payload: sendingMessage });
        setMyMessage('');
      });
      socket.emit('New Message', sendingMessage);
    }
  };

  // currently <Header profilePicture="" username={vendors[selected].name crashes because vendor does not have name
  return (
    <article className={classes.chatContainer}>
      <Header
        profilePicture={users[selected]?.profilePicture}
        username={users[selected]?.storeName}
      />
      <section className={classes.messagesParentContainer} ref={messagesParentRef}>
        <Messages
          currentUser={userChatId}
          message={myMessage}
          setMessage={setMyMessage}
          sendMessage={sendMessage}
        />
        <FormInput message={myMessage} setMessage={setMyMessage} sendMessage={sendMessage} />
      </section>
    </article>
  );
};

export default Chat;
